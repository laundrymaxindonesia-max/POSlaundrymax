"""ReceiptSettings — single-document configuration for thermal receipts.

There is exactly ONE document in the ``receipt_settings`` collection. We use
a fixed sentinel id (``"default"``) so upserts stay idempotent and the
admin UI never has to worry about "which settings row do I edit?".

Fields
------
header_order  Ordered list of header slot ids the owner arranged from top to
              bottom. Recognised ids: ``"speed"``, ``"qr"``, ``"logo"``.
              Anything else is preserved (forward-compat) but ignored by the
              current print templates.
store_name    Free text used as the store banner (default: "LAUNDRYMAX").
store_address Multi-line address printed below the banner.
store_phone   Displayed on the customer receipt for support / claims.
footer_message Bottom-of-receipt tagline. Set to empty string to hide.
paper_width   Thermal paper width — ``"58mm"`` or ``"80mm"``. Purely a hint
              consumed by the frontend print CSS; the backend stores it as a
              plain string so any future width can be added without a
              backend deploy.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel, ConfigDict, Field

# Sentinel id: there is only ever one row in this collection.
SETTINGS_ID = "default"

# Ordered list of every recognised header slot. Keep in sync with the
# frontend template renderers so an unknown slot never silently drops.
KNOWN_HEADER_SLOTS = ["speed", "qr", "logo"]


class ReceiptSettingsBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    header_order: List[str] = Field(
        default_factory=lambda: ["speed", "qr", "logo"],
        description="Header stack from top to bottom.",
    )
    store_name: str = Field(default="LAUNDRYMAX", min_length=1, max_length=48)
    store_address: str = Field(
        default="Jl. Contoh No. 1, Bandung", max_length=120
    )
    store_phone: str = Field(default="0812-3456-7890", max_length=32)
    footer_message: str = Field(
        default="Terima kasih! Simpan struk sebagai bukti klaim.",
        max_length=160,
    )
    paper_width: str = Field(default="58mm", pattern=r"^(58mm|80mm)$")


class ReceiptSettingsUpdate(ReceiptSettingsBase):
    """Payload for PUT /api/receipt-settings."""


class ReceiptSettings(ReceiptSettingsBase):
    id: str = Field(default=SETTINGS_ID)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
