#!/usr/bin/env python3
"""Build data/catalog/ — the Amazon trending catalog for moundcityfinds.shop (item.html, catalog.html, search).

Input: the JSON written by /workspace/mcf-trending/fetch_trending.py (Best Sellers / New Releases lists).
Output (all static, no keys):
  data/catalog/index.json      compact search/browse index: {v, updated, cats:{slug:label}, items:[{a,t,c,s,r,i}]}
  data/catalog/items-<X>.json  full records sharded by the last character of the ASIN (item.html loads one shard)
Hand-made products (products.json) are skipped so they keep their own pages. Items missing ASIN or image are skipped.
Batches: --limit N publishes only the first N eligible items (in fetch order), so the catalog can grow in steps.
  python3 scripts/build_catalog.py --src /workspace/mcf-trending/out/amazon-trending.json --limit 250
"""
import argparse, json, os, re, glob
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "catalog")
TAG = "printsquad-20"
CATS = {  # source category label -> (slug, label shown on site)
    "Home & Kitchen": ("home-kitchen", "Home & Kitchen"),
    "Kitchen & Dining": ("kitchen-dining", "Kitchen & Dining"),
    "Patio, Lawn & Garden": ("patio-garden", "Patio, Lawn & Garden"),
    "Sports & Outdoors": ("sports-outdoors", "Sports, Fitness & Outdoors"),
    "Tools & Home Improvement": ("tools", "Tools & Home Improvement"),
    "Electronics": ("electronics", "Electronics"),
    "Computers": ("computers", "Computers"),
    "Cell Phones & Accessories": ("cell-phones", "Phone Accessories"),
    "Beauty & Personal Care": ("beauty", "Beauty & Personal Care"),
}
NON_PRODUCT = re.compile(r"auto-renewal|subscription|\bplan\b.*\bmonthly\b|gift ?card|egift|digital code|\[digital\]|online game code", re.I)
IMG_RE = re.compile(r"/images/I/([A-Za-z0-9+%\-_.]+?)\.(?:_[^/]*_\.)?(jpg|png)$")

def full_img(img):
    base, ext = img.rsplit(".", 1) if "." in img else (img, "jpg")
    return f"https://m.media-amazon.com/images/I/{base}._AC_SL500_.{ext}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/workspace/mcf-trending/out/amazon-trending.json")
    ap.add_argument("--limit", type=int, default=0, help="publish only the first N eligible items (0 = all)")
    a = ap.parse_args()
    site_asins = {p["asin"] for p in json.load(open(os.path.join(ROOT, "products.json")))["products"]}
    src = json.load(open(a.src))["items"]
    by_cat, seen = {}, set()
    for p in src:
        asin = p.get("asin") or ""
        if not re.fullmatch(r"[A-Z0-9]{10}", asin) or asin in site_asins or asin in seen:
            continue
        m = IMG_RE.search(p.get("image") or "")
        if not m or not p.get("title") or p.get("category") not in CATS or NON_PRODUCT.search(p["title"]):
            continue
        seen.add(asin)
        by_cat.setdefault(p["category"], []).append((p, m.group(1) + ("" if m.group(2) == "jpg" else "." + m.group(2))))
    # round-robin across categories so every batch covers every category (stable: batch N+1 is a superset of batch N)
    items, queues = [], [q for q in by_cat.values()]
    pos = 0
    while any(queues) and (not a.limit or len(items) < a.limit):
        for q in queues:
            if pos < len(q) and (not a.limit or len(items) < a.limit):
                items.append(q[pos])
        pos += 1
        if all(pos >= len(q) for q in queues):
            break
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, "items-*.json")):
        os.remove(f)
    idx, shards = [], {}
    for p, img in items:
        slug, _ = CATS[p["category"]]
        lst = (p.get("list_source") or "").split(" | ")[0]
        sub = p.get("subcategory") or ""
        rec = {
            "id": "amazon:" + p["asin"], "asin": p["asin"], "title": p["title"],
            "description": " ".join(p.get("bullets") or [])[:600],
            "bullets": [b[:400] for b in (p.get("bullets") or [])[:5]],
            "image": full_img(img),
            "price": p.get("price"), "currency": p.get("currency"), "price_fetched_at": p.get("fetched_at") if p.get("price") is not None else None,
            "category": slug, "subcategory": sub, "list": lst, "rank": p.get("list_rank"), "brand": p.get("brand") or "",
            "affiliate_url": f"https://www.amazon.com/dp/{p['asin']}?tag={TAG}", "fetched_at": p.get("fetched_at"),
        }
        shards.setdefault(p["asin"][-1], []).append(rec)
        idx.append({"a": p["asin"], "t": p["title"][:160], "c": slug, "s": sub, "l": "n" if lst.startswith("New") else ("m" if lst.startswith("Movers") else "b"),
                    "r": p.get("list_rank"), "i": img})
    for k, recs in shards.items():
        with open(os.path.join(OUT, f"items-{k}.json"), "w") as f:
            json.dump({"v": 1, "items": recs}, f, ensure_ascii=False, separators=(",", ":"))
    cats = {s: l for s, l in CATS.values()}
    counts = {}
    for it in idx: counts[it["c"]] = counts.get(it["c"], 0) + 1
    doc = {"v": 1, "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "count": len(idx),
           "cats": cats, "counts": counts, "items": idx}
    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"catalog: {len(idx)} items, {len(shards)} shards, index {os.path.getsize(os.path.join(OUT,'index.json'))//1024} KB")

if __name__ == "__main__":
    main()
