from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import secrets
from typing import Optional
import uuid

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cases_data import CASES_MAP, CaseDefinition, CaseEntry
from app.models.cases import CaseOpening, FreeCaseClaim
from app.models.catalog import CatalogGift, InventoryItem
from app.schemas.cases import CaseDefinitionRead, CaseEntryRead, OpenCaseResponse
from app.services.inventory_service import award_gift_to_user, get_catalog_gift_by_id
from app.services.ledger_service import (
    InsufficientFundsError,
    execute_balance_operation,
    get_user_balance,
)


def pick_weighted_gift(entries: tuple[CaseEntry, ...]) -> str:
    """Select a winning gift according to solver weights using CSPRNG."""
    total = sum(e.weight for e in entries)
    if total <= 0:
        return entries[0].gift_id
    r = secrets.randbelow(total)
    upto = 0
    for e in entries:
        upto += e.weight
        if r < upto:
            return e.gift_id
    return entries[-1].gift_id


def build_case_read_model(case: CaseDefinition) -> CaseDefinitionRead:
    total_weight = sum(e.weight for e in case.entries)
    entries_read = [
        CaseEntryRead(
            gift_id=e.gift_id,
            weight=e.weight,
            chance_percent=round((e.weight / total_weight) * 100, 2),
        )
        for e in case.entries
    ]
    return CaseDefinitionRead(
        id=case.id,
        name=case.name,
        price_gram=case.price_gram,
        is_free=case.is_free,
        free_cooldown_seconds=case.free_cooldown_seconds,
        is_new=case.is_new,
        glow=case.glow,
        entries=entries_read,
    )


async def check_free_case_cooldown(
    session: AsyncSession,
    user_id: uuid.UUID,
    case_id: str,
) -> tuple[bool, int, Optional[datetime]]:
    """Return (can_claim: bool, cooldown_remaining_seconds: int, last_claimed_at)."""
    case = CASES_MAP.get(case_id)
    if case is None or not case.is_free:
        return False, 0, None

    stmt = (
        select(FreeCaseClaim)
        .where(FreeCaseClaim.user_id == user_id, FreeCaseClaim.case_id == case_id)
        .order_by(desc(FreeCaseClaim.claimed_at))
        .limit(1)
    )
    result = await session.execute(stmt)
    last_claim = result.scalar_one_or_none()
    if last_claim is None:
        return True, 0, None

    now = datetime.now(timezone.utc)
    elapsed = (now - last_claim.claimed_at).total_seconds()
    cd = case.free_cooldown_seconds or 0
    if elapsed >= cd:
        return True, 0, last_claim.claimed_at
    remaining = int(cd - elapsed)
    return False, max(1, remaining), last_claim.claimed_at


async def open_case(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    case_id: str,
    client_request_id: Optional[str] = None,
) -> OpenCaseResponse:
    """Atomically open a paid or free case, verify balance/cooldown, award gift and record history."""
    case = CASES_MAP.get(case_id)
    if case is None:
        raise ValueError(f"Case '{case_id}' does not exist")

    # 1. Idempotency check: if client_request_id was already executed
    if client_request_id:
        stmt_existing = (
            select(CaseOpening)
            .options(
                selectinload(CaseOpening.gift),
                selectinload(CaseOpening.inventory_item),
            )
            .where(
                CaseOpening.user_id == user_id,
                CaseOpening.client_request_id == client_request_id,
            )
        )
        res_existing = await session.execute(stmt_existing)
        existing = res_existing.scalar_one_or_none()
        if existing is not None:
            cur_bal, _ = await get_user_balance(session, user_id)
            return OpenCaseResponse(
                case_id=existing.case_id,
                winning_gift_id=existing.gift_id,
                winning_gift_name=existing.gift.name,
                winning_gift_image_url=existing.gift.image_url,
                winning_gift_rarity=existing.gift.rarity,
                winning_gift_price_gram=existing.gift.price,
                inventory_item_id=existing.inventory_item_id,
                cost_gram=existing.cost_gram,
                new_balance_gram=cur_bal,
                is_new_open=False,
            )

    # 2. Check and enforce cooldown or balance debit
    if case.is_free:
        can_claim, remaining, _ = await check_free_case_cooldown(session, user_id, case_id)
        if not can_claim:
            raise ValueError(
                f"Free case is on cooldown. Please wait {remaining} seconds before claiming again."
            )
        # Record free claim
        claim = FreeCaseClaim(user_id=user_id, case_id=case_id)
        session.add(claim)
        new_balance_gram, _ = await get_user_balance(session, user_id)
    else:
        # Atomic debit from ledger
        debit_req_id = f"open-debit-{client_request_id}" if client_request_id else None
        tx, _ = await execute_balance_operation(
            session,
            user_id=user_id,
            type="case_open",
            direction="debit",
            amount_gram=case.price_gram,
            client_request_id=debit_req_id,
            description=f"Opened {case.name} case",
            metadata={"case_id": case.id},
        )
        new_balance_gram = tx.balance_after

    # 3. CSPRNG winning gift determination
    winning_gift_id = pick_weighted_gift(case.entries)
    gift = await get_catalog_gift_by_id(session, winning_gift_id)
    if gift is None:
        raise ValueError(f"Gift '{winning_gift_id}' not found in catalog")

    # 4. Award winning gift to user inventory
    award_req_id = f"open-award-{client_request_id}" if client_request_id else None
    item = await award_gift_to_user(
        session,
        user_id=user_id,
        gift_id=winning_gift_id,
        acquired_from=f"case:{case.id}",
        client_request_id=award_req_id,
    )

    # 5. Record case opening history
    opening = CaseOpening(
        user_id=user_id,
        case_id=case.id,
        gift_id=winning_gift_id,
        cost_gram=case.price_gram,
        client_request_id=client_request_id,
        inventory_item_id=item.id,
    )
    session.add(opening)
    await session.commit()

    # Emit real-time Live Drop event to SSE subscribers
    from app.core.realtime import broadcaster
    await broadcaster.broadcast_drop(
        user_name=f"User {str(user_id)[:6]}",
        gift_id=gift.id,
        gift_name=gift.name,
        rarity=gift.rarity,
        image_url=gift.image_url,
        case_id=case.id,
        price_gram=gift.price,
    )

    return OpenCaseResponse(
        case_id=case.id,
        winning_gift_id=gift.id,
        winning_gift_name=gift.name,
        winning_gift_image_url=gift.image_url,
        winning_gift_rarity=gift.rarity,
        winning_gift_price_gram=gift.price,
        inventory_item_id=item.id,
        cost_gram=case.price_gram,
        new_balance_gram=new_balance_gram,
        is_new_open=True,
    )
