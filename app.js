/* Headquarters page: Today at HQ, the full shelf, Find my pick quiz, My Stash. Needs hq.js. */
(function () {
  "use strict";
  var activeCategory = "All";
  var D = null;

  function formatDate(iso) {
    if (!iso) return "";
    var p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  /* Today at HQ: four picks that rotate daily, one per category where possible */
  function todaysPicks(products) {
    var now = new Date();
    var day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    var cats = [];
    products.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    var picks = [];
    for (var i = 0; picks.length < 4 && i < cats.length * 3; i++) {
      var cat = cats[(day + i) % cats.length];
      var inCat = products.filter(function (p) { return p.category === cat && picks.indexOf(p) === -1; });
      if (inCat.length) picks.push(inCat[(day + i) % inCat.length]);
    }
    return picks;
  }
  function renderToday() {
    var el = document.getElementById("today-grid");
    if (!el) return;
    el.innerHTML = todaysPicks(D.catalog.products).map(function (p) { return MCF.productCard(p, D.retailers, { compact: true }); }).join("");
    var d = document.getElementById("today-date");
    if (d) d.textContent = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  function renderFilters() {
    var products = D.catalog.products;
    var cats = ["All"].concat(Array.from(new Set(products.map(function (p) { return p.category; }))));
    var root = document.getElementById("filters");
    root.innerHTML = "";
    cats.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = cat;
      btn.setAttribute("aria-pressed", cat === activeCategory ? "true" : "false");
      btn.addEventListener("click", function () { activeCategory = cat; renderFilters(); renderGrid(); });
      root.appendChild(btn);
    });
  }
  function renderGrid() {
    var products = D.catalog.products;
    var list = activeCategory === "All" ? products : products.filter(function (p) { return p.category === activeCategory; });
    document.getElementById("empty").hidden = list.length > 0;
    document.getElementById("grid").innerHTML = list.map(function (p) { return MCF.productCard(p, D.retailers); }).join("");
  }

  /* My Stash */
  function renderStash() {
    var el = document.getElementById("stash-grid");
    if (!el || !D) return;
    var items = MCF.stash().map(function (a) { return D.byAsin[a]; }).filter(Boolean);
    document.getElementById("stash-empty").hidden = items.length > 0;
    el.innerHTML = items.map(function (p) { return MCF.productCard(p, D.retailers, { compact: true }); }).join("");
  }

  /* Find my pick quiz (slang, three taps) */
  var QUIZ = [
    { q: "What's the move today?", key: "cat", a: [
      ["Posted up at the crib", "Home"], ["Finna hit Forest Park", "Fitness"], ["Need that tech drip", "Tech"],
      ["Glow-up szn", "Beauty"], ["Fur baby duty", "Pets"] ] },
    { q: "How we feelin'?", key: "mood", a: [["Keep it lowkey, just the basics", "basic"], ["Treat myself, I earned it", "treat"]] },
    { q: "Where you gon' use it?", key: "where", a: [["Around the house", "house"], ["On the go, out in the Lou", "go"]] }
  ];
  var PICKS = {
    Home: { basic_house: "mrs-meyers-clean-day-hand-soap-refill", basic_go: "amazon-basics-slim-velvet-hangers", treat_house: "levoit-top-fill-cool-mist-humidifier", treat_go: "bella-fits-anywhere-slim-toaster" },
    Fitness: { basic_house: "fit-simplify-resistance-loop-bands", basic_go: "hothands-hand-warmers", treat_house: "gaiam-thick-yoga-mat", treat_go: "owala-freesip-water-bottle" },
    Tech: { basic_house: "roku-streaming-stick-hd", basic_go: "apple-earpods-usb-c", treat_house: "amazon-fire-tv-stick-4k-plus", treat_go: "apple-airpods-pro-3" },
    Beauty: { basic_house: "mighty-patch-original-acne-patches", basic_go: "neutrogena-makeup-remover-wipes", treat_house: "cerave-moisturizing-cream", treat_go: "maybelline-lash-sensational-sky-high-mascara" },
    Pets: { basic_house: "dr-elseys-ultra-unscented-clumping-cat-litter", basic_go: "dr-elseys-ultra-unscented-clumping-cat-litter", treat_house: "dr-elseys-ultra-unscented-clumping-cat-litter", treat_go: "dr-elseys-ultra-unscented-clumping-cat-litter" }
  };
  var answers = {}, step = 0;
  function renderQuiz() {
    var box = document.getElementById("quiz-box");
    if (!box) return;
    if (step < QUIZ.length) {
      var s = QUIZ[step];
      box.innerHTML = '<p class="quiz-step">Question ' + (step + 1) + " of " + QUIZ.length + '</p><h3 class="quiz-q">' + MCF.esc(s.q) + '</h3><div class="quiz-opts">' +
        s.a.map(function (o, i) { return '<button type="button" class="quiz-opt bouncy" data-i="' + i + '">' + MCF.esc(o[0]) + "</button>"; }).join("") + "</div>";
      box.querySelectorAll(".quiz-opt").forEach(function (b) {
        b.addEventListener("click", function () { answers[s.key] = s.a[+b.dataset.i][1]; step++; renderQuiz(); });
      });
      return;
    }
    var slug = PICKS[answers.cat][answers.mood + "_" + answers.where];
    var p = D && D.bySlug[slug];
    box.innerHTML = '<p class="quiz-step">Your pick from HQ</p><h3 class="quiz-q">Say less. This one\'s for you.</h3>' +
      (p ? '<div class="quiz-result">' + MCF.productCard(p, D.retailers, { compact: true }) + "</div>" : "") +
      '<button type="button" class="quiz-again">Run it back</button>';
    box.querySelector(".quiz-again").addEventListener("click", function () { answers = {}; step = 0; renderQuiz(); });
    MCF.syncStash();
  }

  function init() {
    var countEl = document.getElementById("product-count");
    MCF.load().then(function (d) {
      D = d;
      var products = d.catalog.products || [];
      countEl.textContent = products.length + " products";
      var updated = document.getElementById("updated-date");
      if (d.catalog.site.updated) { updated.dateTime = d.catalog.site.updated; updated.textContent = formatDate(d.catalog.site.updated); }
      renderToday();
      renderFilters();
      renderGrid();
      renderStash();
      renderQuiz();
      MCF.syncStash();
    }).catch(function (err) {
      countEl.textContent = "The product list could not be loaded.";
      console.error(err);
    });
    document.addEventListener("mcf:stash", renderStash);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
