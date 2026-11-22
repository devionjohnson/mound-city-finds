"""Awin product feeds (disabled until an Awin account, joined advertisers and a feed URL exist).
Awin has no real-time product search endpoint; publishers download Create-a-Feed CSV files. Set AWIN_FEED_URL to the
CSV(.gz) download link from Awin > Toolbox > Create-a-Feed (it embeds your feed API key). The feed is cached in memory
for 6 hours and searched locally. Columns used: aw_product_id, product_name, description, merchant_name, aw_image_url,
search_price, currency, aw_deep_link, merchant_category."""
import csv, gzip, io, threading, time, urllib.request

NAME = "awin"
REQUIRED_ENV = ["AWIN_FEED_URL"]
_cache = {"rows": [], "at": 0}
_lock = threading.Lock()


def enabled(env):
    from . import missing
    return not missing(env, REQUIRED_ENV)


def parse_csv(text):
    from . import item
    out = []
    for p in csv.DictReader(io.StringIO(text)):
        out.append(item(NAME, p.get("merchant_name"), p.get("product_name"), p.get("description"), p.get("aw_image_url"),
                        p.get("search_price"), p.get("currency"), p.get("aw_deep_link"), p.get("aw_product_id"), p.get("merchant_category")))
    return [o for o in out if o["title"] and o["affiliate_url"]]


def _rows(env, timeout):
    with _lock:
        if _cache["rows"] and time.time() - _cache["at"] < 6 * 3600:
            return _cache["rows"]
        with urllib.request.urlopen(env["AWIN_FEED_URL"], timeout=max(timeout, 30)) as r:
            raw = r.read()
        if raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        _cache["rows"] = parse_csv(raw.decode("utf-8", "replace"))
        _cache["at"] = time.time()
        return _cache["rows"]


def search(query, env, timeout=4, limit=20):
    if not enabled(env):
        return []
    words = [w for w in query.lower().split() if w]
    hits = [r for r in _rows(env, timeout) if all(w in (r["title"] + " " + r["description"]).lower() for w in words)]
    return hits[:limit]
