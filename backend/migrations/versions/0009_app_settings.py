"""Create app_settings (key/value) and start profit stats from now.

Revision ID: 0009_app_settings
Revises: 0008_economy
Create Date: 2026-11-07
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009_app_settings"
down_revision: Union[str, Sequence[str], None] = "0008_economy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=64), primary_key=True),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    # по просьбе владельца: прибыль в админке считается заново с момента этого деплоя
    op.execute(
        "INSERT INTO app_settings (key, value) "
        "VALUES ('profit_reset_at', jsonb_build_object('at', extract(epoch from now())))"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
