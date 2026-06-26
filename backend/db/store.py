"""
db/store.py
===========
Lightweight async JSON file store.

All user data lives in ``backend/data/store.json`` which has the shape:

.. code-block:: json

    {
      "twins":  { "<user_id>": { ...ShadowTwin fields... } },
      "events": { "<user_id>": [ ...BehaviorEvent dicts... ] }
    }

The store is loaded into memory on first access and written back on every
mutation.  An ``asyncio.Lock`` ensures that concurrent writes do not corrupt
the file.

Functions
---------
get_twin(user_id)
save_twin(twin)
append_event(event)
get_events(user_id, limit)
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import aiofiles

from models.twin import ShadowTwin
from models.event import BehaviorEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DATA_DIR = _BACKEND_DIR / "data"
_STORE_PATH = _DATA_DIR / "store.json"

_EMPTY_STORE: dict[str, Any] = {"twins": {}, "events": {}}

# One global lock – the file is small enough that this is fine
_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Low-level I/O helpers
# ---------------------------------------------------------------------------

async def _read_store() -> dict[str, Any]:
    """
    Read the JSON store from disk.  Creates an empty store if the file does
    not exist yet.
    """
    _DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not _STORE_PATH.exists():
        await _write_store(_EMPTY_STORE)
        return dict(_EMPTY_STORE)

    try:
        async with aiofiles.open(_STORE_PATH, mode="r", encoding="utf-8") as f:
            raw = await f.read()
        data = json.loads(raw)
        # Ensure both top-level keys exist (graceful migration)
        data.setdefault("twins", {})
        data.setdefault("events", {})
        return data
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to read store, resetting: %s", exc)
        return dict(_EMPTY_STORE)


async def _write_store(data: dict[str, Any]) -> None:
    """Atomically write the JSON store to disk."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(_STORE_PATH, mode="w", encoding="utf-8") as f:
        await f.write(json.dumps(data, indent=2, default=_json_default))


def _json_default(obj: Any) -> Any:
    """Custom JSON serialiser for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_twin(user_id: str) -> ShadowTwin:
    """
    Retrieve the ShadowTwin for *user_id*.

    Returns a brand-new default twin (and persists it) if none exists.

    Parameters
    ----------
    user_id:
        The unique user identifier.

    Returns
    -------
    ShadowTwin
        The current twin state.
    """
    async with _lock:
        data = await _read_store()
        raw = data["twins"].get(user_id)

    if raw is None:
        twin = ShadowTwin.create_default(user_id)
        await save_twin(twin)
        logger.info("Created new ShadowTwin for user_id=%s", user_id)
        return twin

    try:
        return ShadowTwin.model_validate(raw)
    except Exception as exc:
        logger.warning("Corrupted twin for user_id=%s, resetting: %s", user_id, exc)
        twin = ShadowTwin.create_default(user_id)
        await save_twin(twin)
        return twin


async def save_twin(twin: ShadowTwin) -> None:
    """
    Persist the given *twin* to the store.

    Parameters
    ----------
    twin:
        The ShadowTwin to save.
    """
    async with _lock:
        data = await _read_store()
        data["twins"][twin.user_id] = twin.model_dump(mode="json")
        await _write_store(data)
    logger.debug("Saved ShadowTwin for user_id=%s", twin.user_id)


async def append_event(event: BehaviorEvent) -> None:
    """
    Append a BehaviorEvent to the user's event ledger.

    Parameters
    ----------
    event:
        The event to append.
    """
    async with _lock:
        data = await _read_store()
        bucket: list[dict[str, Any]] = data["events"].setdefault(event.user_id, [])
        bucket.append(event.model_dump(mode="json"))
        await _write_store(data)
    logger.debug(
        "Appended event event_id=%s for user_id=%s", event.event_id, event.user_id
    )


async def get_events(user_id: str, limit: int = 100) -> list[BehaviorEvent]:
    """
    Retrieve the most recent *limit* BehaviorEvents for *user_id*.

    Parameters
    ----------
    user_id:
        The unique user identifier.
    limit:
        Maximum number of events to return (most recent first).

    Returns
    -------
    list[BehaviorEvent]
        Ordered newest-first.
    """
    async with _lock:
        data = await _read_store()
        raw_events: list[dict[str, Any]] = data["events"].get(user_id, [])

    # Most recent first
    raw_events = raw_events[-limit:][::-1]

    events: list[BehaviorEvent] = []
    for raw in raw_events:
        try:
            events.append(BehaviorEvent.model_validate(raw))
        except Exception as exc:
            logger.warning("Skipping malformed event: %s", exc)

    return events
