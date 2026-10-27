from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.catalog import CatalogGift, InventoryItem


class FreeCaseClaim(Base):
    __tablename__ = "free_case_claims"

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
    case_id: Mapped[str] = mapped_column(String(32), nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_free_case_claims_user_case", "user_id", "case_id", "claimed_at"),
    )


class CaseOpening(Base):
    __tablename__ = "case_openings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    case_id: Mapped[str] = mapped_column(String(32), nullable=False)
    gift_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("catalog_gifts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    cost_gram: Mapped[Decimal] = mapped_column(Numeric(20, 3), nullable=False)
    client_request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    gift: Mapped[CatalogGift] = relationship("CatalogGift", lazy="joined")
    inventory_item: Mapped[InventoryItem] = relationship("InventoryItem", lazy="joined")

    __table_args__ = (
        Index(
            "ix_case_openings_user_req",
            "user_id",
            "client_request_id",
            unique=True,
            postgresql_where=mapped_column("client_request_id").is_not(None),
        ),
    )
