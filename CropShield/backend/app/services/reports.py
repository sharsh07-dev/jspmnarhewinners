from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from io import BytesIO

import matplotlib.pyplot as plt
from redis.asyncio import Redis
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.services.indices import compute_metrics
from app.repositories.analysis import AnalysisRepository
from app.repositories.claims import ClaimRepository
from app.repositories.reports import ReportRepository
from app.services.satellite import SatelliteService
from app.utils.domain_helpers import array_to_png_bytes, ensure_dir


def _heatmap_to_png(data, title: str, cmap: str) -> bytes:
    fig, ax = plt.subplots(figsize=(5, 4))
    image = ax.imshow(data, cmap=cmap, vmin=-1.0, vmax=1.0)
    ax.set_title(title)
    ax.axis("off")
    colorbar = fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    colorbar.set_label(title.split()[0])
    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=180, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return buffer.getvalue()


class ReportService:
    def __init__(self, session: AsyncSession, redis_client: Redis | None = None) -> None:
        self.session = session
        self.reports = ReportRepository(session)
        self.claims = ClaimRepository(session)
        self.analysis = AnalysisRepository(session)
        self.settings = get_settings()
        self.redis = redis_client

    async def get_latest_report_or_404(self, claim_id: int):
        report = await self.reports.get_latest_for_claim(claim_id)
        if report is None:
            raise NotFoundError(f"No report found for claim '{claim_id}'.")
        return report

    async def render_report_pdf(self, *, claim_id: int, analysis_run_id: int | None = None) -> bytes:
        claim = await self.claims.get_by_id(claim_id)
        if claim is None:
            raise NotFoundError(f"Claim '{claim_id}' was not found.")

        analysis = None
        if analysis_run_id is not None:
            analysis = await self.analysis.get_by_id(analysis_run_id)
        if analysis is None:
            analysis = await self.analysis.get_latest_for_claim(claim_id)
        if analysis is None or analysis.metrics is None or analysis.ai_prediction is None:
            raise NotFoundError(f"Analysis run for claim '{claim_id}' is incomplete.")

        artifacts = await self._load_analysis_artifacts(claim, analysis)
        return self._build_claim_report_bytes(claim=claim, analysis=analysis, analysis_maps=artifacts)

    async def generate_report(self, *, claim_id: int, analysis_run_id: int, analysis_maps: dict[str, object]) -> object:
        claim = await self.claims.get_by_id(claim_id)
        if claim is None:
            raise NotFoundError(f"Claim '{claim_id}' was not found.")
        analysis = await self.analysis.get_by_id(analysis_run_id)
        if analysis is None or analysis.metrics is None or analysis.ai_prediction is None:
            raise NotFoundError(f"Analysis run '{analysis_run_id}' is incomplete.")

        pdf_bytes = self._build_claim_report_bytes(claim=claim, analysis=analysis, analysis_maps=analysis_maps)

        output_dir = self.settings.artifacts_dir / f"claim_{claim_id}"
        ensure_dir(output_dir)
        filename = f"analysis_{analysis_run_id}_{datetime.now(tz=timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.pdf"
        file_path = output_dir / filename
        file_path.write_bytes(pdf_bytes)

        report = await self.reports.create(
            claim_id=claim_id,
            analysis_run_id=analysis_run_id,
            file_path_or_object_key=str(file_path),
            mime_type="application/pdf",
        )
        await self.session.commit()
        await self._cache_metadata(report.claim_id, report.id, report.analysis_run_id, report.file_path_or_object_key, report.mime_type)
        return report

    async def _load_analysis_artifacts(self, claim, analysis) -> dict[str, object]:
        from app.services.analysis_pipeline import AnalysisPipelineService

        artifacts = None
        if analysis.id is not None:
            pipeline = AnalysisPipelineService(self.session, redis_client=self.redis)
            artifacts = await pipeline.load_analysis_artifacts(analysis.id)
        if artifacts is None:
            satellite = SatelliteService(redis_client=self.redis)
            before_scene, after_scene, _ = await satellite.fetch_satellite_pair(
                latitude=float(claim.latitude),
                longitude=float(claim.longitude),
                damage_date=claim.damage_date.isoformat(),
                area_hectares=float(claim.farm_area_hectares),
                gap_before=analysis.gap_before or self.settings.default_gap_before_days,
                gap_after=analysis.gap_after or self.settings.default_gap_after_days,
                window_days=analysis.window_days or self.settings.default_window_days,
                max_cloud_threshold=analysis.max_cloud_threshold or self.settings.default_max_cloud_threshold,
                upscale_factor=self.settings.default_upscale_factor,
            )
            _, maps = compute_metrics(before_scene.bands, after_scene.bands)
            artifacts = {
                "before_rgb": before_scene.rgb_image,
                "after_rgb": after_scene.rgb_image,
                **maps,
            }
        return artifacts

    def _build_claim_report_bytes(self, *, claim, analysis, analysis_maps: dict[str, object]) -> bytes:
        latest_decision = analysis.decisions[-1] if analysis.decisions else None

        before_rgb = analysis_maps["before_rgb"]
        after_rgb = analysis_maps["after_rgb"]
        ndvi_before_map = analysis_maps["ndvi_before"]
        ndvi_after_map = analysis_maps["ndvi_after"]
        ndwi_before_map = analysis_maps["ndwi_before"]
        ndwi_after_map = analysis_maps["ndwi_after"]
        evi_before_map = analysis_maps["evi_before"]
        evi_after_map = analysis_maps["evi_after"]

        payload = {
            "claim_id": claim.id,
            "farmer_name": claim.farmer_name,
            "latitude": float(claim.latitude),
            "longitude": float(claim.longitude),
            "crop_type": claim.crop_type,
            "farm_area": float(claim.farm_area_hectares),
            "damage_date": claim.damage_date.isoformat(),
            "satellite_source_before": analysis.before_scene_source or "unknown",
            "satellite_source_after": analysis.after_scene_source or "unknown",
            "ndvi_before": float(analysis.metrics.ndvi_before),
            "ndvi_after": float(analysis.metrics.ndvi_after),
            "ndwi_before": float(analysis.metrics.ndwi_before),
            "ndwi_after": float(analysis.metrics.ndwi_after),
            "evi_before": float(analysis.metrics.evi_before),
            "evi_after": float(analysis.metrics.evi_after),
            "damage_percentage": float(analysis.metrics.damage_percentage),
            "fused_damage": float(latest_decision.fused_damage) if latest_decision else None,
            "ndvi_damage": float(latest_decision.ndvi_damage) if latest_decision else None,
            "ndwi_damage": float(latest_decision.ndwi_damage) if latest_decision else None,
            "evi_damage": float(latest_decision.evi_damage) if latest_decision else None,
            "ai_damage": float(latest_decision.ai_damage) if latest_decision else None,
            "area_score": float(latest_decision.area_score) if latest_decision else None,
            "decision_confidence": float(latest_decision.confidence) if latest_decision else None,
            "decision": latest_decision.decision if latest_decision else "Pending",
            "decision_rationale": latest_decision.rationale if latest_decision else "Decision pending.",
            "ai_predicted_class": analysis.ai_prediction.predicted_class,
            "ai_damage_probability": float(analysis.ai_prediction.damage_probability),
            "before_rgb": before_rgb,
            "after_rgb": after_rgb,
            "ndvi_before_png": _heatmap_to_png(ndvi_before_map, "NDVI Before Damage", "RdYlGn"),
            "ndvi_after_png": _heatmap_to_png(ndvi_after_map, "NDVI After Damage", "RdYlGn"),
            "ndwi_before_png": _heatmap_to_png(ndwi_before_map, "NDWI Before Damage", "RdYlBu"),
            "ndwi_after_png": _heatmap_to_png(ndwi_after_map, "NDWI After Damage", "RdYlBu"),
            "evi_before_png": _heatmap_to_png(evi_before_map, "EVI Before Damage", "YlGn"),
            "evi_after_png": _heatmap_to_png(evi_after_map, "EVI After Damage", "YlGn"),
        }
        return self._generate_claim_report(payload)

    async def _cache_metadata(self, claim_id: int, report_id: int, analysis_run_id: int, file_path: str, mime_type: str) -> None:
        if self.redis is None:
            return
        cache_key = f"report:metadata:claim:{claim_id}"
        payload = {
            "id": report_id,
            "claim_id": claim_id,
            "analysis_run_id": analysis_run_id,
            "file_path_or_object_key": file_path,
            "mime_type": mime_type,
        }
        try:
            await asyncio.wait_for(
                self.redis.setex(
                    cache_key,
                    self.settings.report_metadata_cache_ttl_seconds,
                    json.dumps(payload).encode("utf-8"),
                ),
                timeout=2,
            )
        except Exception:
            pass

    def _generate_claim_report(self, payload: dict) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph("Agriculture Insurance Claim Assessment Report", styles["Title"]))
        story.append(Spacer(1, 0.2 * inch))

        info_rows = [
            ["Claim ID", str(payload["claim_id"])],
            ["Farmer Name", payload["farmer_name"]],
            ["Crop Type", payload["crop_type"]],
            ["Farm Area (ha)", f"{payload['farm_area']:.2f}"],
            ["Location", f"{payload['latitude']:.5f}, {payload['longitude']:.5f}"],
            ["Damage Date", payload["damage_date"]],
            ["Decision", payload["decision"]],
            [
                "Damage Percentage (Fused)",
                f"{payload['fused_damage']:.2f}%" if payload["fused_damage"] is not None else "N/A",
            ],
        ]
        if payload["decision_confidence"] is not None:
            info_rows.append(["Decision Confidence", f"{payload['decision_confidence'] * 100:.1f}%"])
        table = Table(info_rows, colWidths=[1.8 * inch, 4.6 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f1dd")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 0.25 * inch))

        stats_lines = [
            f"NDVI before damage: {payload['ndvi_before']:.3f} | NDVI after damage: {payload['ndvi_after']:.3f}",
            f"NDWI before damage: {payload['ndwi_before']:.3f} | NDWI after damage: {payload['ndwi_after']:.3f}",
            f"EVI before damage: {payload['evi_before']:.3f} | EVI after damage: {payload['evi_after']:.3f}",
            f"AI predicted class: {payload['ai_predicted_class']}",
            f"AI damage probability: {payload['ai_damage_probability']:.2f}",
        ]
        if payload["fused_damage"] is not None:
            stats_lines.append("Fused model calculation:")
            stats_lines.append(
                f"0.35xNDVI({payload['ndvi_damage']:.1f}%) + "
                f"0.15xNDWI({payload['ndwi_damage']:.1f}%) + "
                f"0.15xEVI({payload['evi_damage']:.1f}%) + "
                f"0.20xAI({payload['ai_damage']:.1f}%) + "
                f"0.15xArea({payload['area_score']:.1f}%) = {payload['fused_damage']:.1f}%"
            )
        else:
            stats_lines.append(f"Legacy NDVI damage estimate: {payload['damage_percentage']:.2f}%")
        stats_lines.append(f"Decision rationale: {payload['decision_rationale']}")

        stats_text = "<br/>".join(stats_lines)
        story.append(Paragraph(stats_text, styles["BodyText"]))
        story.append(Spacer(1, 0.2 * inch))

        figure_items = [
            ("Satellite Image Before Damage", array_to_png_bytes(payload["before_rgb"], title="Before Damage")),
            ("Satellite Image After Damage", array_to_png_bytes(payload["after_rgb"], title="After Damage")),
            ("NDVI Before Heatmap", payload["ndvi_before_png"]),
            ("NDVI After Heatmap", payload["ndvi_after_png"]),
            ("NDWI Before Heatmap", payload["ndwi_before_png"]),
            ("NDWI After Heatmap", payload["ndwi_after_png"]),
            ("EVI Before Heatmap", payload["evi_before_png"]),
            ("EVI After Heatmap", payload["evi_after_png"]),
        ]
        for title, image_bytes in figure_items:
            story.append(Paragraph(title, styles["Heading3"]))
            story.append(Image(BytesIO(image_bytes), width=4.8 * inch, height=3.6 * inch))
            story.append(Spacer(1, 0.12 * inch))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
