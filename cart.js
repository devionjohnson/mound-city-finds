/* Mound City Finds cart pop-up. Needs hq.js.
   Clicking an Amazon product/add-to-cart link adds the item to an on-site cart (saved in this browser)
   and opens a pop-up. Checkout sends every Amazon item to Amazon's Associates Add-to-Cart form
   (multi-ASIN, tag printsquad-20) in a new tab. Items from other stores check out at that store.
   Without JavaScript every link still works as a plain affiliate link. No prices are shown for Amazon items. */
(function () {
  "use strict";
  var KEY = "mcf-cart";
  var ADD_URL = "https://www.amazon.com/gp/aws/cart/add.html";
  var DP_RE = /amazon\.com\/(?:[^/?#]+\/)?dp\/([A-Z0-9]{10})/;
  var tag = "printsquad-20";
  var D = null, dlg = null, cartBtn = null;
  var esc = function (v) { return window.MCF ? MCF.esc(v) : String(v == null ? "" : v); };

  /* ---------- storage ---------- */
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter(function (i) { return i && i.id; }) : []; }
    catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    sync();
    document.dispatchEvent(new CustomEvent("mcf:cart"));
  }
  function count(list) { return (list || read()).reduce(function (n, i) { return n + (i.qty || 1); }, 0); }

  /* ---------- items ---------- */
  function fromAsin(asin, raw) {
    var p = D && D.byAsin[asin];
    if (!p) {
      // Trending-catalog item (data/catalog/): not a hand-made product, so keep the name/photo/page it was added with.
      if (!raw || !raw.title || !/^[A-Z0-9]{10}$/.test(asin)) return null;
      return { id: "amazon:" + asin, asin: asin, title: raw.title, image: raw.image || "", merchant: "Amazon", network: "amazon",
        page: raw.page || "", affiliate_url: "https://www.amazon.com/dp/" + asin + "?tag=" + encodeURIComponent(tag), price: null, currency: null };
    }
    return { id: "amazon:" + asin, asin: asin, title: p.name, image: p.photo || "", merchant: "Amazon", network: "amazon",
      page: p.slug ? MCF.url("products/" + p.slug + ".html") : "",
      affiliate_url: "https://www.amazon.com/dp/" + asin + "?tag=" + encodeURIComponent(tag), price: null, currency: null };
  }
  function normalize(it) {
    if (!it) return null;
    if (it.asin && (!it.network || it.network === "amazon" || it.network === "site")) {
      var a = fromAsin(it.asin, it);
      if (a) return a;
    }
    if (!it.id || !it.affiliate_url) return null;
    return { id: String(it.id), asin: null, title: it.title || "", image: it.image || "", merchant: it.merchant || "Store",
      network: it.network || it.source || "", page: it.page || "", affiliate_url: it.affiliate_url,
      price: typeof it.price === "number" ? it.price : null, currency: it.currency || null };
  }
  function addItems(items) {
    var list = read(), added = [];
    items.forEach(function (raw) {
      var it = normalize(raw);
      if (!it) return;
      var have = list.filter(function (x) { return x.id === it.id; })[0];
      if (have) have.qty = Math.min(99, (have.qty || 1) + 1);
      else { it.qty = 1; list.push(it); }
      added.push(it.id);
    });
    if (added.length) { write(list); open(added); }
    return added.length;
  }
  function setQty(id, qty) {
    var list = read();
    list = list.map(function (x) { if (x.id === id) x.qty = qty; return x; }).filter(function (x) { return x.qty > 0; });
    write(list);
  }

  /* ---------- checkout URLs ---------- */
  function amazonCheckoutUrl(list) {
    var q = ["AssociateTag=" + encodeURIComponent(tag)];
    list.filter(function (i) { return i.asin; }).forEach(function (i, n) {
      q.push("ASIN." + (n + 1) + "=" + encodeURIComponent(i.asin), "Quantity." + (n + 1) + "=" + (i.qty || 1));
    });
    return ADD_URL + "?" + q.join("&");
  }
  function money(p, c) {
    if (typeof p !== "number" || !isFinite(p)) return "";
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(p); } catch (e) { return "$" + p.toFixed(2); }
  }

  /* ---------- UI ---------- */
  var CART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.3 11h10.8l2-8H6.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="19.5" r="1.5" fill="currentColor"/><circle cx="17" cy="19.5" r="1.5" fill="currentColor"/></svg>';
  function ensureButton() {
    if (cartBtn) return;
    var night = document.querySelector(".site-header .night-toggle");
    if (!night) return;
    cartBtn = document.createElement("button");
    cartBtn.type = "button";
    cartBtn.className = "cart-toggle bouncy";
    cartBtn.innerHTML = CART_SVG + '<span class="cart-count" data-cart-count hidden></span>';
    cartBtn.addEventListener("click", function () { open([]); });
    night.parentNode.insertBefore(cartBtn, night);
  }
  function sync() {
    var n = count();
    ensureButton();
    if (cartBtn) {
      cartBtn.hidden = n === 0;
      cartBtn.setAttribute("aria-label", "Open cart, " + n + (n === 1 ? " item" : " items"));
    }
    document.querySelectorAll("[data-cart-count]").forEach(function (el) { el.textContent = n ? String(n) : ""; el.hidden = !n; });
  }
  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "cart-modal";
    dlg.setAttribute("aria-labelledby", "cart-title");
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { close(); return; }
      var b = e.target.closest("[data-cart-act]");
      if (!b) return;
      var act = b.getAttribute("data-cart-act"), id = b.getAttribute("data-id");
      var it = read().filter(function (x) { return x.id === id; })[0];
      if (act === "close") close();
      else if (act === "inc" && it) { setQty(id, Math.min(99, it.qty + 1)); render([]); }
      else if (act === "dec" && it) { setQty(id, it.qty - 1); render([]); }
      else if (act === "remove") { setQty(id, 0); render([]); }
      else if (act === "checkout-amazon") {
        // The link opens Amazon in a new tab; clear the Amazon items here once they are handed off.
        setTimeout(function () { write(read().filter(function (x) { return !x.asin; })); render([], "amazon"); }, 300);
      } else if (act === "checkout-store") {
        var m = b.getAttribute("data-merchant");
        setTimeout(function () { write(read().filter(function (x) { return x.asin || x.merchant !== m; })); render([], m); }, 300);
      }
    });
    dlg.addEventListener("close", function () { document.documentElement.classList.remove("cart-open"); });
    return dlg;
  }
  function row(i, isNew) {
    var title = i.page ? '<a class="ci-title" href="' + esc(i.page) + '">' + esc(i.title) + "</a>" : '<span class="ci-title">' + esc(i.title) + "</span>";
    var price = i.asin ? "" : money(i.price, i.currency);
    return '<li class="cart-item' + (isNew ? " is-new" : "") + '">' +
      '<img class="ci-img" src="' + esc(i.image) + '" alt="' + esc(i.title) + '" width="72" height="72" loading="lazy">' +
      '<div class="ci-body">' + title +
      '<p class="ci-meta">' + esc(i.merchant) + (price ? ' <span class="ci-price">' + esc(price) + "</span>" : "") +
      ' · <a href="' + esc(i.affiliate_url) + '" target="_blank" rel="sponsored nofollow noopener" data-cart-skip>' +
      (i.asin ? "See today’s price" : "View at " + esc(i.merchant)) + '<span class="visually-hidden"> (opens in a new tab)</span></a></p>' +
      '<div class="ci-qty"><button type="button" data-cart-act="dec" data-id="' + esc(i.id) + '" aria-label="One less ' + esc(i.title) + '">−</button>' +
      '<span aria-live="polite">' + (i.qty || 1) + '</span><button type="button" data-cart-act="inc" data-id="' + esc(i.id) + '" aria-label="One more ' + esc(i.title) + '">+</button>' +
      '<button type="button" class="ci-remove" data-cart-act="remove" data-id="' + esc(i.id) + '">Remove</button></div></div></li>';
  }
  function render(newIds, sentTo) {
    var list = read(), d = ensureDialog();
    var amazon = list.filter(function (i) { return i.asin; });
    var others = list.filter(function (i) { return !i.asin; });
    var byMerchant = {};
    others.forEach(function (i) { (byMerchant[i.merchant] = byMerchant[i.merchant] || []).push(i); });
    var heading = newIds.length ? "Added to your cart" : "Your cart";
    var html = '<div class="cart-head"><h2 id="cart-title">' + CART_SVG + heading + '</h2>' +
      '<button type="button" class="cart-x" data-cart-act="close" aria-label="Close cart">×</button></div>';
    if (sentTo) html += '<p class="cart-sent" role="status">Sent to ' + esc(sentTo === "amazon" ? "Amazon" : sentTo) + ' in a new tab. Finish checkout there.</p>';
    if (!list.length) {
      html += '<p class="cart-empty">Your cart is empty.</p>';
    } else {
      if (amazon.length) {
        html += '<section class="cart-group"><h3>Amazon <span>' + count(amazon) + (count(amazon) === 1 ? " item" : " items") + "</span></h3><ul>" +
          amazon.map(function (i) { return row(i, newIds.indexOf(i.id) !== -1); }).join("") + "</ul>" +
          '<a class="cart-checkout" data-cart-act="checkout-amazon" data-cart-skip href="' + esc(amazonCheckoutUrl(amazon)) +
          '" target="_blank" rel="sponsored nofollow noopener">Check out on Amazon<span class="visually-hidden"> (opens in a new tab)</span></a>' +
          '<p class="cart-hint">Opens your Amazon cart in a new tab. Amazon may ask you to sign in first.</p></section>';
      }
      Object.keys(byMerchant).forEach(function (m) {
        var items = byMerchant[m];
        html += '<section class="cart-group"><h3>' + esc(m) + " <span>" + count(items) + (count(items) === 1 ? " item" : " items") + "</span></h3><ul>" +
          items.map(function (i) { return row(i, newIds.indexOf(i.id) !== -1); }).join("") + "</ul>" +
          '<a class="cart-checkout is-store" data-cart-act="checkout-store" data-merchant="' + esc(m) + '" data-cart-skip href="' + esc(items[0].affiliate_url) +
          '" target="_blank" rel="sponsored nofollow noopener">Check out at ' + esc(m) + '<span class="visually-hidden"> (opens in a new tab)</span></a>' +
          (items.length > 1 ? '<p class="cart-hint">' + esc(m) + " has no shared cart link, so this opens the first item. Use each item’s link for the rest.</p>" : "") +
          "</section>";
      });
    }
    html += '<div class="cart-foot"><button type="button" class="cart-keep" data-cart-act="close">Keep shopping</button></div>';
    d.innerHTML = html;
  }
  function open(newIds) {
    var d = ensureDialog();
    render(newIds || []);
    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
      document.documentElement.classList.add("cart-open");
    }
    var focus = d.querySelector(".cart-checkout") || d.querySelector(".cart-keep");
    if (focus) focus.focus();
  }
  function close() { if (dlg && dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); } }

  /* ---------- click interception ---------- */
  function asinsFromHref(href) {
    if (!href) return [];
    if (href.indexOf("/gp/aws/cart/add.html") !== -1) {
      var out = [];
      try { new URL(href).searchParams.forEach(function (v, k) { if (/^ASIN\.\d+$/.test(k)) out.push(v); }); } catch (e) {}
      return out;
    }
    var m = DP_RE.exec(href);
    return m ? [m[1]] : [];
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target.closest && e.target.closest("[data-cart-item], a[href]");
    if (!t || t.hasAttribute("data-cart-skip") || !D) return;
    if (t.hasAttribute("data-cart-item")) {
      var item = null;
      try { item = JSON.parse(t.getAttribute("data-cart-item")); } catch (err) {}
      if (item && addItems([item])) e.preventDefault();
      return;
    }
    var asins = asinsFromHref(t.getAttribute("href")).filter(function (a) { return D.byAsin[a]; });
    if (!asins.length) return;
    e.preventDefault();
    addItems(asins.map(function (a) { return { asin: a }; }));
  });

  window.MCFCart = { add: function (items) { return addItems([].concat(items)); }, open: function () { open([]); }, items: read,
    checkoutUrl: function () { return amazonCheckoutUrl(read()); } };

  function init() {
    sync();
    if (!window.MCF) return;
    MCF.load().then(function (d) {
      D = d;
      tag = (d.catalog.site && d.catalog.site.affiliateTag) || tag;
      // Refresh saved Amazon items from the catalog (names/photos), drop ones no longer listed.
      var list = read().map(function (i) { if (!i.asin) return i; var f = fromAsin(i.asin, i); if (f) f.qty = i.qty; return f; }).filter(Boolean);
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      sync();
    }).catch(function (err) { console.error(err); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
