from __future__ import annotations


class DiseaseServiceAdapter:
    async def detect(self, *, image_name: str, crop_type: str | None) -> dict[str, object]:
        normalized = image_name.lower()
        if "spot" in normalized or "blight" in normalized:
            predicted = "leaf_blight"
            confidence = 0.82
            recommendation = "Remove heavily infected leaves and apply a fungicide as per local advisory."
        elif "yellow" in normalized:
            predicted = "nutrient_stress"
            confidence = 0.74
            recommendation = "Check nitrogen balance and irrigation intervals before corrective spray."
        else:
            predicted = "healthy"
            confidence = 0.67
            recommendation = "No major disease signature detected. Continue routine monitoring every 3 to 5 days."

        if crop_type:
            recommendation = f"For {crop_type}: {recommendation}"

        return {
            "predicted_disease": predicted,
            "confidence": confidence,
            "recommendation": recommendation,
        }
