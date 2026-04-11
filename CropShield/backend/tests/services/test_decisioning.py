from __future__ import annotations

from app.services.decisioning import DecisionService


def test_decision_engine_preserves_approved_threshold() -> None:
    service = DecisionService()
    result = service.evaluate_claim(
        ndvi_before=0.62,
        ndvi_after=0.15,
        ndwi_before=0.30,
        ndwi_after=0.05,
        evi_before=0.48,
        evi_after=0.10,
        ai_damage_probability=0.72,
        damaged_area_percentage=70.0,
    )
    assert result.decision == "Approved"


def test_decision_engine_preserves_partial_threshold() -> None:
    service = DecisionService()
    result = service.evaluate_claim(
        ndvi_before=0.55,
        ndvi_after=0.25,
        ndwi_before=0.25,
        ndwi_after=0.05,
        evi_before=0.45,
        evi_after=0.20,
        ai_damage_probability=0.50,
        damaged_area_percentage=45.0,
    )
    assert result.decision == "Partial Damage"


def test_decision_engine_rejects_weak_signals() -> None:
    service = DecisionService()
    result = service.evaluate_claim(
        ndvi_before=0.42,
        ndvi_after=0.40,
        ndwi_before=0.18,
        ndwi_after=0.17,
        evi_before=0.36,
        evi_after=0.34,
        ai_damage_probability=0.20,
        damaged_area_percentage=10.0,
    )
    assert result.decision == "Rejected"
