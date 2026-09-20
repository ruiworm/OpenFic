"""add foreshadowings table

Revision ID: 1022
Revises: 1021
Create Date: 2026-09-20
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1022"
down_revision: Union[str, Sequence[str], None] = "1021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "foreshadowings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="planted"),
        sa.Column("importance", sa.String(length=50), nullable=False, server_default="major"),
        sa.Column("planted_chapter_id", sa.String(), nullable=True),
        sa.Column("target_chapter_id", sa.String(length=100), nullable=True),
        sa.Column("resolved_chapter_id", sa.String(), nullable=True),
        sa.Column("character_ids", sa.String(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.String(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["planted_chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["resolved_chapter_id"], ["chapters.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_foreshadowings_project_id"), "foreshadowings", ["project_id"], unique=False)
    op.create_index(op.f("ix_foreshadowings_status"), "foreshadowings", ["status"], unique=False)
    op.create_index(op.f("ix_foreshadowings_importance"), "foreshadowings", ["importance"], unique=False)
    op.create_index(op.f("ix_foreshadowings_planted_chapter_id"), "foreshadowings", ["planted_chapter_id"], unique=False)
    op.create_index(op.f("ix_foreshadowings_resolved_chapter_id"), "foreshadowings", ["resolved_chapter_id"], unique=False)
    op.create_index(op.f("ix_foreshadowings_updated_at"), "foreshadowings", ["updated_at"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("foreshadowings")
