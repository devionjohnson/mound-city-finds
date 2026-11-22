"""CJ Affiliate Product Search (GraphQL) (disabled until a CJ account, joined advertisers and a token exist).
POST https://ads.api.cj.com/query with Authorization: Bearer <personal access token>.
Keys: CJ_PERSONAL_ACCESS_TOKEN (developers.cj.com > Authentication > Personal Access Tokens),
CJ_COMPANY_ID (CJ account / publisher CID), CJ_WEBSITE_ID (PID of the moundcityfinds.shop property, for tracked links)."""
import json, urllib.request

NAME = "cj"
REQUIRED_ENV = ["CJ_PERSONAL_ACCESS_TOKEN", "CJ_COMPANY_ID", "CJ_WEBSITE_ID"]
URL = "https://ads.api.cj.com/query"
QUERY = """query($cid: ID!, $kw: [String!], $pid: ID!, $limit: Int) {
  shoppingProducts(companyId: $cid, keywords: $kw, limit: $limit) {
    resultList { id title description imageLink advertiserName productType
      price { amount currency } salePrice { amount currency } linkCode(pid: $pid) { clickUrl } }
  }
}"""


def enabled(env):
    from . import missing
    return not missing(env, REQUIRED_ENV)


def parse(data):
    from . import item
    out = []
    for p in (((data.get("data") or {}).get("shoppingProducts") or {}).get("resultList") or []):
        price = (p.get("salePrice") or {}).get("amount") or (p.get("price") or {}).get("amount")
        cur = (p.get("salePrice") or {}).get("currency") or (p.get("price") or {}).get("currency")
        out.append(item(NAME, p.get("advertiserName"), p.get("title"), p.get("description"), p.get("imageLink"), price, cur,
                        (p.get("linkCode") or {}).get("clickUrl"), p.get("id"), p.get("productType")))
    return [o for o in out if o["title"] and o["affiliate_url"]]


def search(query, env, timeout=4, limit=20):
    if not enabled(env):
        return []
    body = json.dumps({"query": QUERY, "variables": {"cid": env["CJ_COMPANY_ID"], "kw": query.split(), "pid": env["CJ_WEBSITE_ID"], "limit": limit}}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Authorization": "Bearer " + env["CJ_PERSONAL_ACCESS_TOKEN"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return parse(json.loads(r.read().decode()))
