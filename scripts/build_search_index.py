#!/usr/bin/env python3
"""Build data/search-index.json, the always-available static search index for moundcityfinds.shop.

Source: products.json (the site's own products). Each item uses the shared search schema:
  id, source, network, merchant, title, description, image, price, currency, affiliate_url, asin,
  category, brand, keywords, url (on-site page)
Network products (Rakuten, FlexOffers, Impact, Awin, CJ) are NOT baked in here; they come live from the
search API so no keys ever touch this static site. Re-run after editing products.json:
  python3 scripts/build_search_index.py
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def build():
    cat = json.load(open(os.path.join(ROOT, "products.json")))
    tag = cat.get("site", {}).get("affiliateTag", "printsquad-20")
    items = []
    for p in cat["products"]:
        slug = p.get("slug")
        if slug and not os.path.exists(os.path.join(ROOT, "products", slug + ".html")):
            sys.exit(f"missing product page for {slug}")
        items.append({
            "id": "amazon:" + p["asin"],
            "source": "site",
            "network": "amazon",
            "merchant": "Amazon",
            "title": p["name"],
            "description": p.get("blurb", ""),
            "image": p.get("photo") or p.get("image", ""),
            "price": None,  # Amazon prices are never shown on the site
            "currency": None,
            "affiliate_url": f"https://www.amazon.com/dp/{p['asin']}?tag={tag}",
            "asin": p["asin"],
            "category": p.get("category", ""),
            "brand": p.get("brand", ""),
            "keywords": p.get("keywords", ""),
            "url": f"products/{slug}.html" if slug else "",
        })
    out = {"version": 1, "updated": cat.get("site", {}).get("updated", ""), "count": len(items), "items": items}
    path = os.path.join(ROOT, "data", "search-index.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {path} ({len(items)} items)")

if __name__ == "__main__":
    build()
