"""Basit bellek içi hız sınırı (instance başına). Hesap kilidine ek olarak, tek IP'den
çok sayıda farklı hesaba şifre denenmesini yavaşlatır."""

import time
from collections import defaultdict, deque
from threading import Lock


class SlidingWindow:
    def __init__(self, limit: int, seconds: int) -> None:
        self.limit = limit
        self.seconds = seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _trim(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and hits[0] <= now - self.seconds:
            hits.popleft()
        return hits

    def blocked(self, key: str) -> bool:
        with self._lock:
            hits = self._trim(key, time.monotonic())
            if not hits:
                self._hits.pop(key, None)
            return len(hits) >= self.limit

    def hit(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._trim(key, now).append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
