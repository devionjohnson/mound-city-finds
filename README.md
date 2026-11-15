# Mound City Finds

A standalone static storefront for **Mound City Capital LLC**, a registered LLC in the St. Louis, Missouri area. It lists hand-picked trending products and sends shoppers to Amazon through the Associates tag in `products.json`.

Live site: https://devionjohnson.github.io/mound-city-finds/

Pushing to `main` updates GitHub Pages.

## Pages

- `index.html` — homepage and product shelf
- `about.html` — who operates the site and how products are chosen
- `contact.html` — email, phone, and business name
- `privacy.html` — privacy policy, including the AppLovin Pixel
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

To add a product, append another object to the `products` array. To retire one, delete its object. Keep the JSON valid (commas in the right places), then refresh the site.

The affiliate tag is set once, in `site.affiliateTag`. Every product link is built as `https://www.amazon.com/dp/ASIN?tag=THAT_TAG`. If the Associates tag ever changes, update that one field. The current tag is `printsquad-20`.

After a refresh, also update `site.updated` (YYYY-MM-DD) so the page date stays honest.

## Affiliate disclosure

The site shows this sentence at the top of every page, again next to the product grid, and in the footer:

> As an Amazon Associate I earn from qualifying purchases.

Do not move this into tiny footer type only. Amazon’s Associates operating agreement and the FTC both require a clear disclosure.

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
