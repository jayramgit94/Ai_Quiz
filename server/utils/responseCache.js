const cacheStore = new Map();
const inFlightStore = new Map();
const MAX_CACHE_ENTRIES = 500;

function isSuccessStatus(code) {
  return code >= 200 && code < 300;
}

function getNow() {
  return Date.now();
}

function pruneExpired() {
  const now = getNow();
  for (const [key, value] of cacheStore.entries()) {
    if (value.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}

function enforceMaxEntries() {
  if (cacheStore.size <= MAX_CACHE_ENTRIES) return;

  const sorted = [...cacheStore.entries()].sort(
    (a, b) => a[1].createdAt - b[1].createdAt,
  );

  const toDelete = cacheStore.size - MAX_CACHE_ENTRIES;
  for (let i = 0; i < toDelete; i += 1) {
    cacheStore.delete(sorted[i][0]);
  }
}

function getCachedValue(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= getNow()) {
    cacheStore.delete(key);
    return null;
  }

  return entry.payload;
}

function setCachedValue(key, payload, ttlMs) {
  pruneExpired();
  cacheStore.set(key, {
    payload,
    createdAt: getNow(),
    expiresAt: getNow() + ttlMs,
  });
  enforceMaxEntries();
}

function invalidateByPrefix(prefix) {
  if (!prefix) return;
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

function cacheResponse(ttlMs, keyBuilder) {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();

    const key = keyBuilder ? keyBuilder(req) : req.originalUrl;
    const cached = getCachedValue(key);

    if (cached) {
      res.set("X-Cache", "HIT");
      return res.json(cached);
    }

    // If another request is already fetching the same key, wait and reuse it.
    if (inFlightStore.has(key)) {
      try {
        const payload = await inFlightStore.get(key);
        res.set("X-Cache", "HIT");
        return res.json(payload);
      } catch (_err) {
        // Fall through and execute the handler if the in-flight one failed.
      }
    }

    let resolveInFlight;
    let rejectInFlight;
    const inFlightPromise = new Promise((resolve, reject) => {
      resolveInFlight = resolve;
      rejectInFlight = reject;
    });
    inFlightStore.set(key, inFlightPromise);

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (isSuccessStatus(res.statusCode)) {
        res.set("X-Cache", "MISS");
        setCachedValue(key, payload, ttlMs);
        resolveInFlight(payload);
      } else {
        rejectInFlight(new Error(`Non-success status: ${res.statusCode}`));
      }
      inFlightStore.delete(key);
      return originalJson(payload);
    };

    res.on("close", () => {
      if (inFlightStore.has(key)) {
        rejectInFlight(new Error("Response closed before completion"));
        inFlightStore.delete(key);
      }
    });

    res.on("error", (err) => {
      if (inFlightStore.has(key)) {
        rejectInFlight(err);
        inFlightStore.delete(key);
      }
    });

    return next();
  };
}

module.exports = {
  cacheResponse,
  invalidateByPrefix,
};
