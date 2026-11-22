#!/usr/bin/env python3
"""mcf-search: live product search API for moundcityfinds.shop (stdlib only).

GET /v1/search?q=<query>  -> {"query", "results": [...], "networks": {...}, "cached": bool}
GET /health               -> {"ok": true, "adapters": {...}, "site_items": N}

- Queries every enabled network adapter in parallel with a short timeout, merges with the site's own products.
- Credentials come only from the environment (systemd EnvironmentFile=/etc/mcf-search.env, root-only).
- Caches results briefly, rate-limits per client IP, CORS limited to the site origins. Binds to localhost only;
  Caddy terminates TLS for api.moundcityfinds.shop and proxies here.
Result items: id, source, network, merchant, title, description, image, price, currency, affiliate_url, asin, category."""
import json, logging, os, re, sys, threading, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, wait
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adapters  # noqa: E402

HOST = os.environ.get("MCF_SEARCH_HOST", "127.0.0.1")
PORT = int(os.environ.get("MCF_SEARCH_PORT", "8020"))
ORIGINS = {o.strip() for o in os.environ.get("MCF_ALLOWED_ORIGINS", "https://moundcityfinds.shop,https://www.moundcityfinds.shop").split(",") if o.strip()}
SITE_INDEX_URL = os.environ.get("MCF_SITE_INDEX_URL", "https://moundcityfinds.shop/data/search-index.json")
NETWORK_TIMEOUT = float(os.environ.get("MCF_NETWORK_TIMEOUT", "3.0"))
CACHE_TTL = int(os.environ.get("MCF_CACHE_TTL", "180"))
RATE = int(os.environ.get("MCF_RATE_PER_MIN", "30"))
MAX_RESULTS = 40

log = logging.getLogger("mcf-search")
pool = ThreadPoolExecutor(max_workers=12)
_cache, _cache_lock = {}, threading.Lock()
_hits, _hits_lock = {}, threading.Lock()
_site = {"items": [], "at": 0}
_status = {}


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def stem(w):
    if len(w) > 4 and w.endswith("ies"): return w[:-3] + "y"
    if len(w) > 4 and re.search(r"(sses|shes|ches|xes|zes)$", w): return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"): return w[:-1]
    return w


def site_items():
    if time.time() - _site["at"] > 600:
        try:
            with urllib.request.urlopen(SITE_INDEX_URL, timeout=5) as r:
                _site["items"] = json.loads(r.read().decode()).get("items", [])
            _site["at"] = time.time()
        except Exception as e:  # keep the last good copy
            log.warning("site index refresh failed: %s", type(e).__name__)
            _site["at"] = time.time() - 540
    return _site["items"]


def site_search(q):
    terms = [stem(t) for t in norm(q).split()]
    if not terms: return []
    out = []
    for it in site_items():
        words = [stem(w) for w in norm(" ".join([it.get("title", ""), it.get("brand", ""), it.get("category", ""), it.get("keywords", "")])).split()]
        if all(any(w.startswith(t) for w in words) for t in terms):
            out.append({k: it.get(k) for k in ("id", "source", "network", "merchant", "title", "description", "image", "price", "currency", "affiliate_url", "asin", "category", "url")})
    return out


def network_search(q):
    env = dict(os.environ)
    jobs, status = {}, {}
    for a in adapters.ALL:
        if a.enabled(env):
            jobs[pool.submit(a.search, q, env, NETWORK_TIMEOUT)] = a.NAME
        else:
            status[a.NAME] = "disabled"
    done, not_done = wait(jobs, timeout=NETWORK_TIMEOUT + 0.5)
    results = []
    for f in done:
        name = jobs[f]
        try:
            r = f.result()
            status[name] = f"ok:{len(r)}"
            results.extend(r)
        except Exception as e:
            status[name] = "error:" + type(e).__name__
            log.warning("%s failed: %s", name, type(e).__name__)
    for f in not_done:
        status[jobs[f]] = "timeout"
    return results, status


def search(q):
    key = norm(q)
    with _cache_lock:
        c = _cache.get(key)
        if c and time.time() - c[0] < CACHE_TTL:
            return dict(c[1], cached=True)
    net, status = network_search(q)
    seen, merged = set(), []
    for it in site_search(q) + net:
        if it["id"] in seen: continue
        seen.add(it["id"]); merged.append(it)
    body = {"query": q, "results": merged[:MAX_RESULTS], "networks": status, "cached": False}
    with _cache_lock:
        if len(_cache) > 2000: _cache.clear()
        _cache[key] = (time.time(), body)
    return body


def allowed(ip):
    now = time.time()
    with _hits_lock:
        h = [t for t in _hits.get(ip, []) if now - t < 60]
        if len(h) >= RATE:
            _hits[ip] = h
            return False
        h.append(now); _hits[ip] = h
        if len(_hits) > 10000: _hits.clear()
        return True


class Handler(BaseHTTPRequestHandler):
    server_version = "mcf-search"
    sys_version = ""

    def log_message(self, fmt, *args):  # no query strings in logs
        log.info("%s %s", self.command, self.path.split("?")[0])

    def client_ip(self):
        peer = self.client_address[0]
        fwd = self.headers.get("X-Forwarded-For", "")
        return fwd.split(",")[0].strip() if peer == "127.0.0.1" and fwd else peer

    def cors(self):
        o = self.headers.get("Origin")
        if o in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")

    def send_json(self, code, obj, cache=0):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", f"public, max-age={cache}" if cache else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.cors()
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204 if self.headers.get("Origin") in ORIGINS else 403)
        self.cors(); self.end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/health":
            env = dict(os.environ)
            return self.send_json(200, {"ok": True, "adapters": {a.NAME: ("enabled" if a.enabled(env) else "disabled") for a in adapters.ALL},
                                        "site_items": len(site_items())})
        if u.path != "/v1/search":
            return self.send_json(404, {"error": "not found"})
        o = self.headers.get("Origin")
        if o and o not in ORIGINS:
            return self.send_json(403, {"error": "origin not allowed"})
        if not allowed(self.client_ip()):
            return self.send_json(429, {"error": "slow down"})
        q = (urllib.parse.parse_qs(u.query).get("q") or [""])[0].strip()[:100]
        if len(norm(q)) < 2:
            return self.send_json(400, {"error": "query too short"})
        return self.send_json(200, search(q), cache=60)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    site_items()
    ThreadingHTTPServer.request_queue_size = 64
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    srv.daemon_threads = True
    log.info("mcf-search listening on %s:%s", HOST, PORT)
    srv.serve_forever()


if __name__ == "__main__":
    main()
