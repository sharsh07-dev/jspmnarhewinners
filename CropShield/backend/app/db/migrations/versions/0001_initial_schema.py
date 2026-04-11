"""Initial normalized schema for CropShield backend.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "claims",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("farmer_name", sa.String(length=255), nullable=False),
        sa.Column("crop_type", sa.String(length=80), nullable=False),
        sa.Column("farm_area_hectares", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=False),
        sa.Column("damage_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="created"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_claims_farmer_name", "claims", ["farmer_name"])
    op.create_index("ix_claims_crop_type", "claims", ["crop_type"])
    op.create_index("ix_claims_damage_date", "claims", ["damage_date"])
    op.create_index("ix_claims_status", "claims", ["status"])

    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("status_message", sa.Text(), nullable=True),
        sa.Column("gap_before", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("gap_after", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("window_days", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("max_cloud_threshold", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("before_scene_date", sa.Date(), nullable=True),
        sa.Column("after_scene_date", sa.Date(), nullable=True),
        sa.Column("before_scene_source", sa.String(length=120), nullable=True),
        sa.Column("after_scene_source", sa.String(length=120), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_analysis_runs_claim_id", "analysis_runs", ["claim_id"])
    op.create_index("ix_analysis_runs_status", "analysis_runs", ["status"])

    op.create_table(
        "index_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ndvi_before", sa.Numeric(precision=8, scale=5), nullable=False),
        sa.Column("ndvi_after", sa.Numeric(precision=8, scale=5), nullable=False),
        sa.Column("ndwi_before", sa.Numeric(precision=8, scale=5), nullable=False, server_default="0"),
        sa.Column("ndwi_after", sa.Numeric(precision=8, scale=5), nullable=False, server_default="0"),
        sa.Column("evi_before", sa.Numeric(precision=8, scale=5), nullable=False, server_default="0"),
        sa.Column("evi_after", sa.Numeric(precision=8, scale=5), nullable=False, server_default="0"),
        sa.Column("damage_percentage", sa.Numeric(precision=8, scale=3), nullable=False),
        sa.UniqueConstraint("analysis_run_id"),
    )
    op.create_index("ix_index_metrics_analysis_run_id", "index_metrics", ["analysis_run_id"])

    op.create_table(
        "ai_predictions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_version", sa.String(length=80), nullable=False, server_default="heuristic-v1"),
        sa.Column("predicted_class", sa.String(length=80), nullable=False),
        sa.Column("damage_probability", sa.Numeric(precision=8, scale=5), nullable=False),
        sa.Column("damaged_area_percentage", sa.Numeric(precision=8, scale=3), nullable=False),
        sa.Column("class_probabilities_json", sa.JSON(), nullable=True),
        sa.UniqueConstraint("analysis_run_id"),
    )
    op.create_index("ix_ai_predictions_analysis_run_id", "ai_predictions", ["analysis_run_id"])

    op.create_table(
        "decisions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("decision", sa.String(length=40), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=8, scale=5), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("rules_version", sa.String(length=80), nullable=False, server_default="v1-streamlit-compatible"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_decisions_claim_id", "decisions", ["claim_id"])
    op.create_index("ix_decisions_analysis_run_id", "decisions", ["analysis_run_id"])
    op.create_index("ix_decisions_decision", "decisions", ["decision"])

    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_run_id", sa.Integer(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path_or_object_key", sa.String(length=1024), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False, server_default="application/pdf"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reports_claim_id", "reports", ["claim_id"])
    op.create_index("ix_reports_analysis_run_id", "reports", ["analysis_run_id"])

    op.create_table(
        "job_status",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_job_status_job_type", "job_status", ["job_type"])
    op.create_index("ix_job_status_resource_id", "job_status", ["resource_id"])
    op.create_index("ix_job_status_status", "job_status", ["status"])


def downgrade() -> None:
    op.drop_index("ix_job_status_status", table_name="job_status")
    op.drop_index("ix_job_status_resource_id", table_name="job_status")
    op.drop_index("ix_job_status_job_type", table_name="job_status")
    op.drop_table("job_status")

    op.drop_index("ix_reports_analysis_run_id", table_name="reports")
    op.drop_index("ix_reports_claim_id", table_name="reports")
    op.drop_table("reports")

    op.drop_index("ix_decisions_decision", table_name="decisions")
    op.drop_index("ix_decisions_analysis_run_id", table_name="decisions")
    op.drop_index("ix_decisions_claim_id", table_name="decisions")
    op.drop_table("decisions")

    op.drop_index("ix_ai_predictions_analysis_run_id", table_name="ai_predictions")
    op.drop_table("ai_predictions")

    op.drop_index("ix_index_metrics_analysis_run_id", table_name="index_metrics")
    op.drop_table("index_metrics")

    op.drop_index("ix_analysis_runs_status", table_name="analysis_runs")
    op.drop_index("ix_analysis_runs_claim_id", table_name="analysis_runs")
    op.drop_table("analysis_runs")

    op.drop_index("ix_claims_status", table_name="claims")
    op.drop_index("ix_claims_damage_date", table_name="claims")
    op.drop_index("ix_claims_crop_type", table_name="claims")
    op.drop_index("ix_claims_farmer_name", table_name="claims")
    op.drop_table("claims")
