"""Pydantic models for LaundryMax MongoDB collections.

Each module exposes:
    - a storage model (the shape persisted in MongoDB, with id/created_at)
    - a Create schema (what the API accepts when inserting)
"""

from models.order import (
    Order, OrderCreate, OrderEvent, OrderSource, OrderStatus,
    PaymentStatus, StatusUpdate, STATUS_CHAIN,
)
from models.customer import Customer, CustomerCreate, CustomerType, MemberTier
from models.price import Price, PriceCreate, ServiceType, PriceTier
from models.b2b_quota import B2BQuota, B2BQuotaCreate, PartnerName
from models.staff import Staff, StaffCreate, StaffRole
from models.attendance import Attendance, AttendanceCreate, ShiftReport

__all__ = [
    "Order", "OrderCreate", "OrderEvent", "OrderSource", "OrderStatus",
    "PaymentStatus", "StatusUpdate", "STATUS_CHAIN",
    "Customer", "CustomerCreate", "CustomerType", "MemberTier",
    "Price", "PriceCreate", "ServiceType", "PriceTier",
    "B2BQuota", "B2BQuotaCreate", "PartnerName",
    "Staff", "StaffCreate", "StaffRole",
    "Attendance", "AttendanceCreate", "ShiftReport",
]
