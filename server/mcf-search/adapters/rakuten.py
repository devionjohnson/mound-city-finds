"""Rakuten Advertising Product Search API (live).
Auth: POST https://api.linksynergy.com/token, header Authorization: Bearer base64(client_id:client_secret),
form body scope=<SID>. Returns access_token (expires_in 3600). Search: GET
https://api.linksynergy.com/productsearch/1.0?keyword=..&max=N with Authorization: Bearer <access_token>; XML.
Only returns products from advertisers the publisher is partnered with.
Env: RAKUTEN_CLIENT_ID, RAKUTEN_CLIENT_SECRET, RAKUTEN_SID (Developer Portal > Applications; SID in publisher dashboard)."""
import base64, json, threading, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

NAME = "rakuten"
REQUIRED_ENV = ["RAKUTEN_CLIENT_ID", "RAKUTEN_CLIENT_SECRET", "RAKUTEN_SID"]
TOKEN_URL = "https://api.linksynergy.com/token"
SEARCH_URL = "https://api.linksynergy.com/productsearch/1.0"
_lock = threading.Lock()
_token = {"value": None, "exp": 0}


def enabled(env):
    from . import missing
    return not missing(env, REQUIRED_ENV)


def get_token(env, timeout=5):
    with _lock:
        if _token["value"] and _token["exp"] - 120 > time.time():
            return _token["value"]
        key = base64.b64encode(f"{env['RAKUTEN_CLIENT_ID']}:{env['RAKUTEN_CLIENT_SECRET']}".encode()).decode()
        req = urllib.request.Request(TOKEN_URL, data=urllib.parse.urlencode({"scope": env["RAKUTEN_SID"]}).encode(),
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded",
                                              "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
        _token["value"] = data["access_token"]
        _token["exp"] = time.time() + int(data.get("expires_in", 3600))
        return _token["value"]


def _t(el, path):
    x = el.find(path)
    return (x.text or "").strip() if x is not None and x.text else ""


def parse(xml_text):
    from . import item
    root = ET.fromstring(xml_text)
    out = []
    for it in root.iter("item"):
        price_el = it.find("saleprice") if it.find("saleprice") is not None and _t(it, "saleprice") else it.find("price")
        price = (price_el.text or "").strip() if price_el is not None and price_el.text else None
        cur = price_el.get("currency") if price_el is not None else None
        out.append(item(NAME, _t(it, "merchantname"), _t(it, "productname"),
                        _t(it, "description/short") or _t(it, "description/long"), _t(it, "imageurl"), price, cur,
                        _t(it, "linkurl"), f"{_t(it, 'mid')}-{_t(it, 'sku') or _t(it, 'linkid')}", _t(it, "category/primary")))
    return [o for o in out if o["title"] and o["affiliate_url"]]


def search(query, env, timeout=4, limit=20):
    if not enabled(env):
        return []
    tok = get_token(env, timeout)
    url = SEARCH_URL + "?" + urllib.parse.urlencode({"keyword": query, "max": limit})
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok, "Accept": "application/xml"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return parse(r.read().decode("utf-8", "replace"))
