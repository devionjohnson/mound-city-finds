# Mound City Finds

A standalone static storefront for **Mound City Capital LLC**, a registered LLC in the St. Louis, Missouri area. It lists hand-picked trending products and sends shoppers to Amazon through the Associates tag in `products.json`.

Live site: https://moundcityfinds.shop (GitHub Pages also serves https://devionjohnson.github.io/mound-city-finds/)

Pushing to `main` updates GitHub Pages.

## Pages

- `index.html` — homepage and product shelf, with links to buying guides
- `products/<slug>.html` — one original buying-guide page per product
- `guides/<category>.html` — comparison guides for Home, Fitness, Tech, Beauty, and Pets
- `sitemap.xml` — URL list for crawlers
- `about.html` — who operates the site and how products are chosen
- `contact.html` — email, phone, and business name
- `privacy.html` — privacy policy, including Google Analytics and the AppLovin Pixel
- `terms.html` — terms of service
- `404.html` — not-found page in the same layout

## Local preview

From this folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/ in a browser.

There is no build step. Edit the files and refresh.

## How to swap products

All products live in `products.json`. The page reads that file in the browser, so you can change the shelf without touching the HTML.

Each product needs:

- `asin` — the Amazon product ID from a real `amazon.com/dp/ASIN` URL. Do not invent ASINs.
- `name` — a short, plain product name.
- `category` — one of `Home`, `Tech`, `Beauty`, `Fitness`, or `Pets` (or add a new category; a matching icon falls back to Home).
- `blurb` — original descriptive text, usually a few sentences. Do not put prices here. Amazon’s rules do not allow stale prices, so the page uses a “Check price on Amazon” button instead.
- `slug` — the filename of the product’s buying-guide page, without `.html`. Homepage cards link to `products/<slug>.html`.

To add a product, append another object to the `products` array. To retire one, delete its object. Keep the JSON valid (commas in the right places), then refresh the site.

The affiliate tag is set once, in `site.affiliateTag`. Every product link is built as `https://www.amazon.com/dp/ASIN?tag=THAT_TAG`. If the Associates tag ever changes, update that one field. The current tag is `printsquad-20`.

After a refresh, also update `site.updated` (YYYY-MM-DD) so the page date stays honest.

## Affiliate disclosure

Every page shows this sentence once, in the footer at the bottom of the page:

> As an Amazon Associate I earn from qualifying purchases.

Product links use `rel="nofollow sponsored noopener noreferrer"`.

The site does not use Amazon logos and does not claim to be Amazon.

## AppLovin pixel

The official AppLovin Pixel snippet lives between these comments in the `<head>` of every page:

```html
<!-- APPLVIN_PIXEL_START -->
<!-- APPLVIN_PIXEL_END -->
```

Do not invent or replace a pixel ID. If the snippet changes, update every page and keep the Privacy Policy accurate.

## Images

This version uses category icons, not Amazon product photos, because those photos are not ours to reuse. If official, licensed images are added later, keep them in an `images/` folder and add an optional `image` field to each product. The current script does not display product photos.

## Screenshots

- `screenshot-desktop.png` — 1440×900 view of the homepage
- `screenshot-mobile.png` — 390×844 view of the homepage

## Contact

Mound City Capital LLC
St. Louis, Missouri area
merin9495@gmail.com
(314) 897-1129

## Redesign preview (branch `redesign-preview`, not live)

New files: `hq.css`, `hq.js` (shared: store buttons, My Stash, night mode, Arch loader, easter eggs), `setups.html` + `setups.js` + `setups.json` (Mound City Setups), `retailers.json` (store button config). `index.html` is now "Headquarters".

### Store buttons: approved affiliate retailers only

Every product card, product page and guide pick shows a row of store buttons built from `retailers.json`.
A button appears **only** when the retailer is in `approvedRetailers` with `"approved": true` **and** there is an
affiliate link for that product (from the retailer's `linkTemplate` or a per-product entry in `links`).
Right now only Amazon Associates (tag `printsquad-20`) is approved, so every card shows one button: "See today's price at Amazon".
The row is a responsive grid, so it widens automatically as approved retailers are added. No prices are displayed today.

### Adding a newly approved retailer

1. Only after the network (Impact, CJ, Rakuten, Awin, etc.) has **approved** us for that brand, get the affiliate deep link for each product from the network's link builder. Never use plain, non-affiliate links.
2. Add the retailer to `approvedRetailers` in `retailers.json`:

   ```json
   "target": { "label": "Target", "approved": true, "program": "Target Partners via Impact", "buttonText": "Shop", "showPrice": true }
   ```
   (Add `"linkTemplate"` only if the network gives a pattern that works from the ASIN/ID alone, which is rare. Use `{asin}` as the placeholder.)
3. Add the per-product affiliate links under `links`, keyed by the product's ASIN:

   ```json
   "links": { "B00TTD9BRC": { "target": "https://goto.target.com/c/XXXX/YYYY/ZZZZ?u=..." } }
   ```
   Products without a link for that retailer simply don't show its button.
4. Optional, later: once a real price feed exists, write prices into `prices` (`{ "ASIN": { "target": 17.99 } }`).
   Prices render only for retailers with `"showPrice": true`; Amazon stays `false` ("See today's price") until the Creators API is qualified.
   The gold "Best price" tag shows automatically on the cheapest when two or more stores have a real price. Never type in sample or guessed prices.
5. Test locally (`python3 -m http.server 8080`), then commit.
