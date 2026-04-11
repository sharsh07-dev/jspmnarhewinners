"""Add claim audit log table.

Revision ID: 0007_audit_log
Revises: 0006_farmer_notes
Create Date: 2026-04-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0007_audit_log"
down_revision = "0006_farmer_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "claim_audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor", sa.String(length=120), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("old_status", sa.String(length=40), nullable=True),
        sa.Column("new_status", sa.String(length=40), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_claim_audit_log_claim_id"), "claim_audit_log", ["claim_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_claim_audit_log_claim_id"), table_name="claim_audit_log")
    op.drop_table("claim_audit_log")
