"""Create catalog_gifts and inventory_items tables and seed catalog.

Revision ID: 0004_inventory_and_catalog
Revises: 0003_ledger
Create Date: 2026-10-27
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_inventory_and_catalog"
down_revision: Union[str, Sequence[str], None] = "0003_ledger"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INITIAL_GIFTS = [
    ("fresh-socks", "Fresh Socks", "/gifts/fresh-socks.svg", "common", 0.050, "catalog-config", "Starter Basics"),
    ("scared-cat", "Scared Cat", "/gifts/scared-cat.svg", "common", 0.150, "catalog-config", "Starter Basics"),
    ("instant-ramen", "Instant Ramen", "/gifts/instant-ramen.svg", "common", 0.200, "catalog-config", "Street Food"),
    ("chill-flame", "Chill Flame", "/gifts/chill-flame.svg", "common", 0.300, "catalog-config", "Elements"),
    ("xmas-stocking", "Xmas Stocking", "/gifts/xmas-stocking.svg", "common", 0.500, "catalog-config", "Winter Collection"),
    ("holiday-gift", "Holiday Gift", "/gifts/holiday-gift.svg", "common", 0.600, "demo", "Winter Collection"),
    ("heart-locket", "Heart Locket", "/gifts/heart-locket.svg", "rare", 1.000, "catalog-config", "Jewelry"),
    ("magic-potion", "Magic Potion", "/gifts/magic-potion.svg", "rare", 1.500, "demo", "Arcane Items"),
    ("resistance-dog", "Resistance Dog", "/gifts/resistance-dog.svg", "rare", 2.000, "catalog-config", "Heroes"),
    ("cyber-helmet", "Cyber Helmet", "/gifts/cyber-helmet.svg", "rare", 3.500, "catalog-config", "Cyberpunk"),
    ("astral-shard", "Astral Shard", "/gifts/astral-shard.svg", "epic", 5.000, "catalog-config", "Astral Series"),
    ("durovs-cap", "Durov's Cap", "/gifts/durovs-cap.svg", "epic", 8.000, "catalog-config", "Icons"),
    ("diamond-ring", "Diamond Ring", "/gifts/diamond-ring.svg", "epic", 12.000, "catalog-config", "Jewelry"),
    ("neon-dream", "Neon Dream", "/gifts/neon-dream.svg", "legendary", 18.000, "demo", "Neon Series"),
    ("plush-pepe", "Plush Pepe", "/gifts/plush-pepe.svg", "legendary", 25.000, "catalog-config", "Memes"),
    ("crystal-ball", "Crystal Ball", "/gifts/crystal-ball.svg", "legendary", 40.000, "demo", "Arcane Items"),
    ("golden-trophy", "Golden Trophy", "/gifts/golden-trophy.svg", "legendary", 60.000, "demo", "Champions"),
    ("astral-crown", "Astral Crown", "/gifts/astral-crown.svg", "legendary", 100.000, "demo", "Astral Series"),
    ("golden-pepe", "Golden Plush Pepe", "/gifts/golden-pepe.svg", "legendary", 200.000, "demo", "Memes"),
]


def upgrade() -> None:
    # 1. Catalog gifts
    op.create_table(
        "catalog_gifts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("image_url", sa.String(length=256), nullable=False),
        sa.Column("rarity", sa.String(length=32), nullable=False),
        sa.Column("price", sa.Numeric(precision=20, scale=3), nullable=False),
        sa.Column("price_source", sa.String(length=32), nullable=False),
        sa.Column("price_updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("collection", sa.String(length=64), nullable=False),
        sa.Column("serial_number", sa.Integer(), nullable=True),
        sa.Column("is_available", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # 2. Inventory items
    op.create_table(
        "inventory_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "gift_id",
            sa.String(length=64),
            sa.ForeignKey("catalog_gifts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), server_default="available", nullable=False),
        sa.Column("acquired_from", sa.String(length=32), nullable=False),
        sa.Column("acquired_price", sa.Numeric(precision=20, scale=3), nullable=False),
        sa.Column("sold_price", sa.Numeric(precision=20, scale=3), nullable=True),
        sa.Column("client_request_id", sa.String(length=64), nullable=True),
        sa.Column("acquired_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_inventory_items_user_status", "inventory_items", ["user_id", "status"], unique=False)
    op.create_index(
        "ix_inventory_items_user_req",
        "inventory_items",
        ["user_id", "client_request_id"],
        unique=True,
        postgresql_where=sa.text("client_request_id IS NOT NULL"),
    )

    # Seed initial gifts
    catalog_table = sa.table(
        "catalog_gifts",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("image_url", sa.String),
        sa.column("rarity", sa.String),
        sa.column("price", sa.Numeric),
        sa.column("price_source", sa.String),
        sa.column("collection", sa.String),
        sa.column("is_available", sa.Boolean),
    )
    op.bulk_insert(
        catalog_table,
        [
            {
                "id": g[0],
                "name": g[1],
                "image_url": g[2],
                "rarity": g[3],
                "price": g[4],
                "price_source": g[5],
                "collection": g[6],
                "is_available": True,
            }
            for g in INITIAL_GIFTS
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_items_user_req", table_name="inventory_items")
    op.drop_index("ix_inventory_items_user_status", table_name="inventory_items")
    op.drop_table("inventory_items")
    op.drop_table("catalog_gifts")
