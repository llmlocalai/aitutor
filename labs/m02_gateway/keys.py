"""API keys: stored hashed, each with scopes, a per-minute rate and a daily quota."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Optional

# region: keys
class KeyStore:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.execute("""CREATE TABLE IF NOT EXISTS keys (
            key_id TEXT PRIMARY KEY, app TEXT NOT NULL, hash TEXT NOT NULL UNIQUE,
            scopes TEXT NOT NULL, rate_per_min INTEGER NOT NULL, daily_quota INTEGER NOT NULL,
            revoked INTEGER NOT NULL DEFAULT 0)""")
        self.db.execute("CREATE TABLE IF NOT EXISTS hits (key_id TEXT, ts REAL)")
        self.db.commit()

    @staticmethod
    def _hash(secret: str) -> str:
        return hashlib.sha256(secret.encode()).hexdigest()

    def issue(self, app: str, scopes: str = "chat", rate_per_min: int = 30, daily_quota: int = 1000) -> str:
        """Create a key. The plain secret is returned once and never stored."""
        secret = "lab_" + secrets.token_urlsafe(24)
        key_id = "k_" + secrets.token_hex(4)
        self.db.execute("INSERT INTO keys VALUES (?,?,?,?,?,?,0)",
                        (key_id, app, self._hash(secret), scopes, rate_per_min, daily_quota))
        self.db.commit()
        return secret

    def revoke(self, app: str) -> None:
        self.db.execute("UPDATE keys SET revoked = 1 WHERE app = ?", (app,))
        self.db.commit()

    def authenticate(self, header: Optional[str], scope: str = "chat", now: Optional[float] = None) -> dict:
        """Return the key row, or raise PermissionError carrying an HTTP status."""
        now = now or time.time()
        if not header or not header.startswith("Bearer "):
            raise PermissionError(401, "missing bearer token")
        row = self.db.execute("SELECT key_id, app, scopes, rate_per_min, daily_quota, revoked "
                              "FROM keys WHERE hash = ?", (self._hash(header[7:].strip()),)).fetchone()
        if not row or row[5]:
            raise PermissionError(401, "unknown or revoked key")
        key_id, app, scopes, rate, quota, _ = row
        if scope not in scopes.split(","):
            raise PermissionError(403, f"key lacks scope '{scope}'")
        minute = self.db.execute("SELECT count(*) FROM hits WHERE key_id=? AND ts>?", (key_id, now - 60)).fetchone()[0]
        if minute >= rate:
            raise PermissionError(429, "rate limit reached")
        day = self.db.execute("SELECT count(*) FROM hits WHERE key_id=? AND ts>?", (key_id, now - 86400)).fetchone()[0]
        if day >= quota:
            raise PermissionError(429, "daily quota reached")
        self.db.execute("INSERT INTO hits VALUES (?,?)", (key_id, now))
        self.db.commit()
        return {"key_id": key_id, "app": app, "scopes": scopes.split(",")}
# endregion
