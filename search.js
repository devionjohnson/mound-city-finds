/* Mound City Finds search. Results stay on moundcityfinds.shop.
   1) The static index (data/search-index.json, the site's own products) answers instantly, always.
   2) The live search API (network products, keys held server-side) is merged in when it answers within
      a short timeout. If it is unreachable, nothing visible happens: the static results stand.
   Adding a result puts it in the on-site cart (cart.js). No Amazon search fallback. */
(function () {
  "use strict";
  var script = document.currentScript;
  var base = new URL(".", script ? script.src : window.location.href);
  var API = "https://api.moundcityfinds.shop/v1/search";
  var API_TIMEOUT = 2500, API_DOWN_KEY = "mcf-api-down";
  var input = document.getElementById("site-search-input");
  var panel = document.getElementById("site-search-results");
  var pageRoot = document.getElementById("search-page");
  var index = null, loading = null, timer = null, activeIndex = -1, seq = 0;
  var apiCache = {};

  function esc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function norm(v) { return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  var STOP = { the: 1, a: 1, an: 1, and: 1, or: 1, "for": 1, of: 1, to: 1, with: 1, in: 1, on: 1, my: 1, me: 1, best: 1 };
  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /(sses|shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function terms(q) { return norm(q).split(" ").filter(function (t) { return t && !STOP[t]; }).map(stem); }
  function near(a, b) { // edit distance <= 1
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, e = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++e > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return e + (a.length - i) + (b.length - j) <= 1;
  }
  function prep(it) {
    if (it._words) return it;
    it._title = norm(it.title).split(" ").map(stem);
    it._words = norm([it.title, it.brand, it.category, it.merchant, it.keywords].join(" ")).split(" ").map(stem);
    it._desc = norm(it.description).split(" ").map(stem);
    return it;
  }
  function termScore(t, it) {
    var best = 0;
    function check(words, w) {
      for (var k = 0; k < words.length; k++) {
        var x = words[k];
        if (x === t) { best = Math.max(best, 4 * w); }
        else if (t.length >= 2 && x.indexOf(t) === 0) { best = Math.max(best, 3 * w); }
        else if (t.length >= 5 && near(t, x)) { best = Math.max(best, 2 * w); }
      }
    }
    check(it._title, 1.5); check(it._words, 1); if (!best) check(it._desc, 0.5);
    return best;
  }
  function rank(items, q) {
    var ts = terms(q);
    if (!ts.length) return [];
    var scored = items.map(function (it) {
      prep(it);
      var s = 0, hit = 0;
      ts.forEach(function (t) { var v = termScore(t, it); if (v) { hit++; s += v; } });
      return { it: it, s: s, hit: hit };
    });
    var all = scored.filter(function (x) { return x.hit === ts.length; });
    // Multi-word query with no item matching every word: show items matching most of the words.
    if (!all.length && ts.length > 1) {
      var need = Math.ceil(ts.length / 2);
      all = scored.filter(function (x) { return x.hit >= need; });
    }
    return all.sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.it; });
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch(new URL("data/search-index.json", base).toString(), { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("index " + r.status); return r.json(); })
        .then(function (j) { return j.items || []; })
        .catch(function () { // fallback: build from products.json
          return fetch(new URL("products.json", base).toString()).then(function (r) { return r.json(); }).then(function (c) {
            var tag = (c.site && c.site.affiliateTag) || "printsquad-20";
            return (c.products || []).map(function (p) {
              return { id: "amazon:" + p.asin, source: "site", network: "amazon", merchant: "Amazon", title: p.name, description: p.blurb,
                image: p.photo, price: null, currency: null, affiliate_url: "https://www.amazon.com/dp/" + p.asin + "?tag=" + tag,
                asin: p.asin, category: p.category, brand: p.brand, keywords: p.keywords, url: p.slug ? "products/" + p.slug + ".html" : "" };
            });
          });
        })
        .then(function (items) {
          // Merge the trending catalog (data/catalog/index.json via catalog.js, or fetched directly). Site products win on duplicate ASINs.
          var have = {}; items.forEach(function (it) { if (it.asin) have[it.asin] = 1; });
          return loadCatalog().then(function (cat) {
            return items.concat(cat.filter(function (it) { return !have[it.asin]; }));
          }).catch(function () { return items; });
        })
        .then(function (items) { index = items; return items; })
        .catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }
  function loadCatalog() {
    if (window.MCFCatalog) return window.MCFCatalog.searchItems();
    return fetch(new URL("data/catalog/index.json", base).toString(), { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("catalog " + r.status); return r.json(); })
      .then(function (d) {
        var LIST = { b: "Best Sellers", n: "New Releases", m: "Movers & Shakers" };
        return (d.items || []).map(function (it) {
          var dot = it.i.lastIndexOf("."), b = dot > 0 ? it.i.slice(0, dot) : it.i, e = dot > 0 ? it.i.slice(dot + 1) : "jpg";
          var where = it.s || d.cats[it.c] || "";
          return { id: "amazon:" + it.a, source: "catalog", network: "amazon", merchant: "Amazon", title: it.t,
            description: it.r ? "#" + it.r + " in " + (LIST[it.l] || "Best Sellers") + (where ? " · " + where : "") : where,
            image: "https://m.media-amazon.com/images/I/" + b + "._AC_SL500_." + e, price: null, currency: null,
            affiliate_url: "https://www.amazon.com/dp/" + it.a + "?tag=printsquad-20", asin: it.a, category: d.cats[it.c] || "",
            brand: "", keywords: it.s || "", url: "item.html?asin=" + it.a };
        });
      });
  }
  function apiDown() { try { return Number(sessionStorage.getItem(API_DOWN_KEY) || 0) > Date.now(); } catch (e) { return false; } }
  function markDown() { try { sessionStorage.setItem(API_DOWN_KEY, String(Date.now() + 10 * 60 * 1000)); } catch (e) {} }
  function live(q) {
    var key = norm(q);
    if (apiCache[key]) return Promise.resolve(apiCache[key]);
    if (!API || apiDown() || !window.fetch || !window.AbortController) return Promise.resolve([]);
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, API_TIMEOUT);
    return fetch(API + "?q=" + encodeURIComponent(q), { signal: ctl.signal, mode: "cors", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .then(function (j) {
        clearTimeout(t);
        var items = (j.results || []).filter(function (it) { return it && it.title && it.affiliate_url && it.network !== "amazon"; })
          .map(function (it, i) { it.id = it.id || (it.network + ":" + (it.sku || it.affiliate_url)); it.source = it.source || "live"; return it; });
        apiCache[key] = items;
        return items;
      })
      .catch(function () { clearTimeout(t); markDown(); return []; });
  }

  function money(p, c) {
    if (typeof p !== "number" || !isFinite(p)) return "";
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(p); } catch (e) { return "$" + p.toFixed(2); }
  }
  function pageUrl(it) { return it.url ? new URL(it.url, base).toString() : ""; }
  function resultsUrl(q, it) { return new URL("search.html", base).toString() + "?q=" + encodeURIComponent(q) + (it ? "#r-" + encodeURIComponent(it.id) : ""); }
  function cartPayload(it) {
    return esc(JSON.stringify({ id: it.id, asin: it.asin || null, network: it.network, title: it.title, image: it.image, merchant: it.merchant,
      affiliate_url: it.affiliate_url, price: it.asin ? null : it.price, currency: it.currency, page: pageUrl(it) }));
  }
  function priceOf(it) { return it.asin ? "" : money(it.price, it.currency); } // never show Amazon prices
  function addBtn(it, cls) {
    // href is the item's affiliate link (works without JS); cart.js turns the click into an on-site cart add.
    return '<a class="' + cls + '" href="' + esc(it.affiliate_url) + '" data-cart-item="' + cartPayload(it) +
      '" target="_blank" rel="sponsored nofollow noopener">Add to cart<span class="visually-hidden"> ' + esc(it.title) + "</span></a>";
  }

  /* ---------- header dropdown ---------- */
  function options() { return panel ? panel.querySelectorAll(".ss-option") : []; }
  function setActive(i) {
    var opts = options();
    activeIndex = i;
    for (var k = 0; k < opts.length; k++) {
      opts[k].classList.toggle("is-active", k === i);
      opts[k].setAttribute("aria-selected", k === i ? "true" : "false");
    }
    if (i >= 0 && opts[i]) { input.setAttribute("aria-activedescendant", opts[i].id); opts[i].scrollIntoView({ block: "nearest" }); }
    else input.removeAttribute("aria-activedescendant");
  }
  function closePanel() { if (!panel) return; panel.hidden = true; input.setAttribute("aria-expanded", "false"); setActive(-1); }
  function openPanel() { panel.hidden = false; input.setAttribute("aria-expanded", "true"); }
  function renderPanel(q, hits) {
    var html = "";
    hits.slice(0, 6).forEach(function (it, i) {
      var href = pageUrl(it) || resultsUrl(q, it);
      var price = priceOf(it);
      html += '<div class="ss-row">' +
        '<a class="ss-option" id="ss-opt-' + i + '" role="option" aria-selected="false" href="' + esc(href) + '">' +
        '<img class="ss-thumb" src="' + esc(it.image) + '" alt="" width="56" height="56" loading="lazy">' +
        '<span class="ss-text"><span class="ss-name">' + esc(it.title) + '</span><span class="ss-cat">' +
        esc([it.category, it.asin ? "" : it.merchant].filter(Boolean).join(" · ")) + (price ? ' · <b class="ss-price">' + esc(price) + "</b>" : "") +
        "</span></span></a>" + addBtn(it, "ss-add") + "</div>";
    });
    if (hits.length) {
      html += '<a class="ss-all" href="' + esc(resultsUrl(q)) + '">See all ' + hits.length + (hits.length === 1 ? " result" : " results") + " for “" + esc(q.trim()) + "”</a>";
    } else {
      html += '<p class="ss-none">No finds match “' + esc(q.trim()) + '” yet. Try another word, like “bottle” or “skin care”.</p>';
    }
    panel.innerHTML = html;
    panel.setAttribute("data-q", q);
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    openPanel();
  }
  function search(q) {
    return loadIndex().then(function (items) { return rank(items, q); });
  }
  function update() {
    var q = input.value, my = ++seq;
    if (!q.trim()) { closePanel(); panel.innerHTML = ""; return; }
    search(q).then(function (local) {
      if (my !== seq) return;
      renderPanel(q, local);
      live(q).then(function (remote) {
        if (my !== seq || !remote.length) return;
        renderPanel(q, local.concat(rank(remote, q).length ? rank(remote, q) : remote));
      });
    }).catch(function (e) {
      console.error(e);
      panel.innerHTML = '<p class="ss-none">Search is unavailable right now.</p>';
      openPanel();
    });
  }
  if (input && panel) {
    var wrap = input.closest(".site-search");
    var form = input.closest("form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var opts = options();
      if (!panel.hidden && activeIndex >= 0 && opts[activeIndex]) { opts[activeIndex].click(); return; }
      if (input.value.trim()) window.location.href = resultsUrl(input.value.trim());
    });
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(update, 150); });
    input.addEventListener("focus", function () { loadIndex().catch(function () {}); if (input.value.trim() && panel.innerHTML) openPanel(); });
    input.addEventListener("keydown", function (e) {
      var opts = options();
      if (e.key === "Escape") { if (!panel.hidden) { e.preventDefault(); closePanel(); } else if (input.value) input.value = ""; return; }
      if (e.key === "ArrowDown") { e.preventDefault(); if (panel.hidden && input.value.trim()) { update(); return; } if (opts.length) setActive((activeIndex + 1) % opts.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (opts.length) setActive(activeIndex <= 0 ? opts.length - 1 : activeIndex - 1); }
      else if (e.key === "Enter" && !form) {
        e.preventDefault();
        if (!panel.hidden && activeIndex >= 0 && opts[activeIndex]) opts[activeIndex].click();
        else if (input.value.trim()) window.location.href = resultsUrl(input.value.trim());
      }
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target) && !(e.target.closest && e.target.closest("dialog"))) closePanel(); });
    document.addEventListener("focusin", function (e) { if (!wrap.contains(e.target) && !(e.target.closest && e.target.closest("dialog"))) closePanel(); });
  }

  /* ---------- search.html results page ---------- */
  function card(it) {
    var page = pageUrl(it), price = priceOf(it);
    return '<article class="card hq-card sr-card" id="r-' + esc(it.id) + '">' +
      '<div class="card-top"><' + (page ? 'a class="card-thumb" href="' + esc(page) + '" tabindex="-1" aria-hidden="true"' : 'div class="card-thumb"') + '>' +
      '<img src="' + esc(it.image) + '" alt="' + esc(it.title) + '" width="250" height="250" loading="lazy" decoding="async"></' + (page ? "a" : "div") + "></div>" +
      '<p class="cat-pill">' + esc(it.category || it.merchant) + "</p>" +
      "<h3>" + (page ? '<a class="card-title-link" href="' + esc(page) + '">' + esc(it.title) + "</a>" : esc(it.title)) + "</h3>" +
      (it.asin ? "" : '<p class="sr-merchant">' + esc(it.merchant) + (price ? ' · <b class="sr-price">' + esc(price) + "</b>" : "") + "</p>") +
      '<p class="blurb">' + esc(it.description) + "</p>" +
      '<div class="card-actions">' + addBtn(it, "cmp-btn cmp-amazon sr-add") +
      (page ? '<a class="buy-link" href="' + esc(page) + '">' + (it.source === "catalog" ? "See the find" : "Read the buying guide") + ' <span aria-hidden="true">→</span></a>' : "") +
      "</div></article>";
  }
  function renderPage() {
    var q = (new URLSearchParams(window.location.search).get("q") || "").trim();
    var head = document.getElementById("search-heading"), status = document.getElementById("search-status");
    var box = document.getElementById("search-page-input");
    if (box) box.value = q;
    if (input && !input.value) input.value = q;
    if (!q) { status.textContent = "Type what you’re looking for above."; pageRoot.innerHTML = ""; return; }
    head.textContent = "Results for “" + q + "”";
    function paint(list) {
      status.textContent = list.length ? list.length + (list.length === 1 ? " find" : " finds") + " on Mound City Finds" :
        "No finds match “" + q + "” yet. Try another word, or browse the guides.";
      pageRoot.innerHTML = list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" :
        '<p class="sr-none"><a href="' + esc(new URL("index.html#guides", base).toString()) + '">Browse the buying guides →</a></p>';
      if (window.location.hash) { var el = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); if (el) el.scrollIntoView(); }
    }
    search(q).then(function (local) {
      paint(local);
      live(q).then(function (remote) { if (remote.length) paint(local.concat(rank(remote, q).length ? rank(remote, q) : remote)); });
    }).catch(function () { status.textContent = "Search is unavailable right now."; });
  }
  if (pageRoot) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderPage); else renderPage(); }

  window.MCFSearch = { rank: rank, terms: terms };
})();
