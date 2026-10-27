"""Create game_rounds table.

Revision ID: 0006_game_sessions
Revises: 0005_cases
Create Date: 2026-10-27
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006_game_sessions"
down_revision: Union[str, Sequence[str], None] = "0005_cases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_rounds",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("game_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("bet_amount", sa.Numeric(precision=20, scale=3), nullable=False),
        sa.Column(
            "win_amount",
            sa.Numeric(precision=20, scale=3),
            server_default=sa.text("0.000"),
            nullable=False,
        ),
        sa.Column(
            "multiplier",
            sa.Numeric(precision=20, scale=4),
            server_default=sa.text("0.0000"),
            nullable=False,
        ),
        sa.Column("client_request_id", sa.String(length=64), nullable=True),
        sa.Column("server_seed", sa.String(length=64), nullable=False),
        sa.Column(
            "game_state",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_game_rounds_user_type", "game_rounds", ["user_id", "game_type"], unique=False)
    op.create_index("ix_game_rounds_user_status", "game_rounds", ["user_id", "status"], unique=False)
    op.create_index(
        "ix_game_rounds_user_req",
        "game_rounds",
        ["user_id", "client_request_id"],
        unique=True,
        postgresql_where=sa.text("client_request_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_game_rounds_user_req", table_name="game_rounds")
    op.drop_index("ix_game_rounds_user_status", table_name="game_rounds")
    op.drop_index("ix_game_rounds_user_type", table_name="game_rounds")
    op.drop_table("game_rounds")
