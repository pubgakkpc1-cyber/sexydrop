from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cases_data import CASES_MAP
from app.core.db import get_session
from app.models.user import User
from app.schemas.cases import (
    CaseDefinitionRead,
    FreeCaseStatus,
    OpenCaseRequest,
    OpenCaseResponse,
)
from app.services.case_service import (
    build_case_read_model,
    check_free_case_cooldown,
    open_case,
)
from app.services.ledger_service import InsufficientFundsError

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("", response_model=list[CaseDefinitionRead])
async def list_cases() -> list[CaseDefinitionRead]:
    return [build_case_read_model(c) for c in CASES_MAP.values()]


@router.get("/free/status", response_model=list[FreeCaseStatus])
async def get_free_cases_status(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FreeCaseStatus]:
    statuses: list[FreeCaseStatus] = []
    for case_id in ("free", "free24"):
        can_claim, remaining, last_claim = await check_free_case_cooldown(
            session, current_user.id, case_id
        )
        statuses.append(
            FreeCaseStatus(
                case_id=case_id,
                can_claim=can_claim,
                cooldown_remaining_seconds=remaining,
                last_claimed_at=last_claim,
            )
        )
    return statuses


@router.get("/{case_id}", response_model=CaseDefinitionRead)
async def get_case(case_id: str) -> CaseDefinitionRead:
    case = CASES_MAP.get(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case '{case_id}' does not exist",
        )
    return build_case_read_model(case)


@router.post("/{case_id}/open", response_model=OpenCaseResponse)
async def open_case_endpoint(
    case_id: str,
    payload: OpenCaseRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> OpenCaseResponse:
    try:
        result = await open_case(
            session,
            user_id=current_user.id,
            case_id=case_id,
            client_request_id=payload.client_request_id,
        )
    except InsufficientFundsError as exc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return result
