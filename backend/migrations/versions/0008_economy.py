"""Server-authoritative economy: items, play rounds, deposit orders, user meta, withdrawals.

Revision ID: 0008_economy
Revises: 0007_case_odds
Create Date: 2026-11-01
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0008_economy"
down_revision: Union[str, Sequence[str], None] = "0007_case_odds"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NOW = sa.text("now()")


def _user_fk() -> sa.Column:
    return sa.Column(
        "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "nft_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column("gift_id", sa.String(64), nullable=False),
        sa.Column("price_minor", sa.BigInteger, nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_nft_items_user_id", "nft_items", ["user_id"])
    op.create_index("ix_nft_items_user_status", "nft_items", ["user_id", "status"])

    op.create_table(
        "play_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column("game", sa.String(16), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=False),
        sa.Column("case_id", sa.String(32), nullable=True),
        sa.Column("bet_minor", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("payout_minor", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="done"),
        sa.Column("state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("user_id", "game", "request_id", name="uq_play_rounds_request"),
    )
    op.create_index("ix_play_rounds_user_id", "play_rounds", ["user_id"])
    op.create_index("ix_play_rounds_user_game", "play_rounds", ["user_id", "game", "status"])
    op.create_index("ix_play_rounds_created_at", "play_rounds", ["created_at"])

    op.create_table(
        "deposit_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("secret", sa.String(64), nullable=False),
        sa.Column("amount_minor", sa.BigInteger, nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("external_id", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("provider", "secret", name="uq_deposit_orders_secret"),
    )
    op.create_index("ix_deposit_orders_user_id", "deposit_orders", ["user_id"])
    op.create_index(
        "uq_deposit_orders_external",
        "deposit_orders",
        ["provider", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )

    op.create_table(
        "user_meta",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("stars", sa.Integer, nullable=False, server_default="0"),
        sa.Column("quests_claimed", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("free_state", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("is_premium", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )

    op.create_table(
        "withdrawals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        _user_fk(),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nft_items.id"), nullable=False),
        sa.Column("gift_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_withdrawals_user_id", "withdrawals", ["user_id"])


def downgrade() -> None:
    for table in ("withdrawals", "user_meta", "deposit_orders", "play_rounds", "nft_items"):
        op.drop_table(table)
