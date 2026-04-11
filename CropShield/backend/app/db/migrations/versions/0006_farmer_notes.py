"""Add farmer_notes to claims.

Revision ID: 0006_farmer_notes
Revises: 0005_claims_farmer_fk
Create Date: 2026-04-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_farmer_notes"
down_revision = "0005_claims_farmer_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("claims", sa.Column("farmer_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("claims", "farmer_notes")
