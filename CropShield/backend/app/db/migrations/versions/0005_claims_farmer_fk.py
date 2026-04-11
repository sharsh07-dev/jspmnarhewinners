"""Add farmer_user_id to claims.

Revision ID: 0005_claims_farmer_fk
Revises: 0004_farmer_users
Create Date: 2026-04-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0005_claims_farmer_fk"
down_revision = "0004_farmer_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "claims",
        sa.Column("farmer_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_claims_farmer_user_id_farmer_users"),
        "claims",
        "farmer_users",
        ["farmer_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_claims_farmer_user_id"), "claims", ["farmer_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_claims_farmer_user_id"), table_name="claims")
    op.drop_constraint(op.f("fk_claims_farmer_user_id_farmer_users"), "claims", type_="foreignkey")
    op.drop_column("claims", "farmer_user_id")
