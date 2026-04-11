from __future__ import annotations

import httpx

from app.core.config import get_settings


def _fallback_chat_response(language: str) -> dict[str, object]:
    normalized_language = language.lower().strip() or "en"
    reply = (
        "Please monitor moisture levels and inspect leaf color before the next irrigation cycle. "
        "If you share crop type and recent weather, I can provide a tighter recommendation."
    )
    return {
        "provider": "fallback",
        "reply": reply if normalized_language == "en" else reply,
        "fallback_used": True,
    }


class AdvisoryServiceAdapter:
    async def chat(self, *, message: str, language: str) -> dict[str, object]:
        settings = get_settings()
        provider_name = "grok"
        api_key = settings.grok_api_key
        base_url = settings.grok_base_url
        model = settings.grok_model

        if not api_key and settings.groq_api_key:
            provider_name = "groq"
            api_key = settings.groq_api_key
            base_url = settings.groq_base_url
            model = settings.groq_model

        if not api_key:
            return _fallback_chat_response(language)

        try:
            async with httpx.AsyncClient(timeout=settings.grok_timeout_seconds) as client:
                response = await client.post(
                    f"{base_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are an agronomy advisor for Indian farmers. "
                                    "Give concise, practical, and safety-first crop guidance. "
                                    f"Respond in language code '{language}'."
                                ),
                            },
                            {"role": "user", "content": message},
                        ],
                        "temperature": 0.4,
                    },
                )
            response.raise_for_status()
            body = response.json()
            choices = body.get("choices") if isinstance(body, dict) else None
            first_choice = choices[0] if isinstance(choices, list) and choices else {}
            chat_message = first_choice.get("message") if isinstance(first_choice, dict) else {}
            reply = chat_message.get("content") if isinstance(chat_message, dict) else None
            if not isinstance(reply, str) or not reply.strip():
                return _fallback_chat_response(language)

            return {
                "provider": provider_name,
                "reply": reply.strip(),
                "fallback_used": False,
            }
        except Exception:
            return _fallback_chat_response(language)

    async def predict_crop(
        self,
        *,
        crop_type: str,
        soil_type: str,
        rainfall_mm: float,
        temperature_c: float,
    ) -> dict[str, object]:
        soil_factor = 1.05 if soil_type.lower() in {"loam", "clay loam"} else 0.92
        rainfall_factor = min(max(rainfall_mm / 900.0, 0.65), 1.25)
        temp_factor = 1.0 - (abs(temperature_c - 28.0) * 0.01)
        expected_yield = max(1.1, 3.8 * soil_factor * rainfall_factor * max(temp_factor, 0.75))

        if expected_yield >= 4.0:
            risk = "low"
            recommendation = "Maintain current crop schedule and continue preventive scouting."
        elif expected_yield >= 2.8:
            risk = "moderate"
            recommendation = "Monitor field moisture and nutrient schedule weekly to avoid stress dips."
        else:
            risk = "high"
            recommendation = "Use contingency irrigation and review crop protection plan immediately."

        return {
            "expected_yield_tph": round(expected_yield, 2),
            "risk_level": risk,
            "recommendation": f"For {crop_type}: {recommendation}",
        }
