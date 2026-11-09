"""Таблицы серверной экономики: предметы игроков, раунды игр, пополнения, выводы, звёзды, рефералы."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)


class NftItem(Base):
    """Подарок игрока. status: available | quest_pending | withdraw_pending | withdrawn | sold | burned | expired."""

    __tablename__ = "nft_items"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    gift_id: Mapped[str] = mapped_column(String(64), nullable=False)
    price_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available")
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_nft_items_user_status", "user_id", "status"),)


class PlayRound(Base):
    """Одна игровая операция (кейс, апгрейд, раунд мин, ставка ракетки). Идемпотентна по (user, game, request_id)."""

    __tablename__ = "play_rounds"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    game: Mapped[str] = mapped_column(String(16), nullable=False)
    request_id: Mapped[str] = mapped_column(String(64), nullable=False)
    case_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    bet_minor: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    payout_minor: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="done")
    # секретное состояние раунда (раскладка мин, цель автовывода) — клиенту не отдаётся
    state: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    # ответ клиенту, по нему повторный запрос с тем же request_id возвращает тот же результат
    result: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "game", "request_id", name="uq_play_rounds_request"),
        Index("ix_play_rounds_user_game", "user_id", "game", "status"),
    )


class DepositOrder(Base):
    """Заказ на пополнение: привязка секрета платежа к игроку. Зачисление один раз по external_id."""

    __tablename__ = "deposit_orders"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    provider: Mapped[str] = mapped_column(String(16), nullable=False)  # cryptobot | ton | stars
    secret: Mapped[str] = mapped_column(String(64), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")  # pending | paid
    external_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("provider", "secret", name="uq_deposit_orders_secret"),
        Index("uq_deposit_orders_external", "provider", "external_id", unique=True),
    )


class UserMeta(Base):
    """Звёзды, забранные задания, состояние бесплатных кейсов, признак Premium."""

    __tablename__ = "user_meta"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quests_claimed: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    free_state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_premium: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Withdrawal(Base):
    """Заявка на вывод подарка владельцу аккаунта выдач. status: pending | done | rejected."""

    __tablename__ = "withdrawals"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _user_fk()
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nft_items.id"), nullable=False)
    gift_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    done_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # контрольная проверка цены при выводе: причина ручной проверки и рыночная цена на тот момент
    review_reason: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    market_minor: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
