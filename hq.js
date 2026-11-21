/* Mound City Finds HQ: shared site behavior.
   Store buttons (approved affiliate retailers only), My Stash, night city lights,
   St. Louis easter eggs, Arch loader. No prices are shown until real feeds exist. */
(function () {
  "use strict";
  var script = document.currentScript;
  var BASE = new URL(".", script ? script.src : window.location.href);
  var STASH_KEY = "mcf-stash";
  var NIGHT_KEY = "mcf-night";
  var root = document.documentElement;

  function url(path) { return new URL(path, BASE).toString(); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function getJSON(path) {
    return fetch(url(path), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }

  var data = null;
  function load() {
    if (!data) {
      data = Promise.all([getJSON("products.json"), getJSON("retailers.json").catch(function () { return null; })])
        .then(function (res) {
          var catalog = res[0];
          var bySlug = {}, byAsin = {};
          (catalog.products || []).forEach(function (p) { byAsin[p.asin] = p; if (p.slug) bySlug[p.slug] = p; });
          return { catalog: catalog, retailers: res[1] || fallbackRetailers(catalog), byAsin: byAsin, bySlug: bySlug };
        });
    }
    return data;
  }
  function fallbackRetailers(catalog) {
    var tag = (catalog.site && catalog.site.affiliateTag) || "printsquad-20";
    return { approvedRetailers: { amazon: { label: "Amazon", approved: true, buttonText: "See today's price", showPrice: false,
      linkTemplate: "https://www.amazon.com/dp/{asin}?tag=" + tag } }, links: {}, prices: {} };
  }

  /* ---------- Store buttons (data-driven compare row) ---------- */
  // A button renders only when the retailer is approved AND we have an affiliate link for this product.
  function storeLinks(asin, cfg) {
    var out = [];
    var approved = cfg.approvedRetailers || {};
    var perProduct = (cfg.links && cfg.links[asin]) || {};
    var prices = (cfg.prices && cfg.prices[asin]) || {};
    Object.keys(approved).forEach(function (key) {
      var r = approved[key];
      if (!r || r.approved !== true) return;
      var href = perProduct[key] || (r.linkTemplate ? r.linkTemplate.replace("{asin}", encodeURIComponent(asin)) : "");
      if (!href) return;
      var price = r.showPrice === false ? null : prices[key];
      out.push({ key: key, label: r.label || key, text: r.buttonText || "See price", href: href,
        price: typeof price === "number" && isFinite(price) ? price : null });
    });
    return out;
  }
  function compareRow(asin, cfg, name) {
    var links = storeLinks(asin, cfg);
    if (!links.length) return "";
    var priced = links.filter(function (l) { return l.price !== null; });
    var best = priced.length >= 2 ? Math.min.apply(null, priced.map(function (l) { return l.price; })) : null;
    var btns = links.map(function (l) {
      var isBest = best !== null && l.price === best;
      return '<a class="cmp-btn cmp-' + esc(l.key) + (isBest ? " is-best" : "") + '" href="' + esc(l.href) +
        '" target="_blank" rel="sponsored nofollow noopener" data-store="' + esc(l.key) + '">' +
        (isBest ? '<span class="cmp-best">Best price</span>' : "") +
        '<span class="cmp-text"><span class="cmp-label">' + esc(l.text) + '</span><span class="cmp-store">at ' + esc(l.label) + "</span></span>" +
        '<span class="cmp-price">' + (l.price !== null ? "$" + l.price.toFixed(2) : "") + "</span>" +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M6 3h7v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="visually-hidden"> ' + esc(name || "") + " (opens in a new tab)</span></a>";
    }).join("");
    return '<div class="cmp" data-count="' + links.length + '"><div class="cmp-row">' + btns + "</div></div>";
  }

  /* ---------- My Stash ---------- */
  function stash() {
    try { var v = JSON.parse(localStorage.getItem(STASH_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function saveStash(list) {
    try { localStorage.setItem(STASH_KEY, JSON.stringify(list)); } catch (e) {}
    syncStash();
    document.dispatchEvent(new CustomEvent("mcf:stash"));
  }
  function inStash(asin) { return stash().indexOf(asin) !== -1; }
  function stashBtn(asin, name) {
    var on = inStash(asin);
    return '<button type="button" class="stash-btn" data-asin="' + esc(asin) + '" aria-pressed="' + on + '" aria-label="' +
      (on ? "Remove from" : "Save to") + " My Stash: " + esc(name) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg>' +
      '<span class="stash-word">' + (on ? "In my stash" : "Stash it") + "</span></button>";
  }
  function syncStash() {
    var list = stash();
    document.querySelectorAll("[data-stash-count]").forEach(function (el) {
      el.textContent = list.length ? String(list.length) : "";
      el.hidden = !list.length;
    });
    document.querySelectorAll(".stash-btn").forEach(function (b) {
      var on = list.indexOf(b.dataset.asin) !== -1;
      b.setAttribute("aria-pressed", on);
      var w = b.querySelector(".stash-word"); if (w) w.textContent = on ? "In my stash" : "Stash it";
      b.setAttribute("aria-label", b.getAttribute("aria-label").replace(/^(Remove from|Save to)/, on ? "Remove from" : "Save to"));
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".stash-btn");
    if (!b) return;
    var list = stash(), i = list.indexOf(b.dataset.asin);
    if (i === -1) { list.push(b.dataset.asin); toast("Saved to My Stash. It stays on this phone."); b.classList.add("pop"); }
    else { list.splice(i, 1); }
    setTimeout(function () { b.classList.remove("pop"); }, 450);
    saveStash(list);
  });

  /* ---------- Product cards ---------- */
  function productCard(p, cfg, opts) {
    opts = opts || {};
    var page = p.slug ? url("products/" + encodeURIComponent(p.slug) + ".html") : "";
    var amazon = storeLinks(p.asin, cfg).filter(function (l) { return l.key === "amazon"; })[0];
    var imgHref = page || (amazon && amazon.href) || "#";
    return '<article class="card hq-card' + (opts.compact ? " is-compact" : "") + '" data-asin="' + esc(p.asin) + '">' +
      '<div class="card-top">' +
      '<a class="card-thumb" href="' + esc(imgHref) + '" tabindex="-1" aria-hidden="true"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) +
      '" width="250" height="250" loading="lazy" decoding="async"></a>' + stashBtn(p.asin, p.name) + "</div>" +
      '<p class="cat-pill">' + esc(p.category) + "</p>" +
      '<h3><a class="card-title-link" href="' + esc(imgHref) + '">' + esc(p.name) + "</a></h3>" +
      (opts.compact ? "" : '<p class="blurb">' + esc(p.blurb) + "</p>") +
      '<div class="card-actions">' + compareRow(p.asin, cfg, p.name) +
      (page ? '<a class="buy-link" href="' + esc(page) + '"><span class="bl-long">Read the buying guide</span><span class="bl-short">Buying guide</span> <span aria-hidden="true">→</span></a>' : "") +
      "</div></article>";
  }

  /* ---------- Static pages: swap the single Amazon button for the compare row ---------- */
  function enhanceStatic(d) {
    var anchors = document.querySelectorAll(".buy-box > a.buy, .guide-actions > a.buy");
    anchors.forEach(function (a) {
      var m = /\/dp\/([A-Z0-9]{10})/.exec(a.getAttribute("href") || "");
      if (!m) return;
      var asin = m[1], p = d.byAsin[asin];
      var row = compareRow(asin, d.retailers, p ? p.name : "");
      if (!row) return;
      var holder = document.createElement("div");
      holder.className = "cmp-holder";
      holder.innerHTML = row + (a.closest(".buy-box") && p ? stashBtn(asin, p.name) : "");
      a.replaceWith(holder);
    });
    syncStash();
  }

  /* ---------- Toast + easter eggs ---------- */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "hq-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }
  var EGGS = [
    { re: /toasted ravioli|t-?ravs?/, msg: "T-ravs are a St. Louis classic. No ravioli on the shelf, but the slim toaster's in Home." },
    { re: /gooey butter/, msg: "Gooey butter cake is the official snack of HQ. Grab a slice, then grab a find." },
    { re: /provel/, msg: "HQ keeps its Provel opinions off the record." },
    { re: /^314$|three.?one.?four/, msg: "Three-one-fo' in the building. Welcome home." },
    { re: /\barch\b|gateway/, msg: "630 feet of stainless steel, and still the best landmark in the country." }
  ];
  function checkEgg(text) {
    var t = String(text || "").toLowerCase().trim();
    for (var i = 0; i < EGGS.length; i++) if (EGGS[i].re.test(t)) { toast(EGGS[i].msg); return true; }
    return false;
  }
  function wireEggs() {
    var search = document.getElementById("site-search-input");
    var last = "";
    if (search) search.addEventListener("input", function () {
      var v = search.value.toLowerCase().trim();
      if (v !== last && v.length >= 3) { last = v; checkEgg(v); }
    });
    // Typing 314 anywhere outside a form field
    var buf = "";
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      buf = (buf + e.key).slice(-3);
      if (buf === "314") { toast("Three-one-fo' in the building. Welcome home."); archGlow(); }
    });
    // Tap the Arch logo three times
    var taps = 0, tapTimer;
    var mark = document.querySelector(".brand .mark");
    if (mark) mark.addEventListener("click", function (e) {
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () { taps = 0; }, 900);
      if (taps >= 3) { e.preventDefault(); taps = 0; archGlow(); toast("Meet me under the Arch."); }
    });
    var cake = document.querySelector("[data-egg='cake']");
    if (cake) cake.addEventListener("click", function () { toast("Gooey butter cake is the official snack of HQ. Grab a slice, then grab a find."); });
  }
  function archGlow() {
    root.classList.add("arch-glow");
    setTimeout(function () { root.classList.remove("arch-glow"); }, 1600);
  }

  /* ---------- Night city lights ---------- */
  function setNight(on) {
    root.classList.toggle("night", on);
    try { localStorage.setItem(NIGHT_KEY, on ? "1" : "0"); } catch (e) {}
    document.querySelectorAll(".night-toggle").forEach(function (b) {
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", on ? "Switch to day mode" : "Switch to night city lights mode");
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", on ? "#0b1a33" : "#13294b");
  }
  function skyline() {
    var wins = "";
    var bldgs = [[0, 70, 46], [50, 52, 30], [84, 88, 40], [128, 60, 34], [166, 96, 28], [520, 78, 36], [560, 58, 44], [608, 104, 30], [642, 66, 40], [686, 84, 34], [724, 50, 44], [772, 92, 30], [806, 62, 52], [862, 76, 38], [904, 54, 46], [954, 86, 46]];
    var shapes = bldgs.map(function (b) {
      var x = b[0], h = b[1], w = b[2], r = "";
      for (var yy = 130 - h + 8; yy < 124; yy += 10) for (var xx = x + 5; xx < x + w - 5; xx += 9) {
        if (Math.random() < 0.42) r += '<rect class="win" x="' + xx + '" y="' + yy + '" width="4" height="5" style="animation-delay:' + (Math.random() * 6).toFixed(2) + 's"/>';
      }
      wins += r;
      return '<rect x="' + x + '" y="' + (130 - h) + '" width="' + w + '" height="' + h + '"/>';
    }).join("");
    var el = document.createElement("div");
    el.className = "city-lights";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<svg viewBox="0 0 1000 130" preserveAspectRatio="xMidYMax slice">' +
      '<path class="sky-arch" d="M250 130 C 268 20, 432 20, 450 130" fill="none" stroke-width="7" stroke-linecap="round"/>' +
      '<g class="bldg">' + shapes + "</g>" + wins + "</svg>";
    document.body.appendChild(el);
  }
  function wireNight() {
    var on = false;
    try { on = localStorage.getItem(NIGHT_KEY) === "1"; } catch (e) {}
    skyline();
    setNight(on);
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".night-toggle");
      if (!b) return;
      var next = !root.classList.contains("night");
      setNight(next);
      if (next) toast("City lights on. The 314 looks good at night.");
    });
  }

  /* ---------- Arch loader ---------- */
  function finishLoader() {
    try { sessionStorage.setItem("mcf-seen", "1"); } catch (e) {}
    var l = document.getElementById("arch-loader");
    if (l) setTimeout(function () { l.classList.add("done"); }, 650);
  }

  window.MCF = { load: load, productCard: productCard, compareRow: compareRow, storeLinks: storeLinks, stashBtn: stashBtn,
    stash: stash, syncStash: syncStash, toast: toast, url: url, esc: esc, getJSON: getJSON };

  function init() {
    finishLoader();
    wireNight();
    wireEggs();
    syncStash();
    load().then(function (d) { enhanceStatic(d); }).catch(function (err) { console.error(err); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
