"""Mongo ↔ Pydantic serialization helpers.

Pydantic `datetime` objects become BSON Dates when handed to Motor. When we
re-hydrate documents we just pop `_id` and let Pydantic coerce timestamps.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict


def serialize_for_mongo(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a Pydantic `.model_dump()` dict for Motor insertion.

    * Strips any accidental `_id` key
    * Converts datetimes to ISO strings (MongoDB stores BSON dates fine but
      we standardise on ISO strings so all collections round-trip identically
      — matches the existing StatusCheck pattern).
    * Recurses into lists (for order_events) + dicts (for nested models).
    """

    def _walk(value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            return {k: _walk(v) for k, v in value.items() if k != "_id"}
        if isinstance(value, list):
            return [_walk(v) for v in value]
        return value

    return _walk(doc)


def deserialize_from_mongo(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a raw Motor document for Pydantic model re-hydration.

    Mongo docs come back with `_id` already excluded by our projections; we
    additionally coerce ISO-string datetimes back to `datetime` instances so
    Pydantic validators don't have to deal with strings.
    """

    def _walk(value: Any) -> Any:
        if isinstance(value, str):
            # cheap heuristic: looks like an ISO datetime
            if len(value) >= 19 and value[4] == "-" and value[7] == "-" and "T" in value:
                try:
                    return datetime.fromisoformat(value)
                except ValueError:
                    return value
            return value
        if isinstance(value, dict):
            return {k: _walk(v) for k, v in value.items() if k != "_id"}
        if isinstance(value, list):
            return [_walk(v) for v in value]
        return value

    return _walk(doc)
