from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AIPrediction, AnalysisRun, Claim, Decision, IndexMetric


def parse_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.now(tz=timezone.utc)
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(tz=timezone.utc)


def import_claims(sqlite_path: Path, dry_run: bool = False) -> tuple[int, int]:
    settings = get_settings()
    engine = create_engine(settings.sync_database_url, future=True)
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM claims ORDER BY claim_id ASC").fetchall()
    imported = 0
    skipped = 0

    with Session(engine) as session:
        for row in rows:
            claim_id = int(row["claim_id"])
            exists_stmt = select(Claim.id).where(Claim.id == claim_id)
            already_exists = session.execute(exists_stmt).scalar_one_or_none()
            if already_exists is not None:
                skipped += 1
                continue

            recorded_at = parse_timestamp(row["timestamp"])
            claim = Claim(
                id=claim_id,
                farmer_name=row["farmer_name"],
                crop_type=row["crop_type"],
                farm_area_hectares=float(row["farm_area"]),
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                damage_date=datetime.strptime(row["damage_date"], "%Y-%m-%d").date(),
                status="analysis_completed",
                created_at=recorded_at,
                updated_at=recorded_at,
            )
            session.add(claim)
            session.flush()

            analysis_run = AnalysisRun(
                claim_id=claim_id,
                status="completed",
                status_message="Imported from legacy SQLite database.",
                gap_before=5,
                gap_after=5,
                window_days=10,
                max_cloud_threshold=100,
                before_scene_source=row["satellite_source"] or "legacy-sqlite",
                after_scene_source=row["satellite_source"] or "legacy-sqlite",
                started_at=recorded_at,
                completed_at=recorded_at,
            )
            session.add(analysis_run)
            session.flush()

            session.add(
                IndexMetric(
                    analysis_run_id=analysis_run.id,
                    ndvi_before=float(row["ndvi_before"]),
                    ndvi_after=float(row["ndvi_after"]),
                    ndwi_before=0.0,
                    ndwi_after=0.0,
                    evi_before=0.0,
                    evi_after=0.0,
                    damage_percentage=float(row["damage_percentage"]),
                )
            )
            session.add(
                AIPrediction(
                    analysis_run_id=analysis_run.id,
                    model_version="legacy-sqlite-import",
                    predicted_class=row["ai_predicted_class"] or "Unknown",
                    damage_probability=float(row["ai_damage_probability"] or 0.0),
                    damaged_area_percentage=float(row["ai_damaged_area_percentage"] or 0.0),
                    class_probabilities_json=None,
                )
            )
            session.add(
                Decision(
                    claim_id=claim_id,
                    analysis_run_id=analysis_run.id,
                    decision=row["decision"],
                    confidence=float(row["decision_confidence"] or 0.0),
                    rationale=row["decision_rationale"] or "Imported from legacy rationale.",
                    rules_version="legacy-streamlit",
                    created_at=recorded_at,
                )
            )
            imported += 1

        if dry_run:
            session.rollback()
        else:
            session.commit()
            if engine.dialect.name == "postgresql":
                session.execute(text("SELECT setval('claims_id_seq', (SELECT COALESCE(MAX(id), 1) FROM claims))"))
                session.commit()

    conn.close()
    return imported, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import legacy CropShield SQLite data into the new PostgreSQL schema.")
    parser.add_argument(
        "--sqlite-path",
        default=str(Path(__file__).resolve().parents[2] / "data" / "claims.db"),
        help="Path to legacy SQLite claims database.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Run import without committing changes.")
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite_path).resolve()
    if not sqlite_path.exists():
        raise FileNotFoundError(f"Legacy SQLite database not found at '{sqlite_path}'.")

    imported, skipped = import_claims(sqlite_path=sqlite_path, dry_run=args.dry_run)
    print(f"Import complete. Imported: {imported}, skipped(existing): {skipped}, dry_run={args.dry_run}")


if __name__ == "__main__":
    main()
