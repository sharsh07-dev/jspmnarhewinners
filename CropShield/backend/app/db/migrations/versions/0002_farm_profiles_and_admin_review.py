"""Add farm profiles and admin-review fields for claims.

Revision ID: 0002_farm_profiles_admin
Revises: 0001_initial_schema
Create Date: 2026-04-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_farm_profiles_admin"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "farm_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("farmer_name", sa.String(length=255), nullable=False),
        sa.Column("owner_names_json", sa.JSON(), nullable=False),
        sa.Column("survey_numbers_json", sa.JSON(), nullable=False),
        sa.Column("area_values_json", sa.JSON(), nullable=False),
        sa.Column("automation_raw_text", sa.Text(), nullable=True),
        sa.Column("state_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("category_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("district_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("taluka_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("village_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("plot_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("state_name", sa.String(length=120), nullable=True),
        sa.Column("category_name", sa.String(length=120), nullable=True),
        sa.Column("district_name", sa.String(length=120), nullable=True),
        sa.Column("taluka_name", sa.String(length=120), nullable=True),
        sa.Column("village_name", sa.String(length=120), nullable=True),
        sa.Column("plot_name", sa.String(length=120), nullable=True),
        sa.Column("extent_min_x", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("extent_min_y", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("extent_max_x", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("extent_max_y", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("extent_polygon_json", sa.JSON(), nullable=True),
        sa.Column("centroid_latitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("centroid_longitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("farm_area_hectares", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("screenshot_path", sa.String(length=1024), nullable=True),
        sa.Column("automation_source", sa.String(length=120), nullable=False, server_default="mahabhunakasha"),
        sa.Column("automation_status_message", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_farm_profiles_farmer_name", "farm_profiles", ["farmer_name"])

    op.add_column("claims", sa.Column("farm_profile_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_claims_farm_profile_id_farm_profiles",
        source_table="claims",
        referent_table="farm_profiles",
        local_cols=["farm_profile_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_claims_farm_profile_id", "claims", ["farm_profile_id"])

    op.add_column("claims", sa.Column("admin_status", sa.String(length=40), nullable=False, server_default="pending_review"))
    op.add_column("claims", sa.Column("admin_notes", sa.Text(), nullable=True))
    op.add_column("claims", sa.Column("reviewed_by", sa.String(length=120), nullable=True))
    op.add_column("claims", sa.Column("recommended_insurance_amount", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column(
        "claims",
        sa.Column("pmfby_reference_url", sa.String(length=255), nullable=False, server_default="https://pmfby.gov.in/"),
    )
    op.add_column("claims", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_claims_admin_status", "claims", ["admin_status"])


def downgrade() -> None:
    op.drop_index("ix_claims_admin_status", table_name="claims")
    op.drop_column("claims", "reviewed_at")
    op.drop_column("claims", "pmfby_reference_url")
    op.drop_column("claims", "recommended_insurance_amount")
    op.drop_column("claims", "reviewed_by")
    op.drop_column("claims", "admin_notes")
    op.drop_column("claims", "admin_status")

    op.drop_index("ix_claims_farm_profile_id", table_name="claims")
    op.drop_constraint("fk_claims_farm_profile_id_farm_profiles", table_name="claims", type_="foreignkey")
    op.drop_column("claims", "farm_profile_id")

    op.drop_index("ix_farm_profiles_farmer_name", table_name="farm_profiles")
    op.drop_table("farm_profiles")
