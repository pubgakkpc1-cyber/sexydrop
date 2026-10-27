from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Tables for users/ledger/inventory land in 7.2+."""
