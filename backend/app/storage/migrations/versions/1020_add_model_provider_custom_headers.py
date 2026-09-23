"""add encrypted custom headers to model providers

Revision ID: 1020
Revises: 1019
Create Date: 2026-08-26 10:30:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1020"
down_revision: Union[str, Sequence[str], None] = "1019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_COLUMN_NAME = "custom_headers_encrypted"


def _existing_columns(table: str) -> set[str]:
    """读取目标表当前列名，用于幂等判断。"""
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    """Add the encrypted custom headers column, skipping it if already present.

    桌面端存在覆盖安装、版本回退等路径，数据库可能已经包含该列，
    因此先做存在性判断，避免 duplicate column 导致启动失败。
    """
    if _COLUMN_NAME in _existing_columns("model_providers"):
        return
    op.add_column(
        "model_providers",
        sa.Column(
            _COLUMN_NAME,
            sa.Text(),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    """Drop the column only when it is actually present."""
    if _COLUMN_NAME not in _existing_columns("model_providers"):
        return
    op.drop_column("model_providers", _COLUMN_NAME)
