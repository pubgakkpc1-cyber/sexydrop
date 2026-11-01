"""Create case_odds: admin-edited prize weights per case (durable across deploys).

Revision ID: 0007_case_odds
Revises: 0006_game_sessions
Create Date: 2026-11-01
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0007_case_odds"
down_revision: Union[str, Sequence[str], None] = "0006_game_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "case_odds",
        sa.Column("case_id", sa.String(length=32), primary_key=True),
        sa.Column("weights", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("case_odds")
