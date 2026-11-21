(function () {
  "use strict";
  var script = document.currentScript;
  var base = new URL(".", script ? script.src : window.location.href);
  var input = document.getElementById("site-search-input");
  var panel = document.getElementById("site-search-results");
  if (!input || !panel) return;
  var wrap = input.closest(".site-search");
  var data = null;
  var loading = null;
  var timer = null;
  var activeIndex = -1;

  function affiliateUrl(asin, tag) {
    var url = new URL("https://www.amazon.com/dp/" + encodeURIComponent(asin));
    url.searchParams.set("tag", tag);
    return url.toString();
  }
  function amazonSearchUrl(q, tag) {
    return "https://www.amazon.com/s?k=" + encodeURIComponent(q) + "&tag=" + encodeURIComponent(tag);
  }
  function widgetImage(asin, tag) {
    return "https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=" + encodeURIComponent(asin) +
      "&Format=_SL250_&ID=AsinImage&MarketPlace=US&ServiceVersion=20070822&WS=1&tag=" + encodeURIComponent(tag) + "&language=en_US";
  }
  function esc(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(v) {
    return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = fetch(new URL("products.json", base).toString(), { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error("products.json " + r.status); return r.json(); })
        .then(function (json) {
          data = json;
          (data.products || []).forEach(function (p) {
            p._name = norm(p.name);
            p._hay = norm([p.name, p.brand, p.category, p.keywords].join(" "));
          });
          return data;
        })
        .catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }
  function score(p, terms) {
    var s = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (p._hay.indexOf(t) === -1) return 0;
      if (p._name.indexOf(t) === 0) s += 4;
      else if ((" " + p._name).indexOf(" " + t) !== -1) s += 3;
      else s += 1;
    }
    return s;
  }
  function options() { return panel.querySelectorAll(".ss-option"); }
  function setActive(i) {
    var opts = options();
    activeIndex = i;
    for (var k = 0; k < opts.length; k++) {
      var on = k === i;
      opts[k].classList.toggle("is-active", on);
      opts[k].setAttribute("aria-selected", on ? "true" : "false");
    }
    if (i >= 0 && opts[i]) {
      input.setAttribute("aria-activedescendant", opts[i].id);
      opts[i].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }
  function close() {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  }
  function open() {
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function onImgError(img) {
    img.onerror = null;
    img.onload = null;
    img.src = img.getAttribute("data-fallback");
    img.alt = img.getAttribute("data-fallback-alt");
  }
  function render(q) {
    var tag = data.site.affiliateTag;
    var terms = norm(q).split(" ").filter(Boolean);
    var hits = (data.products || [])
      .map(function (p) { return { p: p, s: score(p, terms) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8);
    var html = "";
    hits.forEach(function (h, i) {
      var p = h.p;
      var page = p.slug ? new URL("products/" + encodeURIComponent(p.slug) + ".html", base).toString() : "";
      var fallback = new URL(p.image || ("images/products/" + p.slug + ".svg"), base).toString();
      html += '<div class="ss-row">' +
        '<a class="ss-option" id="ss-opt-' + i + '" role="option" aria-selected="false" href="' + esc(affiliateUrl(p.asin, tag)) +
        '" target="_blank" rel="sponsored nofollow noopener">' +
        '<img class="ss-thumb" src="' + esc(widgetImage(p.asin, tag)) + '" data-fallback="' + esc(fallback) +
        '" data-fallback-alt="' + esc(p.name + " illustration") + '" alt="' + esc(p.name + " product image") + '" width="56" height="56" loading="lazy">' +
        '<span class="ss-text"><span class="ss-name">' + esc(p.name) + '</span><span class="ss-cat">' + esc(p.category) +
        ' · opens on Amazon</span></span></a>' +
        (page ? '<a class="ss-page" href="' + esc(page) + '">Our guide</a>' : "") +
        "</div>";
    });
    if (!hits.length) {
      html += '<div class="ss-row"><a class="ss-option ss-amazon" id="ss-opt-0" role="option" aria-selected="false" href="' +
        esc(amazonSearchUrl(q.trim(), tag)) + '" target="_blank" rel="sponsored nofollow noopener">' +
        '<span class="ss-text"><span class="ss-name">Search Amazon for “' + esc(q.trim()) + '”</span>' +
        '<span class="ss-cat">No match on Mound City Finds · opens on Amazon</span></span></a></div>';
    }
    panel.innerHTML = html;
    panel.querySelectorAll("img.ss-thumb").forEach(function (img) {
      img.addEventListener("error", function () { onImgError(img); });
      img.addEventListener("load", function () { if (img.naturalWidth <= 1) onImgError(img); });
    });
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    open();
  }
  function update() {
    var q = input.value;
    if (!q.trim()) { close(); panel.innerHTML = ""; return; }
    load().then(function () { if (input.value === q) render(q); }).catch(function (e) {
      console.error(e);
      panel.innerHTML = '<p class="ss-error">Search is unavailable right now.</p>';
      open();
    });
  }
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(update, 180);
  });
  input.addEventListener("focus", function () {
    load().catch(function () {});
    if (input.value.trim() && panel.innerHTML) open();
  });
  input.addEventListener("keydown", function (e) {
    var opts = options();
    if (e.key === "Escape") {
      if (!panel.hidden) { e.preventDefault(); close(); }
      else if (input.value) { input.value = ""; }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (panel.hidden && input.value.trim()) { update(); return; }
      if (opts.length) setActive((activeIndex + 1) % opts.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (opts.length) setActive(activeIndex <= 0 ? opts.length - 1 : activeIndex - 1);
    } else if (e.key === "Enter") {
      if (!panel.hidden && opts.length) {
        e.preventDefault();
        (opts[activeIndex >= 0 ? activeIndex : 0]).click();
      }
    }
  });
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); close(); input.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) close();
  });
  document.addEventListener("focusin", function (e) {
    if (!wrap.contains(e.target)) close();
  });
})();
