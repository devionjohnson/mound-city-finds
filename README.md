# Mound City Finds

A standalone static storefront for **Mound City Capital LLC**. It lists trending Amazon products and sends shoppers to Amazon through the Associates tag in `products.json`.

This folder is ready to open locally. It has not been deployed or published.

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
- `blurb` — one short line of copy. Do not put prices here. Amazon’s rules do not allow stale prices, so the page uses a “Check price on Amazon” button instead.

To add a product, append another object to the `products` array. To retire one, delete its object. Keep the JSON valid (commas in the right places), then refresh the site.

The affiliate tag is set once, in `site.affiliateTag`. Every product link is built as `https://www.amazon.com/dp/ASIN?tag=THAT_TAG`. If the Associates tag ever changes, update that one field. The current tag is `printsquad-20`.

After a refresh, also update `site.updated` (YYYY-MM-DD) so the page date stays honest.

## Affiliate disclosure

The site shows this sentence near the top of the page and again next to the product grid:

> As an Amazon Associate we earn from qualifying purchases.

Do not move this into tiny footer type. Amazon’s Associates operating agreement and the FTC both require a clear disclosure.

Product links use `rel="nofollow sponsored noopener noreferrer"`.

## AppLovin pixel

There is a clearly marked placeholder in the `<head>` of `index.html` and `privacy.html`:

```html
<!-- APPLVIN_PIXEL_START -->
<!-- APPLVIN_PIXEL_END -->
```

Paste the official snippet between those comments when AppLovin issues one. Do not invent a pixel ID. After a pixel is added, update the Privacy Policy.

## Images

This version uses category icons, not Amazon product photos, because those photos are not ours to reuse. If official, licensed images are added later, keep them in an `images/` folder and add an optional `image` field to each product. The current script does not display product photos.

## Screenshots

- `screenshot-desktop.png` — 1440×900 view of the homepage
- `screenshot-mobile.png` — 390×844 view of the homepage

## Contact

Mound City Capital LLC · merin9495@gmail.com
