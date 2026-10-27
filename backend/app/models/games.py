from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User


class GameRound(Base):
    __tablename__ = "game_rounds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    game_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    bet_amount: Mapped[Decimal] = mapped_column(Numeric(20, 3), nullable=False)
    win_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 3),
        default=Decimal("0.000"),
        nullable=False,
    )
    multiplier: Mapped[Decimal] = mapped_column(
        Numeric(20, 4),
        default=Decimal("0.0000"),
        nullable=False,
    )
    client_request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    server_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    game_state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped[User] = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("ix_game_rounds_user_type", "user_id", "game_type"),
        Index("ix_game_rounds_user_status", "user_id", "status"),
        Index(
            "ix_game_rounds_user_req",
            "user_id",
            "client_request_id",
            unique=True,
            postgresql_where=mapped_column("client_request_id").is_not(None),
        ),
    )
