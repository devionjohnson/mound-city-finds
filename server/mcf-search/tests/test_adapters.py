import json, os, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import adapters
from adapters import rakuten, flexoffers, impact, awin, cj, amazon_creators

FX = os.path.join(HERE, "fixtures")
KEYS = {"id", "source", "network", "merchant", "title", "description", "image", "price", "currency", "affiliate_url", "asin", "category"}


class Adapters(unittest.TestCase):
    def test_rakuten_parse(self):
        r = rakuten.parse(open(os.path.join(FX, "rakuten.xml")).read())
        self.assertEqual(len(r), 1); self.assertEqual(set(r[0]), KEYS)
        self.assertEqual(r[0]["price"], 24.99); self.assertEqual(r[0]["merchant"], "Fixture Outfitters")
        self.assertTrue(r[0]["affiliate_url"].startswith("https://click.linksynergy.com/"))

    def test_rakuten_empty(self):
        self.assertEqual(rakuten.parse(open(os.path.join(FX, "rakuten_empty.xml")).read()), [])

    def test_flexoffers_parse(self):
        r = flexoffers.parse({"results": [{"name": "FO Mat", "advertiserName": "FO Store", "imageUrl": "i", "price": "10", "currency": "USD", "linkUrl": "https://track.flexlinkspro.com/x", "pid": 7}]})
        self.assertEqual(r[0]["network"], "flexoffers"); self.assertEqual(r[0]["price"], 10.0); self.assertEqual(set(r[0]), KEYS)

    def test_impact_parse(self):
        r = impact.parse({"Items": [{"Name": "IM Lamp", "CampaignName": "Brand", "ImageUrl": "i", "CurrentPrice": "5.5", "Currency": "USD", "Url": "https://brand.sjv.io/x", "CatalogItemId": "9"}]})
        self.assertEqual(r[0]["merchant"], "Brand"); self.assertEqual(r[0]["price"], 5.5)

    def test_awin_parse(self):
        csvt = "aw_product_id,product_name,description,merchant_name,aw_image_url,search_price,currency,aw_deep_link,merchant_category\n1,AW Kettle,Nice,AW Shop,i,12,GBP,https://www.awin1.com/pclick.php?x,Home\n"
        r = awin.parse_csv(csvt); self.assertEqual(r[0]["currency"], "GBP"); self.assertEqual(set(r[0]), KEYS)

    def test_cj_parse(self):
        d = {"data": {"shoppingProducts": {"resultList": [{"id": "c1", "title": "CJ Shoe", "advertiserName": "CJ Co", "imageLink": "i", "price": {"amount": "40", "currency": "USD"}, "salePrice": None, "linkCode": {"clickUrl": "https://www.anrdoezrs.net/x"}}]}}}
        r = cj.parse(d); self.assertEqual(r[0]["price"], 40.0); self.assertEqual(r[0]["affiliate_url"], "https://www.anrdoezrs.net/x")

    def test_missing_price_is_null(self):
        r = impact.parse({"Items": [{"Name": "No price", "Url": "https://x", "CatalogItemId": "1"}]})
        self.assertIsNone(r[0]["price"]); self.assertIsNone(r[0]["currency"])

    def test_disabled_without_env(self):
        for a in adapters.ALL:
            self.assertFalse(a.enabled({}), a.NAME)
            self.assertEqual(a.search("bottle", {}), [], a.NAME)
        self.assertFalse(amazon_creators.enabled({"CREATORS_CREDENTIAL_ID": "x", "CREATORS_SECRET": "y", "CREATORS_VERSION": "2"}))


class App(unittest.TestCase):
    def test_site_search_and_merge(self):
        import app
        app._site.update(items=[{"id": "amazon:B0", "title": "Owala Water Bottle", "keywords": "bottle", "network": "amazon", "affiliate_url": "u", "category": "Fitness"}], at=9e18)
        body = app.search("water bottles")
        self.assertEqual([r["id"] for r in body["results"]], ["amazon:B0"])
        self.assertTrue(all(v == "disabled" for v in body["networks"].values()))
        self.assertTrue(app.search("water bottles")["cached"])

    def test_rate_limit(self):
        import app
        ok = [app.allowed("9.9.9.9") for _ in range(app.RATE + 3)]
        self.assertEqual(ok.count(False), 3)


if __name__ == "__main__":
    unittest.main()
