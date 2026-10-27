"""PostgreSQL foundation: pgcrypto and GRAM NUMERIC domain.

Revision ID: 0001_foundation
Revises:
Create Date: 2026-10-27
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0001_foundation"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute(
        """
        CREATE DOMAIN gram_amount AS NUMERIC(20, 3)
            CONSTRAINT gram_amount_non_negative CHECK (VALUE >= 0)
        """
    )


def downgrade() -> None:
    op.execute("DROP DOMAIN IF EXISTS gram_amount")
    op.execute("DROP EXTENSION IF EXISTS pgcrypto")
