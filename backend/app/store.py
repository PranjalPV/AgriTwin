"""Simulation history: Supabase if configured, otherwise local SQLite."""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

DB_PATH = Path(__file__).resolve().parents[1] / "agritwin.db"


def _supabase():
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")
    if url and key:
        return url.rstrip("/") + "/rest/v1/simulations", {
            "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "Prefer": "return=minimal"}
    return None


def backend_name() -> str:
    return "supabase" if _supabase() else "sqlite"


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.execute("create table if not exists simulations (id text primary key, created_at text, inputs text, outputs text)")
    return c


def save(inputs: dict, outputs: dict) -> str:
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    sb = _supabase()
    if sb:
        try:
            httpx.post(sb[0], headers=sb[1], timeout=8,
                       json={"id": sid, "created_at": now, "inputs": inputs, "outputs": outputs}).raise_for_status()
            return sid
        except Exception:
            pass  # fall through to local
    with _conn() as c:
        c.execute("insert into simulations values (?,?,?,?)", (sid, now, json.dumps(inputs), json.dumps(outputs)))
    return sid


def history(limit: int = 20) -> list[dict]:
    sb = _supabase()
    if sb:
        try:
            r = httpx.get(sb[0], headers=sb[1], timeout=8,
                          params={"select": "*", "order": "created_at.desc", "limit": limit})
            r.raise_for_status()
            return r.json()
        except Exception:
            pass
    with _conn() as c:
        rows = c.execute("select * from simulations order by created_at desc limit ?", (limit,)).fetchall()
    return [{"id": r[0], "created_at": r[1], "inputs": json.loads(r[2]), "outputs": json.loads(r[3])} for r in rows]
