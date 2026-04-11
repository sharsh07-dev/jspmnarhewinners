from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import logging
from pathlib import Path

import numpy as np

from app.core.config import get_settings
from app.utils.domain_helpers import clamp_percentage

CLASS_NAMES = ["Healthy crop", "Moderate damage", "Severe damage"]
logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PredictionResult:
    model_version: str
    predicted_class: str
    damage_probability: float
    damaged_area_percentage: float
    class_probabilities: dict[str, float] | None = None


def _vegetation_score(image: np.ndarray) -> float:
    data = image.astype(np.float32)
    if data.max() > 1.0:
        data = data / 255.0
    green = data[..., 1]
    red = data[..., 0]
    blue = data[..., 2]
    return float(np.mean((green * 1.2) - (red * 0.5) - (blue * 0.2)))


def _heuristic_prediction(image: np.ndarray) -> PredictionResult:
    score = _vegetation_score(image)
    if score > 0.28:
        predicted_class = "Healthy crop"
        damage_probability = 0.18
        damaged_area_percentage = 12.0
    elif score > 0.08:
        predicted_class = "Moderate damage"
        damage_probability = 0.58
        damaged_area_percentage = 44.0
    else:
        predicted_class = "Severe damage"
        damage_probability = 0.86
        damaged_area_percentage = 76.0

    class_probabilities = {
        "Healthy crop": max(0.0, 1.0 - damage_probability),
        "Moderate damage": damage_probability * 0.45,
        "Severe damage": damage_probability * 0.55,
    }
    total = sum(class_probabilities.values())
    normalized = {k: float(v / total) for k, v in class_probabilities.items()}
    return PredictionResult(
        model_version="heuristic-v1",
        predicted_class=predicted_class,
        damage_probability=float(np.clip(damage_probability, 0.0, 1.0)),
        damaged_area_percentage=clamp_percentage(damaged_area_percentage),
        class_probabilities=normalized,
    )


def _preprocess_image(image: np.ndarray, image_size: tuple[int, int] = (64, 64)) -> np.ndarray:
    """Preprocess image for model inference: normalize to [0,1] and resize to target dimensions."""
    data = image.astype(np.float32)
    if data.max() > 1.0:
        data = data / 255.0
    
    try:
        import tensorflow as tf
        tensor = tf.convert_to_tensor(data)
        tensor = tf.image.resize(tensor, image_size)
        return tf.expand_dims(tensor, axis=0).numpy()
    except ImportError:
        # Fallback if TensorFlow import fails
        from scipy import ndimage
        resized = ndimage.zoom(data, (image_size[0]/data.shape[0], image_size[1]/data.shape[1], 1), order=1)
        return np.expand_dims(resized, axis=0)
    except Exception:
        # Last resort: simple reshape
        resized = np.resize(data, (*image_size, 3))
        return np.expand_dims(resized, axis=0)


@lru_cache(maxsize=1)
def _load_optional_model() -> object | None:
    settings = get_settings()
    raw_model_path = Path(settings.ai_model_path)
    model_path = raw_model_path if raw_model_path.is_absolute() else (settings.project_root / raw_model_path)
    if not model_path.exists():
        if settings.require_trained_ai_model:
            raise FileNotFoundError(
                f"AI model not found at '{model_path}'. Set AI_MODEL_PATH to a valid model file."
            )
        return None
    try:
        import tensorflow as tf
        return tf.keras.models.load_model(model_path)
    except (ImportError, ModuleNotFoundError, Exception) as exc:
        if model_path.suffix == ".joblib":
            try:
                import joblib
                return joblib.load(model_path)
            except ImportError:
                logger.warning("Joblib not installed, cannot load .joblib model")
                return None
        
        if settings.require_trained_ai_model and not settings.allow_heuristic_ai_fallback:
             raise RuntimeError(f"Failed to load AI model from '{model_path}': {exc}") from exc
        logger.warning("Failed to load trained AI model from '%s'; using heuristic fallback.", model_path)
        return None

def _extract_features(image: np.ndarray) -> np.ndarray:
    """Extract features for traditional ML models (RandomForest, etc.)"""
    data = image.astype(np.float32)
    if data.max() > 1.0:
        data = data / 255.0
    
    mean_red = float(np.mean(data[..., 0]))
    mean_green = float(np.mean(data[..., 1]))
    mean_blue = float(np.mean(data[..., 2]))
    ndvi = float(np.mean((data[..., 1] - data[..., 0]) / (data[..., 1] + data[..., 0] + 1e-6)))
    variance = float(np.var(data))
    
    return np.array([[mean_red, mean_green, mean_blue, ndvi, variance]])


class AIInferenceService:
    def predict(self, image: np.ndarray) -> PredictionResult:
        settings = get_settings()
        model = _load_optional_model()
        if model is None:
            if not settings.allow_heuristic_ai_fallback:
                raise RuntimeError(
                    "Heuristic AI fallback is disabled. Configure a trained model via AI_MODEL_PATH."
                )
            return _heuristic_prediction(image)

        if hasattr(model, "predict_proba"):
            # Traditional ML model (Scikit-Learn)
            probabilities = model.predict_proba(_extract_features(image))[0]
        else:
            # Deep Learning model (TensorFlow/Keras)
            probabilities = model.predict(_preprocess_image(image), verbose=0)[0]

        class_index = int(np.argmax(probabilities))
        predicted_class = CLASS_NAMES[class_index]
        
        # Damage probability: sum of moderate + severe damage class probabilities
        damage_probability = float(probabilities[1] + probabilities[2])
        
        # Damaged area percentage: weighted average based on damage class severity
        damaged_area_percentage = float(
            (probabilities[1] * 40.0) + (probabilities[2] * 80.0)
        )
        
        return PredictionResult(
            model_version=settings.ai_model_version,
            predicted_class=predicted_class,
            damage_probability=float(np.clip(damage_probability, 0.0, 1.0)),
            damaged_area_percentage=clamp_percentage(damaged_area_percentage),
            class_probabilities={name: float(prob) for name, prob in zip(CLASS_NAMES, probabilities)},
        )

    def predict_v2(self, before_image: np.ndarray, after_image: np.ndarray) -> PredictionResult:
        """New multi-modal prediction comparing before and after satellite shots via Gemini."""
        settings = get_settings()
        api_key = settings.google_api_key
        
        if not api_key:
            logger.warning("GOOGLE_API_KEY not found, falling back to v1 predict")
            return self.predict(after_image)
            
        try:
            import google.generativeai as genai
            from PIL import Image
            import io
            import json

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')

            # Convert numpy arrays to PIL then to bytes
            def npy_to_pil(arr):
                if arr.max() <= 1.0:
                    arr = (arr * 255).astype(np.uint8)
                return Image.fromarray(arr)

            prompt = """
            Compare these two satellite images of a farmland.
            The first image is the 'Before' snapshot (planned state or historical).
            The second image is the 'After' snapshot (post-incident).
            
            Identify any visible damage, flooding, drought, or pest issues.
            Return a JSON object with:
            {
                "predicted_class": "Healthy crop" | "Moderate damage" | "Severe damage",
                "damage_probability": number (0 to 1),
                "damaged_area_percentage": number (0 to 100),
                "rationale": "string explanation of what you see"
            }
            """

            response = model.generate_content([
                prompt,
                npy_to_pil(before_image),
                npy_to_pil(after_image)
            ])
            
            # Extract JSON from response
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            data = json.loads(text[start:end])

            return PredictionResult(
                model_version="gemini-1.5-flash-multimodal",
                predicted_class=data.get("predicted_class", "Healthy crop"),
                damage_probability=float(data.get("damage_probability", 0.0)),
                damaged_area_percentage=float(data.get("damaged_area_percentage", 0.0)),
                class_probabilities={"vision_rationale": data.get("rationale", "")}
            )

        except Exception as exc:
            logger.error("Gemini V2 inference failed: %s", exc)
            return self.predict(after_image)
