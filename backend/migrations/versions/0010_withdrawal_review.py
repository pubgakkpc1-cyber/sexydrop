from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_withdrawal_review"
down_revision: Union[str, Sequence[str], None] = "0009_app_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("withdrawals", sa.Column("review_reason", sa.String(length=300), nullable=True))
    op.add_column("withdrawals", sa.Column("market_minor", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("withdrawals", "market_minor")
    op.drop_column("withdrawals", "review_reason")
