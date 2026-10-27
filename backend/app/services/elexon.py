"""Thin, cached client for the Elexon BMRS public API.

Only two datasets are in scope:
  * FUELHH  - half-hourly actual generation by fuel type
  * WINDFOR - wind generation forecast

Elexon limits a single query to a 7-day publish-time window, so requests are
chunked. Raw responses are cached as gzipped JSON so a rebuild is repeatable
and does not depend on the API being reachable.
"""

from __future__ import annotations

import gzip
import json
import logging
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

import httpx

from ..config import ELEXON_BASE_URL, ELEXON_CHUNK_DAYS, RAW_DIR

log = logging.getLogger(__name__)


class ElexonError(RuntimeError):
    """Raised when the upstream API cannot be read."""


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _cache_name(dataset: str, params: dict[str, str]) -> str:
    window = f"{params['publishDateTimeFrom']}_{params['publishDateTimeTo']}"
    safe = window.replace(":", "").replace("-", "").replace("T", "")
    return f"{dataset.lower()}_{safe}.json.gz"


class ElexonClient:
    def __init__(
        self,
        raw_dir: Path = RAW_DIR,
        *,
        force: bool = False,
        timeout: float = 60.0,
        retries: int = 4,
        base_url: str = ELEXON_BASE_URL,
    ) -> None:
        self.raw_dir = Path(raw_dir)
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.force = force
        self.retries = retries
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            timeout=timeout,
            headers={
                "Accept": "application/json",
                "User-Agent": "Windcast/0.1 (analysis pilot)",
            },
            follow_redirects=True,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "ElexonClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ------------------------------------------------------------------ HTTP
    def _fetch_page(self, dataset: str, params: dict[str, str]) -> list[dict[str, Any]]:
        url = f"{self.base_url}/datasets/{dataset}"
        last_error: Exception | None = None
        for attempt in range(1, self.retries + 1):
            try:
                response = self._client.get(url, params=params)
                if response.status_code == 429 or response.status_code >= 500:
                    raise ElexonError(
                        f"{dataset} returned HTTP {response.status_code}: "
                        f"{response.text[:200]}"
                    )
                response.raise_for_status()
                payload = response.json()
                rows = payload.get("data", payload) if isinstance(payload, dict) else payload
                if not isinstance(rows, list):
                    raise ElexonError(f"Unexpected {dataset} payload: {type(rows)!r}")
                return rows
            except (httpx.HTTPError, ValueError, ElexonError) as exc:
                last_error = exc
                if attempt == self.retries:
                    break
                delay = (2 ** (attempt - 1)) + random.uniform(0, 0.4)
                log.warning("%s request failed (%s); retrying in %.1fs", dataset, exc, delay)
                time.sleep(delay)
        raise ElexonError(f"Could not fetch {dataset} {params}: {last_error}")

    def _cached_page(self, dataset: str, params: dict[str, str]) -> list[dict[str, Any]]:
        cache_path = self.raw_dir / _cache_name(dataset, params)
        if cache_path.exists() and not self.force:
            try:
                with gzip.open(cache_path, "rt", encoding="utf-8") as handle:
                    rows = json.load(handle)
                log.info("cache hit  %s %s (%d rows)", dataset, cache_path.name, len(rows))
                return rows
            except (OSError, json.JSONDecodeError):
                log.warning("Ignoring unreadable cache file %s", cache_path)

        rows = self._fetch_page(dataset, params)
        tmp_path = cache_path.with_suffix(".tmp")
        with gzip.open(tmp_path, "wt", encoding="utf-8") as handle:
            json.dump(rows, handle)
        tmp_path.replace(cache_path)
        log.info("fetched    %s %s (%d rows)", dataset, cache_path.name, len(rows))
        time.sleep(0.25)
        return rows

    @staticmethod
    def _chunks(start: datetime, end: datetime) -> Iterable[tuple[datetime, datetime]]:
        cursor = start
        step = timedelta(days=ELEXON_CHUNK_DAYS)
        while cursor < end:
            chunk_end = min(cursor + step, end)
            yield cursor, chunk_end
            cursor = chunk_end

    # --------------------------------------------------------------- datasets
    def fuelhh(self, publish_from: datetime, publish_to: datetime) -> list[dict[str, Any]]:
        """Actual half-hourly wind generation, filtered to WIND."""
        rows: list[dict[str, Any]] = []
        for chunk_start, chunk_end in self._chunks(publish_from, publish_to):
            params = {
                "publishDateTimeFrom": iso_z(chunk_start),
                "publishDateTimeTo": iso_z(chunk_end),
                "fuelType": "WIND",
            }
            rows.extend(self._cached_page("FUELHH", params))
        return rows

    def windfor(self, publish_from: datetime, publish_to: datetime) -> list[dict[str, Any]]:
        """Wind generation forecasts, keyed by publication and delivery time."""
        rows: list[dict[str, Any]] = []
        for chunk_start, chunk_end in self._chunks(publish_from, publish_to):
            params = {
                "publishDateTimeFrom": iso_z(chunk_start),
                "publishDateTimeTo": iso_z(chunk_end),
            }
            rows.extend(self._cached_page("WINDFOR", params))
        return rows
