#!/usr/bin/env python3
"""Static checks for Mound City Finds. Run before every commit: python3 scripts/check_site.py"""
import glob, json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
errors = []

for f in ["products.json", "retailers.json", "setups.json"] + glob.glob("data/index/*.json") + glob.glob("data/catalog/*.json"):
    try:
        json.load(open(f))
    except Exception as e:
        errors.append(f"{f}: invalid JSON ({e})")

catalog = json.load(open("products.json"))
for p in catalog["products"]:
    if not re.fullmatch(r"[A-Z0-9]{10}", p.get("asin", "")):
        errors.append(f"bad ASIN for {p.get('name')}")
    if p.get("slug") and not os.path.exists(f"products/{p['slug']}.html"):
        errors.append(f"missing page products/{p['slug']}.html")
for s in json.load(open("setups.json"))["setups"]:
    for a in s["asins"]:
        if a not in {p["asin"] for p in catalog["products"]}:
            errors.append(f"setup {s['id']} ASIN {a} not in products.json")

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k in ("href", "src"):
            if a.get(k): self.refs.append(a[k])

pages = sorted(glob.glob("*.html") + glob.glob("*/*.html"))
for page in pages:
    text = open(page, encoding="utf-8").read()
    prefix = "../" if "/" in page else ""
    for js in ("hq.js", "cart.js", "search.js"):
        if f'src="{prefix}{js}"' not in text and f'src="/{js}"' not in text:
            errors.append(f"{page}: missing {js}")
    body = text.split("<body", 1)[-1]
    n = body.count("As an Amazon Associate I earn")
    if n != 1 and page not in ("privacy.html", "terms.html"):  # policy pages quote the sentence in their text
        errors.append(f"{page}: disclosure appears {n} times in body (want exactly 1)")
    if not re.search(r'<footer[\s\S]*As an Amazon Associate I earn[\s\S]*</footer>', body):
        errors.append(f"{page}: disclosure not in footer")
    lp = Links(); lp.feed(text)
    for ref in lp.refs:
        if re.match(r"^(https?:|mailto:|tel:|#|data:|javascript:)", ref) or ref.startswith("//"):
            continue
        path = ref.split("#")[0].split("?")[0]
        if not path:
            continue
        full = path.lstrip("/") if path.startswith("/") else os.path.normpath(os.path.join(os.path.dirname(page), path))
        if not os.path.exists(full):
            errors.append(f"{page}: broken local link {ref}")

if os.path.exists("data/catalog/index.json"):
    cidx = json.load(open("data/catalog/index.json"))
    shard_asins = set()
    for f in glob.glob("data/catalog/items-*.json"):
        for it in json.load(open(f))["items"]:
            shard_asins.add(it["asin"])
            if not it.get("image", "").startswith("https://m.media-amazon.com/images/I/"):
                errors.append(f"catalog {it['asin']}: image is not an Amazon product photo")
            if it.get("affiliate_url") != f"https://www.amazon.com/dp/{it['asin']}?tag=printsquad-20":
                errors.append(f"catalog {it['asin']}: bad affiliate_url")
    for it in cidx["items"]:
        if not re.fullmatch(r"[A-Z0-9]{10}", it["a"]) or not it.get("i") or it["a"] not in shard_asins:
            errors.append(f"catalog index {it.get('a')}: bad ASIN/image or missing from shards")
        if it["a"] in {p["asin"] for p in catalog["products"]}:
            errors.append(f"catalog index {it['a']}: duplicates a hand-made product")
    if cidx["count"] != len(cidx["items"]):
        errors.append("catalog index count mismatch")

for js in glob.glob("*.js"):
    t = open(js).read()
    if re.search(r"(api[_-]?key|secret|bearer|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{12,}", t, re.I):
        errors.append(f"{js}: looks like a credential in client JS")

if errors:
    print("\n".join(errors)); print(f"FAIL: {len(errors)} problem(s)"); sys.exit(1)
print(f"OK: {len(pages)} pages, {len(catalog['products'])} products checked")
