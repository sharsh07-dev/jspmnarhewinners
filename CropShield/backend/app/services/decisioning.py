from __future__ import annotations

from dataclasses import dataclass


def _clamp_percentage(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def _index_drop_to_damage(before: float, after: float, normalization_span: float) -> float:
    drop = max(0.0, float(before) - float(after))
    if normalization_span <= 0:
        return 0.0
    return _clamp_percentage((drop / normalization_span) * 100.0)


@dataclass(slots=True)
class DecisionResult:
    decision: str
    confidence: float
    rationale: str
    fused_damage: float
    ndvi_damage: float
    ndwi_damage: float
    evi_damage: float
    ai_damage: float
    area_score: float


class DecisionService:
    def evaluate_claim(
        self,
        *,
        ndvi_before: float,
        ndvi_after: float,
        ndwi_before: float,
        ndwi_after: float,
        evi_before: float,
        evi_after: float,
        ai_damage_probability: float,
        damaged_area_percentage: float,
    ) -> DecisionResult:
        ndvi_damage = _index_drop_to_damage(ndvi_before, ndvi_after, normalization_span=0.6)
        ndwi_damage = _index_drop_to_damage(ndwi_before, ndwi_after, normalization_span=0.5)
        evi_damage = _index_drop_to_damage(evi_before, evi_after, normalization_span=0.8)
        ai_damage = _clamp_percentage(ai_damage_probability * 100.0)
        area_score = _clamp_percentage(damaged_area_percentage)

        # Multi-signal fusion with explicit weights across spectral indices + AI + area severity.
        fused_damage = (
            (0.35 * ndvi_damage)
            + (0.15 * ndwi_damage)
            + (0.15 * evi_damage)
            + (0.20 * ai_damage)
            + (0.15 * area_score)
        )

        if fused_damage >= 65.0:
            decision = "Approved"
        elif fused_damage >= 40.0:
            decision = "Partial Damage"
        else:
            decision = "Rejected"

        confidence = min(0.99, max(0.5, 0.5 + (abs(fused_damage - 50.0) / 100.0)))
        rationale = (
            "Fused evidence score from NDVI/NDWI/EVI drops, AI damage probability, and estimated damaged area. "
            f"Score={fused_damage:.1f} (NDVI={ndvi_damage:.1f}, NDWI={ndwi_damage:.1f}, EVI={evi_damage:.1f}, "
            f"AI={ai_damage:.1f}, Area={area_score:.1f})."
        )
        return DecisionResult(
            decision=decision,
            confidence=confidence,
            rationale=rationale,
            fused_damage=fused_damage,
            ndvi_damage=ndvi_damage,
            ndwi_damage=ndwi_damage,
            evi_damage=evi_damage,
            ai_damage=ai_damage,
            area_score=area_score,
        )
