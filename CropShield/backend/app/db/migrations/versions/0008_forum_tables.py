"""Add forum posts and replies tables.

Revision ID: 0008_forum_tables
Revises: 0007_audit_log
Create Date: 2026-04-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0008_forum_tables"
down_revision = "0007_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "forum_posts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_forum_posts_title"), "forum_posts", ["title"], unique=False)
    op.create_index(op.f("ix_forum_posts_author"), "forum_posts", ["author"], unique=False)

    op.create_table(
        "forum_replies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("forum_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_forum_replies_post_id"), "forum_replies", ["post_id"], unique=False)
    op.create_index(op.f("ix_forum_replies_author"), "forum_replies", ["author"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_forum_replies_author"), table_name="forum_replies")
    op.drop_index(op.f("ix_forum_replies_post_id"), table_name="forum_replies")
    op.drop_table("forum_replies")

    op.drop_index(op.f("ix_forum_posts_author"), table_name="forum_posts")
    op.drop_index(op.f("ix_forum_posts_title"), table_name="forum_posts")
    op.drop_table("forum_posts")
