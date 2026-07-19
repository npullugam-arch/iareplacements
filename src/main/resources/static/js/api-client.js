(function () {
    const DEFAULT_GET_TIMEOUT = 15000; // 15s
    const DEFAULT_NON_GET_TIMEOUT = 30000; // 30s
    const DEFAULT_GET_RETRIES = 2;
    const DEFAULT_RETRY_DELAY = 1000;
    const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504, 524];

    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function getRequestPath(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            return parsed.pathname + parsed.search;
        } catch (e) {
            return url;
        }
    }

    function isTransientError(err) {
        const status = err && typeof err.status === 'number' ? err.status : null;
        return Boolean(err && (
            err.name === 'TypeError' ||
            err.name === 'AbortError' ||
            err.code === 'server_wake' ||
            RETRYABLE_STATUS_CODES.includes(status)
        ));
    }

    async function rawFetch(url, options, timeout) {
        const hasExternalSignal = Boolean(options && options.signal);
        const controller = hasExternalSignal ? null : new AbortController();
        const signal = hasExternalSignal ? options.signal : (controller ? controller.signal : null);
        const timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : null;

        try {
            const res = await fetch(url, Object.assign({}, options || {}, { signal }));
            if (timer) {
                clearTimeout(timer);
            }
            return res;
        } catch (err) {
            if (timer) {
                clearTimeout(timer);
            }
            throw err;
        }
    }

    async function parseJsonSafe(response) {
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    window.apiClient = {
        async get(url, opts) {
            opts = opts || {};
            const timeout = opts.timeout || DEFAULT_GET_TIMEOUT;
            const retries = typeof opts.retries === 'number' ? opts.retries : DEFAULT_GET_RETRIES;
            const retryDelay = typeof opts.retryDelay === 'number' ? opts.retryDelay : DEFAULT_RETRY_DELAY;

            let attempt = 0;
            while (true) {
                attempt++;
                try {
                    const res = await rawFetch(url, { method: 'GET', headers: opts.headers || {}, signal: opts.signal }, timeout);
                    if (!res.ok) {
                        if (RETRYABLE_STATUS_CODES.includes(res.status)) {
                            const wakeErr = new Error('Server is waking up');
                            wakeErr.code = 'server_wake';
                            wakeErr.status = res.status;
                            throw wakeErr;
                        }

                        const payload = await parseJsonSafe(res);
                        const msg = payload && payload.message ? payload.message : `Request failed (${res.status})`;
                        const err = new Error(msg);
                        err.status = res.status;
                        throw err;
                    }

                    const data = await parseJsonSafe(res);
                    if (data === null) throw new Error('Invalid JSON response');
                    return data;
                } catch (err) {
                    const transient = isTransientError(err);
                    if (attempt <= retries && transient) {
                        const waitMs = retryDelay * attempt;
                        console.warn('[apiClient] Retrying GET', {
                            url: getRequestPath(url),
                            attempt,
                            waitMs,
                            status: err && err.status ? err.status : null,
                            error: err && err.message ? err.message : err && err.name ? err.name : 'Unknown error'
                        });
                        await delay(waitMs);
                        continue;
                    }

                    console.error('[apiClient] GET failed', {
                        url: getRequestPath(url),
                        attempts: attempt,
                        status: err && err.status ? err.status : null,
                        error: err && err.message ? err.message : err && err.name ? err.name : 'Unknown error'
                    });
                    throw err;
                }
            }
        },

        async post(url, body, opts) {
            opts = opts || {};
            const timeout = opts.timeout || DEFAULT_NON_GET_TIMEOUT;
            try {
                const res = await rawFetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}), body: JSON.stringify(body) }, timeout);
                const payload = await parseJsonSafe(res);
                if (!res.ok) {
                    const msg = payload && payload.message ? payload.message : `Request failed (${res.status})`;
                    const err = new Error(msg);
                    err.status = res.status;
                    throw err;
                }
                return payload;
            } catch (err) {
                console.error('apiClient POST error', url, err);
                throw err;
            }
        },

        async put(url, body, opts) {
            opts = opts || {};
            const timeout = opts.timeout || DEFAULT_NON_GET_TIMEOUT;
            try {
                const res = await rawFetch(url, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}), body: JSON.stringify(body) }, timeout);
                const payload = await parseJsonSafe(res);
                if (!res.ok) {
                    const msg = payload && payload.message ? payload.message : `Request failed (${res.status})`;
                    const err = new Error(msg);
                    err.status = res.status;
                    throw err;
                }
                return payload;
            } catch (err) {
                console.error('apiClient PUT error', url, err);
                throw err;
            }
        },

        async delete(url, opts) {
            opts = opts || {};
            const timeout = opts.timeout || DEFAULT_NON_GET_TIMEOUT;
            try {
                const res = await rawFetch(url, { method: 'DELETE', headers: opts.headers || {} }, timeout);
                const payload = await parseJsonSafe(res);
                if (!res.ok) {
                    const msg = payload && payload.message ? payload.message : `Request failed (${res.status})`;
                    const err = new Error(msg);
                    err.status = res.status;
                    throw err;
                }
                return payload;
            } catch (err) {
                console.error('apiClient DELETE error', url, err);
                throw err;
            }
        },

        async cachedGet(cacheKey, url, ttl) {
            ttl = typeof ttl === 'number' ? ttl : 120000;
            try {
                const raw = sessionStorage.getItem(cacheKey);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && parsed.ts && (Date.now() - parsed.ts) < ttl && parsed.data) {
                            // background refresh
                            (async function () {
                                try {
                                    const fresh = await window.apiClient.get(url).catch(function (e) { throw e; });
                                    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: fresh }));
                                } catch (e) {
                                    console.error('Background refresh failed for', url, e);
                                }
                            })();
                            return { data: parsed.data, fromCache: true };
                        }
                    } catch (e) {
                        console.error('Invalid cache data for', cacheKey, e);
                    }
                }

                const data = await window.apiClient.get(url);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data }));
                } catch (e) {
                    // ignore storage set errors
                }
                return { data: data, fromCache: false };
            } catch (err) {
                // if cache exists return it
                const raw2 = sessionStorage.getItem(cacheKey);
                if (raw2) {
                    try {
                        const parsed2 = JSON.parse(raw2);
                        if (parsed2 && parsed2.data) return { data: parsed2.data, fromCache: true };
                    } catch (e) {
                        // fallthrough
                    }
                }
                throw err;
            }
        }
    };
})();
