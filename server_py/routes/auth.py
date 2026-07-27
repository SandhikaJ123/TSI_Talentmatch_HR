"""
routes/auth.py — Microsoft Entra ID (Azure AD) single sign-on.

Uses the server-side "confidential client" OAuth flow: the backend holds the
client secret and does the token exchange directly with Entra. The browser
never sees the secret or the access/id token — it only ever gets a signed,
HttpOnly session cookie (via Starlette's SessionMiddleware). This matches an
app registration that has a client secret issued (a "Web" platform in Entra),
as opposed to a browser-only SPA flow (MSAL.js + PKCE), which wouldn't need
a secret at all.

Required environment variables (put these in server_py/.env):
    ENTRA_TENANT_ID       — your organization's Entra Tenant/Directory ID
    ENTRA_CLIENT_ID       — the App client ID (you already have this:
                             0bffc662-3384-4b37-bdca-75171c4e70f9)
    ENTRA_CLIENT_SECRET   — the client secret VALUE (rotate the one that was
                             pasted in chat — treat it as compromised)
    ENTRA_REDIRECT_URI    — must exactly match a Redirect URI registered on
                             this app registration in Entra, e.g.
                             http://localhost:3001/api/auth/callback
    FRONTEND_URL          — where to send the browser after login/logout,
                             e.g. http://localhost:5173
    SESSION_SECRET_KEY    — any long random string, used to sign the session
                             cookie (NOT the same as the Entra client secret)

Endpoints:
  GET  /api/auth/login     — redirects the browser to Microsoft's login page
  GET  /api/auth/callback  — Entra redirects back here with a `code`; we
                             exchange it for tokens and start a session
  GET  /api/auth/me        — returns the signed-in user, or 401 if not signed in
  POST /api/auth/logout    — clears the local session (and optionally signs
                             the user out of Entra too)

Wiring this in (in your main.py / app entrypoint):
    from starlette.middleware.sessions import SessionMiddleware
    from routes.auth import router as auth_router, require_auth

    app.add_middleware(
        SessionMiddleware,
        secret_key=os.getenv("SESSION_SECRET_KEY"),
        same_site="lax",
        https_only=False,   # set True in production (HTTPS)
    )
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

    # CORS must allow credentials (cookies) from the frontend's exact origin —
    # a wildcard "*" origin does NOT work once allow_credentials=True.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

To protect an existing route, add `user: dict = Depends(require_auth)` as a
parameter — see the `require_auth` dependency below for details and an example.

Install the one new dependency this needs:
    pip install msal
"""

import os
import msal
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse

router = APIRouter()

TENANT_ID = os.getenv("ENTRA_TENANT_ID", "")
CLIENT_ID = os.getenv("ENTRA_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("ENTRA_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("ENTRA_REDIRECT_URI", "http://localhost:3001/api/auth/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}" if TENANT_ID else None
SCOPES = ["User.Read"]  # minimal — just enough to read the signed-in user's own profile


def _msal_app() -> msal.ConfidentialClientApplication:
    if not (TENANT_ID and CLIENT_ID and CLIENT_SECRET):
        raise HTTPException(
            500,
            "SSO is not configured — set ENTRA_TENANT_ID, ENTRA_CLIENT_ID, "
            "and ENTRA_CLIENT_SECRET in server_py/.env",
        )
    return msal.ConfidentialClientApplication(
        CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET,
    )


@router.get("/login")
async def login(request: Request):
    """Redirects the browser to Microsoft's Entra login page."""
    auth_url = _msal_app().get_authorization_request_url(
        SCOPES, redirect_uri=REDIRECT_URI,
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
async def callback(request: Request, code: str = None, error: str = None, error_description: str = None):
    """Entra redirects here after the user signs in. Exchanges the auth code
    for tokens, stores the signed-in user's basic profile in the session, and
    sends the browser back to the frontend."""
    if error:
        raise HTTPException(400, f"Entra sign-in failed: {error_description or error}")
    if not code:
        raise HTTPException(400, "Missing authorization code")

    result = _msal_app().acquire_token_by_authorization_code(
        code, scopes=SCOPES, redirect_uri=REDIRECT_URI,
    )

    if "error" in result:
        raise HTTPException(
            400, f"Token exchange failed: {result.get('error_description', result['error'])}"
        )

    claims = result.get("id_token_claims", {})
    # Keep the session payload small — just what the UI needs to show who's
    # signed in. Access/refresh tokens are intentionally NOT stored in the
    # browser-visible session; if you later need to call Microsoft Graph on
    # the user's behalf, cache result["access_token"] server-side instead.
    request.session["user"] = {
        "name": claims.get("name", ""),
        "email": claims.get("preferred_username") or claims.get("email", ""),
        "oid": claims.get("oid", ""),  # Entra's stable per-user object ID
    }

    return RedirectResponse(FRONTEND_URL)


@router.get("/me")
async def me(request: Request):
    """Returns the signed-in user's profile, or 401 if no active session."""
    user = request.session.get("user")
    if not user:
        raise HTTPException(401, "Not signed in")
    return {"user": user}


@router.post("/logout")
async def logout(request: Request):
    """Clears the local session. The frontend should redirect the browser to
    FRONTEND_URL (or wherever) after calling this."""
    request.session.pop("user", None)
    return {"success": True}


def require_auth(request: Request) -> dict:
    """
    FastAPI dependency to protect any route. Usage in another router:

        from routes.auth import require_auth

        @router.get("/some-protected-thing")
        def some_route(user: dict = Depends(require_auth)):
            ...  # user["email"], user["name"] available here

    Raises 401 if there's no active session, which the frontend's fetch
    wrapper should treat as "redirect to /api/auth/login".
    """
    user = request.session.get("user")
    if not user:
        raise HTTPException(401, "Authentication required")
    return user
