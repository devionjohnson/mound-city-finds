/* Mound City Finds trending catalog (data/catalog/). Powers item.html?asin=… and catalog.html?cat=…
   Products come from Amazon's public Best Sellers / New Releases lists. Real Amazon product photos only.
   Add to cart goes through cart.js (by ASIN). Amazon prices are not shown on the site (site rule). */
(function () {
  "use strict";
  var script = document.currentScript;
  var base = new URL(".", script ? script.src : window.location.href);
  var idx = null, shards = {};
  var LIST = { b: "Best Sellers", n: "New Releases", m: "Movers & Shakers" };
  function esc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function u(p) { return new URL(p, base).toString(); }
  function img(i) { var d = i.lastIndexOf("."), b = d > 0 ? i.slice(0, d) : i, e = d > 0 ? i.slice(d + 1) : "jpg"; return "https://m.media-amazon.com/images/I/" + b + "._AC_SL500_." + e; }
  function aff(a) { return "https://www.amazon.com/dp/" + a + "?tag=printsquad-20"; }
  function itemUrl(a) { return u("item.html?asin=" + encodeURIComponent(a)); }
  function catUrl(c) { return u("catalog.html?cat=" + encodeURIComponent(c)); }
  function loadIndex() {
    if (!idx) idx = fetch(u("data/catalog/index.json"), { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("catalog " + r.status); return r.json(); })
      .catch(function (e) { idx = null; throw e; });
    return idx;
  }
  function loadItem(asin) {
    var k = asin.slice(-1);
    if (!shards[k]) shards[k] = fetch(u("data/catalog/items-" + k + ".json"), { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("shard " + r.status); return r.json(); });
    return shards[k].then(function (s) { return (s.items || []).filter(function (x) { return x.asin === asin; })[0] || null; });
  }
  function rankLine(it, cats) {
    var where = it.s || (cats && cats[it.c]) || "";
    return it.r ? "#" + it.r + " in " + (LIST[it.l] || "Best Sellers") + (where ? " · " + where : "") : where;
  }
  /* Search-index rows (same schema as data/search-index.json) */
  function searchItems() {
    return loadIndex().then(function (d) {
      return d.items.map(function (it) {
        return { id: "amazon:" + it.a, source: "catalog", network: "amazon", merchant: "Amazon", title: it.t, description: rankLine(it, d.cats),
          image: img(it.i), price: null, currency: null, affiliate_url: aff(it.a), asin: it.a, category: d.cats[it.c] || "",
          brand: "", keywords: it.s || "", url: "item.html?asin=" + it.a };
      });
    });
  }
  function cartData(a, title, image) {
    return esc(JSON.stringify({ id: "amazon:" + a, asin: a, network: "amazon", title: title, image: image, merchant: "Amazon", affiliate_url: aff(a), page: itemUrl(a) }));
  }
  function addBtn(a, title, image, cls) {
    return '<a class="' + cls + '" href="' + esc(aff(a)) + '" data-cart-item="' + cartData(a, title, image) +
      '" target="_blank" rel="sponsored nofollow noopener">Add to cart<span class="visually-hidden"> ' + esc(title) + "</span></a>";
  }
  function card(it, cats) {
    var page = itemUrl(it.a), im = img(it.i);
    return '<article class="card hq-card sr-card">' +
      '<div class="card-top"><a class="card-thumb" href="' + esc(page) + '" tabindex="-1" aria-hidden="true">' +
      '<img src="' + esc(im) + '" alt="' + esc(it.t) + '" width="250" height="250" loading="lazy" decoding="async"></a></div>' +
      '<p class="cat-pill">' + esc(cats[it.c] || "") + "</p>" +
      '<h3><a class="card-title-link" href="' + esc(page) + '">' + esc(it.t) + "</a></h3>" +
      '<p class="blurb">' + esc(rankLine(it, cats)) + "</p>" +
      '<div class="card-actions">' + addBtn(it.a, it.t, im, "cmp-btn cmp-amazon sr-add") + "</div></article>";
  }

  /* ---------- item.html ---------- */
  function renderItem(root) {
    var asin = (new URLSearchParams(location.search).get("asin") || "").toUpperCase();
    var miss = function () { document.title = "Find not found — Mound City Finds"; root.innerHTML = '<p class="eyebrow">Trending finds</p><h1>We couldn’t find that item</h1><p class="lede">It may have dropped off the trending lists. <a href="' + esc(u("catalog.html")) + '">Browse trending finds →</a></p>'; };
    if (!/^[A-Z0-9]{10}$/.test(asin)) return miss();
    Promise.all([loadItem(asin), loadIndex()]).then(function (r) {
      var p = r[0], d = r[1];
      if (!p) return miss();
      var catLabel = d.cats[p.category] || "";
      document.title = p.title.slice(0, 70) + " — Mound City Finds";
      var row = { a: p.asin, s: p.subcategory, c: p.category, r: p.rank, l: p.list && p.list.indexOf("New") === 0 ? "n" : "b" };
      var bullets = p.bullets || [];
      var related = d.items.filter(function (x) { return x.c === p.category && x.a !== p.asin; }).slice(0, 4);
      root.innerHTML =
        '<p class="crumbs"><a href="' + esc(u("index.html")) + '">Headquarters</a> · <a href="' + esc(u("catalog.html")) + '">Trending</a> · ' +
        '<a href="' + esc(catUrl(p.category)) + '">' + esc(catLabel) + "</a></p>" +
        '<p class="eyebrow"><a href="' + esc(catUrl(p.category)) + '">' + esc(catLabel) + "</a></p>" +
        "<h1>" + esc(p.title) + "</h1>" +
        '<figure class="product-hero"><img class="product-hero-img" src="' + esc(p.image) + '" alt="' + esc(p.title) + '" width="500" height="500" decoding="async">' +
        '<figcaption><span class="cap-photo">Product image from Amazon.</span></figcaption></figure>' +
        '<p class="item-rank">' + esc(rankLine(row, d.cats)) + "</p>" +
        '<div class="buy-box item-buy">' + addBtn(p.asin, p.title, p.image, "cmp-btn cmp-amazon item-add") +
        '<a class="buy-link" href="' + esc(p.affiliate_url) + '" data-cart-skip target="_blank" rel="sponsored nofollow noopener">See today’s price at Amazon<span class="visually-hidden"> (opens in a new tab)</span></a></div>' +
        (bullets.length ? '<div class="article-body"><h2>Highlights from the listing</h2><ul>' + bullets.slice(0, 5).map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul></div>" : "") +
        (related.length ? '<section class="item-related"><h2>More trending in ' + esc(catLabel) + '</h2><div class="grid">' + related.map(function (x) { return card(x, d.cats); }).join("") + "</div>" +
          '<p><a class="buy-link" href="' + esc(catUrl(p.category)) + '">See all ' + esc(catLabel) + ' finds <span aria-hidden="true">→</span></a></p></section>' : "");
    }).catch(function (e) { console.error(e); miss(); });
  }

  /* ---------- catalog.html ---------- */
  function renderCatalog(root) {
    var cat = new URLSearchParams(location.search).get("cat") || "";
    var head = document.getElementById("catalog-heading"), status = document.getElementById("catalog-status"), nav = document.getElementById("catalog-cats");
    loadIndex().then(function (d) {
      var slugs = Object.keys(d.cats).filter(function (c) { return d.counts[c]; });
      nav.innerHTML = '<a class="guide-chip bouncy' + (!cat ? " is-on" : "") + '" href="' + esc(u("catalog.html")) + '">All</a>' +
        slugs.map(function (c) { return '<a class="guide-chip bouncy' + (c === cat ? " is-on" : "") + '" href="' + esc(catUrl(c)) + '">' + esc(d.cats[c]) + "</a>"; }).join("");
      if (cat && !d.cats[cat]) cat = "";
      var list = d.items.filter(function (x) { return !cat || x.c === cat; });
      if (cat) { head.textContent = "Trending in " + d.cats[cat]; document.title = "Trending in " + d.cats[cat] + " — Mound City Finds"; }
      status.textContent = list.length + (list.length === 1 ? " find" : " finds") + " from Amazon’s Best Sellers and New Releases lists.";
      var shown = 0, PAGE = 48;
      root.innerHTML = '<div class="grid" id="catalog-grid"></div><p class="catalog-more-wrap"><button type="button" class="cart-keep catalog-more" id="catalog-more">Show more</button></p>';
      var grid = document.getElementById("catalog-grid"), more = document.getElementById("catalog-more");
      function next() { grid.insertAdjacentHTML("beforeend", list.slice(shown, shown + PAGE).map(function (x) { return card(x, d.cats); }).join("")); shown += PAGE; more.hidden = shown >= list.length; }
      more.addEventListener("click", next); next();
    }).catch(function (e) { console.error(e); status.textContent = "Trending finds are unavailable right now."; });
  }

  window.MCFCatalog = { searchItems: searchItems, loadIndex: loadIndex, loadItem: loadItem };
  function init() {
    var ir = document.getElementById("item-page"), cr = document.getElementById("catalog-page");
    if (ir) renderItem(ir);
    if (cr) renderCatalog(cr);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
