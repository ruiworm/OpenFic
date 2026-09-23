"""add extracted content metadata to agent attachments

Revision ID: 1022
Revises: 1021
Create Date: 2026-09-20 16:50:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1022"
down_revision: Union[str, Sequence[str], None] = "1021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_COLUMNS: tuple[tuple[str, sa.types.TypeEngine, bool], ...] = (
    ("content", sa.Text(), True),
    ("content_length", sa.Integer(), False),
    ("line_count", sa.Integer(), False),
)


def _existing_columns(table: str) -> dict[str, dict]:
    """读取目标表当前列信息，用于幂等判断。"""
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return {}
    return {column["name"]: column for column in inspector.get_columns(table)}


def upgrade() -> None:
    """Add attachment content metadata, skipping columns that already exist.

    桌面端存在多种升级路径（覆盖安装、降级回退、数据库由更高版本构建写入），
    因此这里对列做存在性判断，避免重复执行导致 duplicate column 启动失败。
    """
    existing = _existing_columns("agent_attachments")
    if not existing:
        return

    missing = [
        (name, type_, nullable)
        for name, type_, nullable in _NEW_COLUMNS
        if name not in existing
    ]

    if missing:
        with op.batch_alter_table("agent_attachments") as batch_op:
            for name, type_, nullable in missing:
                server_default = "0" if not nullable else None
                batch_op.add_column(
                    sa.Column(name, type_, nullable=nullable, server_default=server_default)
                )

    # width / height 需放宽为可空；已是可空则跳过。
    relax: list[str] = []
    for name in ("width", "height"):
        column = existing.get(name)
        if column is not None and not column.get("nullable", True):
            relax.append(name)
    if relax:
        with op.batch_alter_table("agent_attachments") as batch_op:
            for name in relax:
                batch_op.alter_column(
                    name,
                    existing_type=sa.Integer(),
                    nullable=True,
                )


def downgrade() -> None:
    existing = _existing_columns("agent_attachments")
    if not existing:
        return

    removable = [name for name, _, _ in _NEW_COLUMNS if name in existing]
    if removable:
        with op.batch_alter_table("agent_attachments") as batch_op:
            for name in reversed(removable):
                batch_op.drop_column(name)

    tighten = [
        name
        for name in ("width", "height")
        if name in existing and existing[name].get("nullable", True)
    ]
    if tighten:
        with op.batch_alter_table("agent_attachments") as batch_op:
            for name in tighten:
                batch_op.alter_column(
                    name,
                    existing_type=sa.Integer(),
                    nullable=False,
                )
