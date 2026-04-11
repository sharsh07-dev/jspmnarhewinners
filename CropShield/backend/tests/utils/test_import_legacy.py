from __future__ import annotations

import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import Claim
from scripts.import_legacy_sqlite import import_claims


def _create_legacy_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE TABLE claims (
            claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            crop_type TEXT NOT NULL,
            farm_area REAL NOT NULL,
            damage_date TEXT NOT NULL,
            ndvi_before REAL NOT NULL,
            ndvi_after REAL NOT NULL,
            damage_percentage REAL NOT NULL,
            decision TEXT NOT NULL,
            decision_confidence REAL NOT NULL DEFAULT 0.0,
            decision_rationale TEXT NOT NULL DEFAULT '',
            ai_predicted_class TEXT NOT NULL DEFAULT '',
            ai_damage_probability REAL NOT NULL DEFAULT 0.0,
            ai_damaged_area_percentage REAL NOT NULL DEFAULT 0.0,
            satellite_source TEXT NOT NULL DEFAULT '',
            timestamp TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        INSERT INTO claims (
            claim_id, farmer_name, latitude, longitude, crop_type, farm_area, damage_date,
            ndvi_before, ndvi_after, damage_percentage, decision, decision_confidence,
            decision_rationale, ai_predicted_class, ai_damage_probability,
            ai_damaged_area_percentage, satellite_source, timestamp
        ) VALUES (
            1, 'Legacy Farmer', 18.5204, 73.8567, 'Rice', 2.5, '2023-08-01',
            0.52, 0.19, 63.46, 'Approved', 0.92,
            'Legacy rationale', 'Severe damage', 0.88,
            75.0, 'Demo synthetic scene', '2023-08-20T12:30:00'
        )
        """
    )
    conn.commit()
    conn.close()


def test_sqlite_import_script_maps_legacy_rows(tmp_path, monkeypatch) -> None:
    target_db = tmp_path / "target.db"
    sync_url = f"sqlite:///{target_db.as_posix()}"
    monkeypatch.setenv("SYNC_DATABASE_URL", sync_url)
    get_settings.cache_clear()

    engine = create_engine(sync_url, future=True)
    Base.metadata.create_all(engine)

    legacy_db = tmp_path / "legacy.db"
    _create_legacy_db(legacy_db)

    imported, skipped = import_claims(sqlite_path=legacy_db, dry_run=False)
    assert imported == 1
    assert skipped == 0

    try:
        with Session(engine) as session:
            claims = session.execute(select(Claim)).scalars().all()
            assert len(claims) == 1
            assert claims[0].id == 1
            assert claims[0].farmer_name == "Legacy Farmer"
    finally:
        engine.dispose()
