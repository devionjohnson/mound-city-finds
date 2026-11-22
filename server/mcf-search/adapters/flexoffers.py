"""FlexOffers Products API (disabled until FLEXOFFERS_API_KEY exists and advertisers approve us).
GET https://api.flexoffers.com/products/full?name=<q>&page=1&pageSize=N with header apiKey: <key>, Accept JSON.
Key: FlexOffers publisher dashboard > Tools > API (Web Services) once the account is approved.
Response fields mapped below follow the documented product shape; verify against a live response once a key exists."""
import json, urllib.parse, urllib.request

NAME = "flexoffers"
REQUIRED_ENV = ["FLEXOFFERS_API_KEY"]
URL = "https://api.flexoffers.com/products/full"


def enabled(env):
    from . import missing
    return not missing(env, REQUIRED_ENV)


def parse(data):
    from . import item
    rows = data.get("results", data) if isinstance(data, dict) else data
    out = []
    for p in rows or []:
        out.append(item(NAME, p.get("advertiserName") or p.get("brand"), p.get("name"), p.get("shortDescription") or p.get("description"),
                        p.get("imageUrl"), p.get("salePrice") or p.get("price"), p.get("currency") or p.get("priceCurrency"),
                        p.get("linkUrl") or p.get("deepLinkURL"), p.get("pid") or p.get("sku") or p.get("id"), p.get("category")))
    return [o for o in out if o["title"] and o["affiliate_url"]]


def search(query, env, timeout=4, limit=20):
    if not enabled(env):
        return []
    url = URL + "?" + urllib.parse.urlencode({"name": query, "page": 1, "pageSize": limit})
    req = urllib.request.Request(url, headers={"apiKey": env["FLEXOFFERS_API_KEY"], "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return parse(json.loads(r.read().decode()))
