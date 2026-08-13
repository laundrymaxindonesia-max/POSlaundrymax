"""Auth endpoints: Emergent Google OAuth for the Owner + PIN verify for Staff.

Owner flow (Google OAuth):
  POST /api/auth/session      — exchange session_id for session_token; whitelist `theomahrizal@gmail.com`
  GET  /api/auth/me           — current user from cookie (or Authorization: Bearer <token>)
  POST /api/auth/logout       — delete session + clear cookie

Staff flow (kiosk PIN):
  POST /api/auth/staff-pin    — body: {staff_id, pin_code} → returns staff info if valid, else 403
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from db import db, staff_col

# Whitelist of Google emails allowed to authenticate as Owner/Superadmin.
# Configurable via OWNER_EMAILS env var (comma-separated). Defaults to the
# original single-owner setup so local dev keeps working without env config.
OWNER_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("OWNER_EMAILS", "theomahrizal@gmail.com").split(",")
    if e.strip()
}

EMERGENT_SESSION_ENDPOINT = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)
SESSION_TTL_DAYS = 7

users_col = db["users"]
sessions_col = db["user_sessions"]

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------- Pydantic models ----------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None


class SessionExchangeResponse(BaseModel):
    """Session exchange response. Includes the session_token in the body so the
    frontend can persist it in localStorage and send it back as
    `Authorization: Bearer <token>` — this is the fallback path for browsers
    that block third-party cookies (Safari, Firefox strict, Brave).
    """
    model_config = ConfigDict(extra="ignore")

    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    session_token: str


class SessionExchangeRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


class StaffPinRequest(BaseModel):
    staff_id: str = Field(..., min_length=1)
    pin_code: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class StaffPinResponse(BaseModel):
    ok: bool
    staff_id: str
    name: str
    role: str
    display_role: Optional[str] = None


# ---------------- Helpers ----------------
async def _resolve_session_from_cookie_or_header(
    session_token_cookie: Optional[str],
    authorization: Optional[str],
) -> dict:
    """Look up a user via session_token (cookie first, Bearer header fallback).

    Returns the user document {_id excluded}. Raises 401 on any failure.
    """
    token = session_token_cookie
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await sessions_col.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await users_col.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )


# ---------------- POST /api/auth/session ----------------
@router.post("/session", response_model=SessionExchangeResponse)
async def exchange_session(
    payload: SessionExchangeRequest, response: Response
) -> SessionExchangeResponse:
    """Called by the frontend AuthCallback right after Emergent redirects back.

    We fetch user data from Emergent's /session-data with X-Session-ID, then
    enforce our Owner email whitelist before issuing our own session_token.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            EMERGENT_SESSION_ENDPOINT,
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if email not in OWNER_EMAILS:
        raise HTTPException(
            status_code=403,
            detail=f"Akun {email} tidak memiliki akses Owner",
        )

    # Upsert user record (keyed on email)
    existing = await users_col.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await users_col.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "name": data.get("name") or existing.get("name"),
                    "picture": data.get("picture") or existing.get("picture"),
                }
            },
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await users_col.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": data.get("name") or email,
                "picture": data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    # Store session
    session_token = data.get("session_token") or uuid.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    await sessions_col.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    _set_session_cookie(response, session_token)

    user_doc = await users_col.find_one({"user_id": user_id}, {"_id": 0})
    return SessionExchangeResponse(**user_doc, session_token=session_token)


# ---------------- GET /api/auth/me ----------------
@router.get("/me", response_model=User)
async def me(
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> User:
    user = await _resolve_session_from_cookie_or_header(session_token, authorization)
    # Defense-in-depth: re-enforce the owner whitelist at read time. Protects
    # against direct session/user-collection tampering via mongosh etc.
    if (user.get("email") or "").lower().strip() not in OWNER_EMAILS:
        raise HTTPException(status_code=403, detail="Akun tidak memiliki akses Owner")
    return User(**user)


# ---------------- POST /api/auth/logout ----------------
@router.post("/logout")
async def logout(
    response: Response,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = session_token
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if token:
        await sessions_col.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------- POST /api/auth/staff-pin ----------------
@router.post("/staff-pin", response_model=StaffPinResponse)
async def staff_pin(payload: StaffPinRequest):
    """Validates that the submitted PIN matches the chosen Staff's PIN.

    Returns staff identity so the frontend can use it as the `actor` when
    calling order-transition endpoints.
    """
    match = await staff_col.find_one(
        {"id": payload.staff_id, "pin_code": payload.pin_code},
        {"_id": 0, "pin_code": 0},
    )
    if not match:
        raise HTTPException(status_code=403, detail="PIN salah")
    return StaffPinResponse(
        ok=True,
        staff_id=match["id"],
        name=match["name"],
        role=match["role"],
        display_role=match.get("display_role"),
    )
