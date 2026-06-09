# Microsoft Entra ID Integration Plan

## Overview

Integrate Microsoft Entra ID (formerly Azure AD) into the HR Resume Matcher app for single sign-on (SSO), role-based access control, and user tracking. Since this is TPF Software internal use only, this is a **single-tenant** integration.

---

## Entra App Registration Setup

Register one app in TPF's Entra tenant:

| Setting | Value |
|---|---|
| Name | HR Resume Matcher |
| Supported account types | Accounts in this organizational directory only (TPF Software - Single tenant) |
| Redirect URI (dev) | http://localhost:5173 |
| Redirect URI (prod) | https://your-prod-url |

You will get:
- `TENANT_ID` — TPF's directory ID
- `CLIENT_ID` — the app's ID

These two values are all you need for single-tenant SSO.

---

## App Roles

Three roles are sufficient for internal TPF use:

| Role | Who | Permissions |
|---|---|---|
| `HR.Admin` | HR Manager | Everything — create jobs, delete, view all |
| `HR.Recruiter` | Recruiters | Match resumes, update candidate status |
| `HR.Viewer` | Hiring managers | View results, AI insights, read-only |

Roles are defined in the Entra App Registration manifest and assigned to users/groups in the Entra portal.

---

## Codebase Changes

### Frontend (`client/`)

Add MSAL and protect routes:

```
client/
  src/
    auth/
      msalConfig.js      ← Entra app config (TENANT_ID, CLIENT_ID)
      AuthProvider.jsx   ← wraps App.jsx with MSAL context
    App.jsx              ← wrapped with AuthProvider
    api/client.js        ← attach Bearer token to every API request
```

Install:
```bash
npm install @azure/msal-react @azure/msal-browser
```

### Backend (`server-python/`)

Add JWT validation middleware:

```
server-python/
  app/
    middleware/
      auth.py            ← verify Entra JWT on every request
      roles.py           ← check app roles from token claims
```

Install:
```bash
pip install msal python-jose[cryptography] httpx
```

### Database Schema Updates

Add user tracking columns to existing tables:

```sql
-- sessions table
ALTER TABLE sessions ADD COLUMN created_by TEXT;       -- user email
ALTER TABLE sessions ADD COLUMN created_by_id TEXT;    -- Entra object ID

-- jobs table
ALTER TABLE jobs ADD COLUMN created_by TEXT;
ALTER TABLE jobs ADD COLUMN created_by_id TEXT;

-- candidates table
ALTER TABLE candidates ADD COLUMN created_by TEXT;
ALTER TABLE candidates ADD COLUMN created_by_id TEXT;
```

---

## Authentication Flow

```
1. User opens app → MSAL checks if logged in
2. Not logged in → redirect to login.microsoftonline.com/<TENANT_ID>
3. User enters TPF work credentials (MFA enforced by Entra if enabled)
4. Entra returns JWT access token to the React app
5. React stores token in memory (MSAL handles this automatically)
6. Every API call includes: Authorization: Bearer <token>
7. Backend decodes token, verifies signature, checks role → allows or rejects
```

The JWT contains the user's name, email, and roles. It is cryptographically signed by Microsoft — no separate user database needed.

---

## Code Snippets

### MSAL Config (`client/src/auth/msalConfig.js`)

```js
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`],
};
```

### Attach Token to API Calls (`client/src/api/client.js`)

```js
import { msalInstance } from '../auth/AuthProvider';
import { loginRequest } from '../auth/msalConfig';

async function getToken() {
  const account = msalInstance.getActiveAccount();
  const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
  return response.accessToken;
}

// Add to every fetch call
const token = await getToken();
headers['Authorization'] = `Bearer ${token}`;
```

### FastAPI Auth Middleware (`server-python/app/middleware/auth.py`)

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from jose import jwt
import httpx

TENANT_ID = os.getenv("ENTRA_TENANT_ID")
CLIENT_ID = os.getenv("ENTRA_CLIENT_ID")
JWKS_URI  = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"

security = HTTPBearer()

async def verify_entra_token(credentials = Depends(security)):
    token = credentials.credentials
    # Fetch Microsoft's public keys and verify signature
    async with httpx.AsyncClient() as client:
        jwks = (await client.get(JWKS_URI)).json()
    claims = jwt.decode(token, jwks, algorithms=["RS256"], audience=CLIENT_ID)
    return claims
```

### Role-Based Route Protection (`server-python/app/middleware/roles.py`)

```python
def require_role(*roles):
    async def checker(token = Depends(verify_entra_token)):
        user_roles = token.get("roles", [])
        if not any(r in user_roles for r in roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return token
    return checker
```

### Protecting Routes in FastAPI

```python
# Any role can access
@router.get("/api/candidates")
async def get_candidates(user = Depends(require_role("HR.Admin", "HR.Recruiter", "HR.Viewer"))):
    ...

# Only recruiters and admins
@router.post("/api/match")
async def match_resumes(user = Depends(require_role("HR.Admin", "HR.Recruiter"))):
    ...

# Admin only
@router.delete("/api/jobs/{job_id}")
async def delete_job(user = Depends(require_role("HR.Admin"))):
    ...
```

---

## Environment Variables

### Frontend (`client/.env`)

```
VITE_ENTRA_TENANT_ID=<TPF-tenant-id>
VITE_ENTRA_CLIENT_ID=<app-client-id>
```

### Backend (`server-python/.env`)

```
ENTRA_TENANT_ID=<TPF-tenant-id>
ENTRA_CLIENT_ID=<app-client-id>
```

---

## What to Ask IT / Azure Admin

1. TPF's **Tenant ID** — find it in Entra portal → Overview
2. Permission to create an **App Registration**
3. Permission to define **App Roles** in the app manifest
4. Assign HR staff users/groups to the appropriate roles

---

## Recommended Implementation Order

Given the Python backend migration is also planned:

| Step | Task | Effort |
|---|---|---|
| 1 | Complete Python backend migration | 2-3 days |
| 2 | IT creates Entra App Registration | 30 min (IT task) |
| 3 | Add MSAL to React frontend | 2-3 hours |
| 4 | Add JWT middleware to FastAPI | 2-3 hours |
| 5 | Add role-based route protection | 2 hours |
| 6 | DB schema updates (user tracking) | 1 hour |
| **Total** | | **~1 day of dev work** |

---

## Benefits for TPF

- **SSO** — staff log in with existing Microsoft/work credentials
- **No password management** — Entra handles it
- **MFA enforced** — Entra applies TPF's existing MFA policy automatically
- **Zero extra cost** — uses TPF's existing Entra tenant
- **Audit trail** — every job, session, and candidate record will have `created_by`
- **Role control** — hiring managers get read-only access; only HR can make changes
