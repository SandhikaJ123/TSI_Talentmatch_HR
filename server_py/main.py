"""
main.py — Application entry point.

Creates the FastAPI app, registers CORS middleware and rate limiting,
mounts all route routers under /api/*, and exposes the /api/health endpoint.
Run directly with `python main.py` or via uvicorn for hot-reload.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import os

load_dotenv(override=True)

from routes.jobs import router as jobs_router
from routes.match import router as match_router
from routes.sessions import router as sessions_router
from routes.candidates import router as candidates_router
from routes.analytics import router as analytics_router
from routes.ai_insights import router as ai_insights_router
from routes.data import router as data_router
from routes.auth import router as auth_router

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Resume Matcher API", version="1.0.0", redirect_slashes=False)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Session cookie support for Entra ID (Azure AD) SSO — routes/auth.py stores
# {name, email, oid} here after a successful sign-in. Must be added before
# CORSMiddleware below so CORS ends up as the outermost layer and still
# applies correctly to session-backed responses (including the redirects
# auth.py issues during login/callback).
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", ""),
    same_site="lax",
    https_only=False,  # set to True once this runs behind HTTPS in production
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,        prefix="/api/auth")
app.include_router(jobs_router,        prefix="/api/jobs")
app.include_router(match_router,       prefix="/api/match")
app.include_router(sessions_router,    prefix="/api/sessions")
app.include_router(candidates_router,  prefix="/api/candidates")
app.include_router(analytics_router,   prefix="/api/analytics")
app.include_router(ai_insights_router, prefix="/api/ai-insights")
app.include_router(data_router,        prefix="/api/data")


@app.get("/api/health")
def health():
    openai_on = bool(os.getenv("OPENAI_API_KEY"))
    anthropic_on = bool(os.getenv("ANTHROPIC_API_KEY"))
    provider = "openai" if openai_on else ("anthropic" if anthropic_on else None)
    return {
        "status": "ok",
        "version": "1.0.0",
        "aiEnabled": bool(provider),
        "aiProvider": provider,
        "engine": "Hybrid Matcher (Rule-based + Embeddings)",
    }


@app.exception_handler(Exception)
async def generic_error(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc) or "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3001))
    print(f"\n🚀 Resume Matcher API running on http://localhost:{port}")
    print(f"   Health: http://localhost:{port}/api/health")
    print(f"   Docs:   http://localhost:{port}/docs\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)