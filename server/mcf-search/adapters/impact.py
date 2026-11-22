"""Impact.com catalog item search (disabled until keys exist and brands approve us).
GET https://api.impact.com/Mediapartners/<AccountSID>/Catalogs/ItemSearch?Keyword=<q>&PageSize=N
Basic auth AccountSID:AuthToken, Accept: application/json.
Keys: Impact partner dashboard > Settings (gear) > API > Account SID and Auth Token (read-only token is enough)."""
import base64, json, urllib.parse, urllib.request

NAME = "impact"
REQUIRED_ENV = ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"]


def enabled(env):
    from . import missing
    return not missing(env, REQUIRED_ENV)


def parse(data):
    from . import item
    out = []
    for p in data.get("Items", []):
        out.append(item(NAME, p.get("CampaignName") or p.get("Manufacturer"), p.get("Name"), p.get("Description"), p.get("ImageUrl"),
                        p.get("CurrentPrice") or p.get("OriginalPrice"), p.get("Currency"), p.get("Url"),
                        p.get("CatalogItemId") or p.get("Id"), p.get("Category") or p.get("SubCategory")))
    return [o for o in out if o["title"] and o["affiliate_url"]]


def search(query, env, timeout=4, limit=20):
    if not enabled(env):
        return []
    sid = env["IMPACT_ACCOUNT_SID"]
    url = f"https://api.impact.com/Mediapartners/{urllib.parse.quote(sid)}/Catalogs/ItemSearch?" + urllib.parse.urlencode({"Keyword": query, "PageSize": limit})
    auth = base64.b64encode(f"{sid}:{env['IMPACT_AUTH_TOKEN']}".encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": "Basic " + auth, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return parse(json.loads(r.read().decode()))
