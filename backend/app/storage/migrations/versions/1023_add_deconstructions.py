"""add deconstructions table

Revision ID: 1023
Revises: 1022
Create Date: 2026-09-20
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1023"
down_revision: Union[str, Sequence[str], None] = "1022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "deconstructions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, server_default="小说深度拆解分析"),
        sa.Column("source_title", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("source_preview", sa.String(), nullable=False, server_default=""),
        sa.Column("source_word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("model_id", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("prompt_template", sa.Text(), nullable=False, server_default=""),
        sa.Column("report_markdown", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_deconstructions_updated_at"), "deconstructions", ["updated_at"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("deconstructions")
