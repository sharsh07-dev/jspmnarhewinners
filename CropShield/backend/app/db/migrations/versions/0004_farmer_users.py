"""Add farmer_users table.

Revision ID: 0004_farmer_users
Revises: 0003_decision_fusion_fields
Create Date: 2026-04-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_farmer_users"
down_revision = "0003_decision_fusion_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "farmer_users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("picture_url", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_farmer_users_email"), "farmer_users", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_farmer_users_email"), table_name="farmer_users")
    op.drop_table("farmer_users")