"""User Management + Role-Based Access Control (RBAC) schema.

Prepares the collections for a future migration from PIN-based staff auth to
Google OAuth-backed users with role-restricted routes.

Roles
-----
- ``super_admin`` — full owner access (Admin console + all ops).
- ``kasir``       — POS + order tracking + attendance clock-in.
- ``produksi``    — Production scanner + attendance clock-in.
- ``kurir``       — Courier dashboard + attendance clock-in.

The current release only defines the shapes; the routes + UI wiring for
Google OAuth will be delivered in a follow-up iteration.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Ordered from most privileged → least so downstream code can compare.
ROLE_HIERARCHY = ["super_admin", "kasir", "produksi", "kurir"]
Role = Literal["super_admin", "kasir", "produksi", "kurir"]


class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    email: EmailStr = Field(..., description="Primary key — matches Google profile email")
    name: str = Field(..., min_length=1, max_length=80)
    picture: Optional[str] = Field(default=None, max_length=500)
    roles: List[Role] = Field(
        default_factory=lambda: ["kasir"],
        description="One or more roles; the highest one wins for gating.",
    )
    is_active: bool = Field(default=True)


class UserCreate(UserBase):
    """POST /api/users payload — used by the Super Admin console to invite
    new staff before they sign in with Google."""


class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: Optional[datetime] = None


class UserSession(BaseModel):
    """One row per active Google OAuth session (mirror of `user_sessions`)."""

    model_config = ConfigDict(extra="ignore")

    session_token: str = Field(..., description="Opaque cookie value")
    user_id: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RoleAssignment(BaseModel):
    """Audit row written whenever a Super Admin changes a user's roles."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    changed_by: str = Field(..., description="Email of the acting Super Admin")
    previous_roles: List[Role]
    new_roles: List[Role]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
