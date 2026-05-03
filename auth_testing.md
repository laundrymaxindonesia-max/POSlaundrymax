# Auth-Gated App Testing Playbook (Emergent Google OAuth)

Copy of the verified Emergent Auth playbook delivered by the integration expert.
Use this reference when testing `/admin` and `/dashboard` owner-protected routes.

## Step 1 — Create a Test User & Session
```bash
mongosh "mongodb://localhost:27017/test_database" --eval "
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'theomahrizal@gmail.com',   // MUST match the OWNER whitelist
  name: 'Theo Mahrizal',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2 — Test Backend API
```bash
# /api/auth/me via Bearer token (fallback path)
curl -H "Authorization: Bearer <SESSION_TOKEN>" \
     https://laundrymax-cashier.preview.emergentagent.com/api/auth/me
```

## Step 3 — Browser Testing (Playwright)
```python
await page.context.add_cookies([{
  "name": "session_token",
  "value": "<SESSION_TOKEN>",
  "domain": "laundrymax-cashier.preview.emergentagent.com",
  "path": "/",
  "httpOnly": True,
  "secure": True,
  "sameSite": "None",
}])
await page.goto("https://laundrymax-cashier.preview.emergentagent.com/admin")
```

## Whitelist
Only **`theomahrizal@gmail.com`** is permitted to authenticate as Owner.
Any other Google account → backend returns 403 and the frontend shows a
"Not authorized" screen.

## Staff PIN Gate (separate from Google Auth)
Routes `/`, `/production`, `/courier` require a valid staff PIN (default seed `1234`).
Verified via `POST /api/auth/staff-pin` which checks against any seeded Staff record's `pin_code`.
Successful verification sets a `sessionStorage` flag on the client, so the PIN is only prompted once per tab.

## Success Indicators
- ✅ `/api/auth/me` with valid cookie returns `{user_id, email, name, picture}`
- ✅ `/admin` and `/dashboard` render after login
- ✅ `/absen` remains PUBLIC (no gate)
- ✅ Staff routes show PIN overlay until `1234` is entered

## Failure Indicators
- ❌ 401 on `/api/auth/me` with valid cookie
- ❌ 403 when the authorised owner email tries `/admin`
- ❌ Admin / Dashboard pills visible in HeaderNav when no session
