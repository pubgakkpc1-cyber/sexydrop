"""Create case_openings and free_case_claims tables.

Revision ID: 0005_cases
Revises: 0004_inventory_and_catalog
Create Date: 2026-10-27
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005_cases"
down_revision: Union[str, Sequence[str], None] = "0004_inventory_and_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Free case claims
    op.create_table(
        "free_case_claims",
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
        sa.Column("case_id", sa.String(length=32), nullable=False),
        sa.Column(
            "claimed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_free_case_claims_user_case",
        "free_case_claims",
        ["user_id", "case_id", "claimed_at"],
        unique=False,
    )

    # 2. Case openings history
    op.create_table(
        "case_openings",
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
        sa.Column("case_id", sa.String(length=32), nullable=False),
        sa.Column(
            "gift_id",
            sa.String(length=64),
            sa.ForeignKey("catalog_gifts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("cost_gram", sa.Numeric(precision=20, scale=3), nullable=False),
        sa.Column("client_request_id", sa.String(length=64), nullable=True),
        sa.Column(
            "inventory_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("inventory_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_case_openings_user_id", "case_openings", ["user_id"], unique=False)
    op.create_index(
        "ix_case_openings_user_req",
        "case_openings",
        ["user_id", "client_request_id"],
        unique=True,
        postgresql_where=sa.text("client_request_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_case_openings_user_req", table_name="case_openings")
    op.drop_index("ix_case_openings_user_id", table_name="case_openings")
    op.drop_table("case_openings")
    op.drop_index("ix_free_case_claims_user_case", table_name="free_case_claims")
    op.drop_table("free_case_claims")
