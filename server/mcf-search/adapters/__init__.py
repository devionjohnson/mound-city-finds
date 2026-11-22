"""Network adapters. Each module exposes NAME, REQUIRED_ENV, enabled(env) and search(query, env, timeout) -> list[dict].
Items use the shared schema: id, source, network, merchant, title, description, image, price, currency,
affiliate_url, asin, category. Adapters read credentials only from the environment and return [] when
credentials are missing, so a network without keys is skipped cleanly."""
from . import rakuten, flexoffers, impact, awin, cj, amazon_creators

ALL = [rakuten, flexoffers, impact, awin, cj, amazon_creators]


def item(network, merchant, title, description, image, price, currency, affiliate_url, ident, category="", asin=None):
    try:
        price = float(price) if price not in (None, "") else None
    except (TypeError, ValueError):
        price = None
    return {
        "id": f"{network}:{ident}", "source": "live", "network": network, "merchant": (merchant or "").strip(),
        "title": (title or "").strip(), "description": (description or "").strip()[:400], "image": image or "",
        "price": price, "currency": (currency or "USD") if price is not None else None,
        "affiliate_url": affiliate_url or "", "asin": asin, "category": category or "",
    }


def missing(env, names):
    return [n for n in names if not env.get(n)]
