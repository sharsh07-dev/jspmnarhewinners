"""Add fusion breakdown fields to decisions.

Revision ID: 0003_decision_fusion_fields
Revises: 0002_farm_profiles_admin
Create Date: 2026-04-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_decision_fusion_fields"
down_revision = "0002_farm_profiles_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("decisions", sa.Column("fused_damage", sa.Numeric(precision=8, scale=3), nullable=False, server_default="0.0"))
    op.add_column("decisions", sa.Column("ndvi_damage", sa.Numeric(precision=8, scale=3), nullable=False, server_default="0.0"))
    op.add_column("decisions", sa.Column("ndwi_damage", sa.Numeric(precision=8, scale=3), nullable=False, server_default="0.0"))
    op.add_column("decisions", sa.Column("evi_damage", sa.Numeric(precision=8, scale=3), nullable=False, server_default="0.0"))
    op.add_column("decisions", sa.Column("ai_damage", sa.Numeric(precision=8, scale=3), nullable=False, server_default="0.0"))
    op.add_column("decisions", sa.Column("area_score", sa.Numeric(precision=8, scale=3), nullable=False, server_default="0.0"))


def downgrade() -> None:
    op.drop_column("decisions", "area_score")
    op.drop_column("decisions", "ai_damage")
    op.drop_column("decisions", "evi_damage")
    op.drop_column("decisions", "ndwi_damage")
    op.drop_column("decisions", "ndvi_damage")
    op.drop_column("decisions", "fused_damage")
