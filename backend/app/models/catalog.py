from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CatalogGift(Base):
    __tablename__ = "catalog_gifts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    image_url: Mapped[str] = mapped_column(String(256), nullable=False)
    rarity: Mapped[str] = mapped_column(String(32), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(20, 3), nullable=False)
    price_source: Mapped[str] = mapped_column(String(32), nullable=False)
    price_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    collection: Mapped[str] = mapped_column(String(64), nullable=False)
    serial_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

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
    gift_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("catalog_gifts.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        default="available",
        nullable=False,
    )
    acquired_from: Mapped[str] = mapped_column(String(32), nullable=False)
    acquired_price: Mapped[Decimal] = mapped_column(Numeric(20, 3), nullable=False)
    sold_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 3), nullable=True)
    client_request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    acquired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    sold_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    gift: Mapped[CatalogGift] = relationship("CatalogGift", lazy="joined")

    __table_args__ = (
        Index("ix_inventory_items_user_status", "user_id", "status"),
        Index(
            "ix_inventory_items_user_req",
            "user_id",
            "client_request_id",
            unique=True,
            postgresql_where=mapped_column("client_request_id").is_not(None),
        ),
    )
