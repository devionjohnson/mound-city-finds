/* Mound City Setups: themed sets of four with one-click "Add all 4 to Amazon cart". Needs hq.js. */
(function () {
  "use strict";
  function cartUrl(asins, tag) {
    var q = asins.map(function (a, i) { return "ASIN." + (i + 1) + "=" + encodeURIComponent(a) + "&Quantity." + (i + 1) + "=1"; }).join("&");
    return "https://www.amazon.com/gp/aws/cart/add.html?" + q + "&AssociateTag=" + encodeURIComponent(tag);
  }
  function init() {
    var root = document.getElementById("setups");
    if (!root) return;
    Promise.all([MCF.load(), MCF.getJSON("setups.json")]).then(function (res) {
      var d = res[0], setups = res[1].setups || [];
      var tag = d.catalog.site.affiliateTag || "printsquad-20";
      root.innerHTML = setups.map(function (s, n) {
        var items = s.asins.map(function (a) { return d.byAsin[a]; }).filter(Boolean);
        return '<section class="setup" id="' + MCF.esc(s.id) + '" aria-labelledby="h-' + MCF.esc(s.id) + '">' +
          '<div class="setup-head"><p class="setup-num">Setup ' + (n + 1) + ' <span aria-hidden="true">·</span> 4 finds</p>' +
          '<h2 id="h-' + MCF.esc(s.id) + '">' + MCF.esc(s.title) + '</h2><p class="setup-tag">' + MCF.esc(s.tagline) + "</p>" +
          '<a class="cart-all bouncy" href="' + MCF.esc(cartUrl(s.asins, tag)) + '" target="_blank" rel="sponsored nofollow noopener">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.3 11h10.8l2-8H6.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="19.5" r="1.5" fill="currentColor"/><circle cx="17" cy="19.5" r="1.5" fill="currentColor"/></svg>' +
          "Add all 4 to Amazon cart<span class=\"visually-hidden\"> (opens Amazon in a new tab)</span></a></div>" +
          '<div class="grid setup-grid">' + items.map(function (p) { return MCF.productCard(p, d.retailers, { compact: true }); }).join("") + "</div></section>";
      }).join("");
      MCF.syncStash();
    }).catch(function (err) { root.textContent = "Setups could not be loaded."; console.error(err); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
