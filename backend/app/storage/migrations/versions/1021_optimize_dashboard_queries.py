"""add indexes for dashboard filters and date ranges

Revision ID: 1021
Revises: 1020
Create Date: 2026-08-27
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1021"
down_revision: Union[str, Sequence[str], None] = "1020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


AUDIT_INDEXES: tuple[tuple[str, list[str]], ...] = (
    ("ix_agent_audit_logs_project_id_created_at", ["project_id", "created_at"]),
    ("ix_agent_audit_logs_model_provider_created_at", ["model_provider", "created_at"]),
    ("ix_agent_audit_logs_model_id_created_at", ["model_id", "created_at"]),
    ("ix_agent_audit_logs_operation_created_at", ["operation", "created_at"]),
    ("ix_agent_audit_logs_task_id_created_at", ["task_id", "created_at"]),
    ("ix_agent_audit_logs_session_id_created_at", ["session_id", "created_at"]),
)

WRITING_ACTIVITY_INDEXES: tuple[tuple[str, list[str]], ...] = (
    (
        "ix_writing_activity_events_project_id_created_at",
        ["project_id", "created_at"],
    ),
    ("ix_writing_activity_events_source_created_at", ["source", "created_at"]),
    (
        "ix_writing_activity_events_project_source_created_at",
        ["project_id", "source", "created_at"],
    ),
)


def _existing_indexes(table: str) -> set[str]:
    """读取目标表当前索引名，用于幂等判断。"""
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(table)}


def _create_missing(indexes: tuple[tuple[str, list[str]], ...]) -> None:
    """仅创建尚不存在的索引，已存在则跳过。"""
    for name, columns in indexes:
        table = "agent_audit_logs" if name.startswith("ix_agent_audit_logs_") else "writing_activity_events"
        if name in _existing_indexes(table):
            continue
        op.create_index(name, table, columns, unique=False)


def upgrade() -> None:
    """Add indexes used by dashboard filtering and date ranges.

    桌面端存在覆盖安装、版本回退等路径，索引可能已由更高版本建好，
    因此先做存在性判断，避免 index already exists 导致启动失败。
    """
    _create_missing(AUDIT_INDEXES)
    _create_missing(WRITING_ACTIVITY_INDEXES)


def downgrade() -> None:
    """Remove dashboard query indexes, skipping ones that are absent."""
    for name, _columns in reversed(WRITING_ACTIVITY_INDEXES):
        if name in _existing_indexes("writing_activity_events"):
            op.drop_index(name, table_name="writing_activity_events")
    for name, _columns in reversed(AUDIT_INDEXES):
        if name in _existing_indexes("agent_audit_logs"):
            op.drop_index(name, table_name="agent_audit_logs")
