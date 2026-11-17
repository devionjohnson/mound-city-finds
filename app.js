const ICONS = {
  Home: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 22.5 24 9l16 13.5V39a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V22.5Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M19 41V28h10v13" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
  Tech: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="7" y="10" width="34" height="22" rx="3" stroke="currentColor" stroke-width="2.4"/><path d="M16 40h16M24 32v8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  Beauty: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M16 20c0-6 4.2-11 8-11s8 5 8 11c0 8-8 18-8 18s-8-10-8-18Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M20.5 21.5c.6-3 2.4-5 3.5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  Fitness: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 18v12M16 14v20M32 14v20M38 18v12M16 24h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  Pets: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="15" cy="16" r="4" stroke="currentColor" stroke-width="2.3"/><circle cx="33" cy="16" r="4" stroke="currentColor" stroke-width="2.3"/><circle cx="10.5" cy="26" r="3.5" stroke="currentColor" stroke-width="2.3"/><circle cx="37.5" cy="26" r="3.5" stroke="currentColor" stroke-width="2.3"/><ellipse cx="24" cy="31" rx="8.5" ry="7.5" stroke="currentColor" stroke-width="2.3"/></svg>`
};

const ICON_CLASS = {
  Home: "icon-home",
  Tech: "icon-tech",
  Beauty: "icon-beauty",
  Fitness: "icon-fitness",
  Pets: "icon-pets"
};

let catalog = { site: {}, products: [] };
let activeCategory = "All";

function affiliateUrl(asin, tag) {
  const url = new URL(`https://www.amazon.com/dp/${encodeURIComponent(asin)}`);
  url.searchParams.set("tag", tag);
  return url.toString();
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function renderFilters(products) {
  const cats = ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  const root = document.getElementById("filters");
  root.innerHTML = "";
  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.textContent = cat;
    btn.setAttribute("aria-pressed", cat === activeCategory ? "true" : "false");
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderFilters(products);
      renderGrid(products);
    });
    root.appendChild(btn);
  });
}

function renderGrid(products) {
  const list = activeCategory === "All"
    ? products
    : products.filter((p) => p.category === activeCategory);
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const tag = catalog.site.affiliateTag;
  grid.innerHTML = "";
  empty.hidden = list.length > 0;

  list.forEach((product) => {
    const href = affiliateUrl(product.asin, tag);
    const article = document.createElement("article");
    article.className = "card";
    const pageHref = product.slug ? `products/${encodeURIComponent(product.slug)}.html` : href;
    article.innerHTML = `
      <div class="icon-wrap ${ICON_CLASS[product.category] || "icon-home"}">${ICONS[product.category] || ICONS.Home}</div>
      <p class="cat-pill">${product.category}</p>
      <h3>${product.slug ? `<a class="card-title-link" href="${pageHref}">${escapeHtml(product.name)}</a>` : escapeHtml(product.name)}</h3>
      <p class="blurb">${escapeHtml(product.blurb)}</p>
      <div class="card-actions">
        ${product.slug ? `<a class="buy-secondary" href="${pageHref}">Read the buying guide</a>` : ""}
        <a class="buy" href="${href}" target="_blank" rel="nofollow sponsored noopener noreferrer">
          Check price on Amazon
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M6 3h7v7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="visually-hidden"> (opens on Amazon)</span>
        </a>
      </div>
    `;
    grid.appendChild(article);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function init() {
  const countEl = document.getElementById("product-count");
  try {
    const res = await fetch("products.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load products.json");
    catalog = await res.json();
    const products = catalog.products || [];
    countEl.textContent = `${products.length} products`;
    const updated = document.getElementById("updated-date");
    if (catalog.site.updated) {
      updated.dateTime = catalog.site.updated;
      updated.textContent = formatDate(catalog.site.updated);
    }
    renderFilters(products);
    renderGrid(products);
  } catch (err) {
    countEl.textContent = "The product list could not be loaded.";
    console.error(err);
  }
}

init();
