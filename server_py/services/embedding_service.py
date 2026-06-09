"""
services/embedding_service.py — OpenAI vector embedding helpers.

Provides:
- embed_text / embed_batch   → call OpenAI text-embedding-3-small (1536 dims)
- vector_to_bytes / bytes_to_vector → Float32 binary serialisation for SQLite BLOB storage
- cosine_similarity / similarity_to_score → in-process semantic similarity (no vector DB needed)
- build_job_embedding_text / build_resume_embedding_text → text formatters for consistent embedding input
"""

import os
import struct
import math
from typing import Optional
from openai import AsyncOpenAI

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


# ── Serialisation ─────────────────────────────────────────────────────────────

def vector_to_bytes(vector: list[float]) -> bytes:
    return struct.pack(f"{len(vector)}f", *vector)


def bytes_to_vector(data: bytes) -> list[float]:
    n = len(data) // 4
    return list(struct.unpack(f"{n}f", data))


# ── Similarity ────────────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    denom = norm_a * norm_b
    return dot / denom if denom else 0.0


def similarity_to_score(sim: float) -> int:
    return round(max(0.0, min(100.0, sim * 100)))


# ── Embedding generation ──────────────────────────────────────────────────────

async def embed_text(text: str) -> list[float]:
    client = _get_client()
    resp = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text[:32000],
        encoding_format="float",
    )
    return resp.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    client = _get_client()
    resp = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=[t[:32000] for t in texts],
        encoding_format="float",
    )
    return [item.embedding for item in sorted(resp.data, key=lambda x: x.index)]


# ── Text builders ─────────────────────────────────────────────────────────────

def build_job_embedding_text(job: dict) -> str:
    import json
    parts = [
        f"Job Title: {job.get('title', '')}",
        f"Department: {job['department']}" if job.get("department") else "",
        f"Type: {job['type']}" if job.get("type") else "",
        f"Summary: {job['summary']}" if job.get("summary") else "",
    ]
    for field, label in [
        ("required_skills", "Required Skills"),
        ("nice_to_have_skills", "Nice to Have"),
        ("responsibilities", "Responsibilities"),
    ]:
        val = job.get(field, "[]")
        lst = val if isinstance(val, list) else json.loads(val or "[]")
        if lst:
            sep = ", " if label != "Responsibilities" else ". "
            parts.append(f"{label}: {sep.join(lst)}")
    if job.get("description"):
        parts.append(f"Full Description: {job['description'][:4000]}")
    return "\n".join(p for p in parts if p)


def build_resume_embedding_text(resume: dict) -> str:
    return (resume.get("text") or resume.get("name", ""))[:32000]
