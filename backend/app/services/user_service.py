from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user_by_id(session: AsyncSession, user_id) -> Optional[User]:
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_telegram_id(session: AsyncSession, telegram_id: int) -> Optional[User]:
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_referral_code(session: AsyncSession, referral_code: str) -> Optional[User]:
    stmt = select(User).where(User.referral_code == referral_code)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_or_create_telegram_user(
    session: AsyncSession,
    *,
    telegram_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    photo_url: Optional[str] = None,
    referral_code: Optional[str] = None,
) -> User:
    """Look up an existing user by telegram_id and update profile data, or register a new one."""
    user = await get_user_by_telegram_id(session, telegram_id)

    if user is not None:
        # Update mutable profile metadata
        changed = False
        if user.username != username:
            user.username = username
            changed = True
        if user.first_name != first_name:
            user.first_name = first_name
            changed = True
        if user.last_name != last_name:
            user.last_name = last_name
            changed = True
        if user.photo_url != photo_url:
            user.photo_url = photo_url
            changed = True
        if changed:
            await session.commit()
            await session.refresh(user)
        return user

    # Handle referral attribution for new user
    referred_by_id = None
    if referral_code:
        cleaned_ref = referral_code.strip()
        referrer = await get_user_by_referral_code(session, cleaned_ref)
        if referrer is not None and referrer.telegram_id != telegram_id:
            referred_by_id = referrer.id

    own_ref_code = f"ref-{telegram_id}"
    new_user = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        photo_url=photo_url,
        referral_code=own_ref_code,
        referred_by_id=referred_by_id,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user
