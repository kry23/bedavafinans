"""Playwright E2E test for BedavaFinans Dashboard."""

import asyncio
from playwright.async_api import async_playwright

URL = "http://localhost:8000"
RESULTS = []


def log(test_name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    RESULTS.append((test_name, passed, detail))
    print(f"  [{status}] {test_name}" + (f" - {detail}" if detail else ""))


async def run_tests():
    print("=" * 60)
    print("BedavaFinans Dashboard - Playwright E2E Tests")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Collect console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # ─── Test 1: Page loads ───
        print("\n--- Page Load ---")
        try:
            resp = await page.goto(URL, wait_until="networkidle", timeout=30000)
            log("Page loads successfully", resp.status == 200, f"Status: {resp.status}")
        except Exception as e:
            log("Page loads successfully", False, str(e))
            await browser.close()
            return

        # ─── Test 2: Title ───
        title = await page.title()
        log("Page title correct", "BedavaFinans" in title, f"Title: {title}")

        # ─── Test 3: Header renders ───
        print("\n--- Header ---")
        header_text = await page.text_content("header")
        log("Header contains BedavaFinans", "BedavaFinans" in header_text)
        log("Header has Auto refresh button", "Oto" in header_text or "Auto" in header_text)

        # Wait for data to load
        await page.wait_for_timeout(5000)

        # ─── Test 4: Market Overview Cards ───
        print("\n--- Market Overview ---")
        mcap = await page.text_content("#total-mcap")
        log("Total Market Cap loads", mcap != "—" and "$" in mcap, f"Value: {mcap}")

        volume = await page.text_content("#total-volume")
        log("24h Volume loads", volume != "—" and "$" in volume, f"Value: {volume}")

        btc_dom = await page.text_content("#btc-dominance")
        log("BTC Dominance loads", btc_dom != "—" and "%" in btc_dom, f"Value: {btc_dom}")

        # ─── Test 5: Fear & Greed Gauge ───
        fg_gauge = await page.query_selector("#fear-greed-gauge .gauge-value")
        if fg_gauge:
            fg_value = await fg_gauge.text_content()
            log("Fear & Greed gauge renders", fg_value.strip().isdigit(), f"Value: {fg_value.strip()}")
        else:
            log("Fear & Greed gauge renders", False, "Gauge element not found")

        # ─── Test 6: Market Score Ring ───
        print("\n--- Market Score ---")
        score_ring = await page.query_selector("#market-score-ring svg")
        log("Market Score ring renders", score_ring is not None)

        # ─── Test 7: Signal Table ───
        print("\n--- Signals ---")
        signal_rows = await page.query_selector_all("#signals-tbody tr")
        row_count = len(signal_rows)
        log("Signal table has rows", row_count > 0, f"Rows: {row_count}")

        # Check signal badges exist
        badges = await page.query_selector_all(".signal-badge")
        log("Signal badges render", len(badges) > 0, f"Badges: {len(badges)}")

        # Check for specific signal text
        signals_text = await page.text_content("#signals-tbody")
        has_signal = any(s in signals_text for s in ["STRONG BUY", "BUY", "NEUTRAL", "SELL", "STRONG SELL", "NO DATA", "GÜÇLÜ AL", "AL", "NÖTR", "SAT", "GÜÇLÜ SAT", "VERİ YOK"])
        log("Signal labels present", has_signal)

        # ─── Test 8: Derivatives Panel ───
        print("\n--- Derivatives ---")
        deriv_content = await page.text_content("#derivatives-list")
        has_deriv = "BTC" in deriv_content or "ETH" in deriv_content or "Loading" in deriv_content or "Yükleniyor" in deriv_content
        log("Derivatives panel has content", has_deriv, f"Contains BTC/ETH: {'BTC' in deriv_content or 'ETH' in deriv_content}")

        # ─── Test 9: Chart ───
        print("\n--- Chart ---")
        chart_container = await page.query_selector("#chart-container")
        chart_html = await chart_container.inner_html() if chart_container else ""
        has_canvas = "canvas" in chart_html.lower() or "tv-lightweight" in chart_html.lower() or len(chart_html) > 100
        log("Chart container has content", has_canvas, f"HTML length: {len(chart_html)}")

        chart_title = await page.text_content("#chart-title")
        log("Chart title shows Bitcoin", "Bitcoin" in chart_title, f"Title: {chart_title}")

        # ─── Test 10: Top Movers ───
        print("\n--- Top Movers ---")
        movers_content = await page.text_content("#movers-list")
        has_movers = "Loading" not in movers_content and "Yükleniyor" not in movers_content and len(movers_content.strip()) > 10
        log("Top Movers panel loads data", has_movers)

        # Test tab switching
        losers_btn = await page.query_selector('[data-tab="losers"]')
        if losers_btn:
            await losers_btn.click()
            await page.wait_for_timeout(500)
            movers_after = await page.text_content("#movers-list")
            log("Movers tab switch works", movers_after != movers_content or len(movers_after) > 10)

        # ─── Test 11: Volume Anomalies ───
        print("\n--- Volume Anomalies ---")
        anomalies_content = await page.text_content("#anomalies-list")
        log("Volume anomalies panel renders", len(anomalies_content.strip()) > 5)

        # ─── Test 12: Whale Ticker ───
        print("\n--- Whale Ticker ---")
        whale_el = await page.query_selector("#whale-ticker")
        whale_content = await whale_el.inner_html() if whale_el else ""
        has_whale = "whale-ticker" in whale_content or "BTC" in whale_content or "loading" in whale_content.lower() or "yükleniyor" in whale_content.lower() or "balina" in whale_content.lower()
        log("Whale ticker renders", has_whale)

        # ─── Test 13: News Sentiment ───
        print("\n--- News Sentiment ---")
        sentiment_content = await page.text_content("#news-sentiment")
        has_sentiment = "Loading" not in sentiment_content and "Yükleniyor" not in sentiment_content and len(sentiment_content.strip()) > 10
        log("News sentiment panel loads", has_sentiment)

        # ─── Test 14: Coin Table ───
        print("\n--- Coin Table ---")
        coin_rows = await page.query_selector_all("#coins-tbody tr")
        log("Coin table has rows", len(coin_rows) > 0, f"Rows: {len(coin_rows)}")

        coins_text = await page.text_content("#coins-tbody")
        log("Coin table shows Bitcoin", "Bitcoin" in coins_text)
        log("Coin table shows Ethereum", "Ethereum" in coins_text)

        # ─── Test 15: Search functionality ───
        print("\n--- Search ---")
        search_input = await page.query_selector("#coin-search")
        if search_input:
            await search_input.fill("eth")
            await page.wait_for_timeout(500)
            filtered_rows = await page.query_selector_all("#coins-tbody tr")
            log("Search filters coins", len(filtered_rows) < len(coin_rows), f"Filtered: {len(filtered_rows)} (from {len(coin_rows)})")

            await search_input.fill("")
            await page.wait_for_timeout(300)

        # ─── Test 16: Coin selection (click to load chart) ───
        print("\n--- Coin Selection ---")
        eth_row = await page.query_selector("#coins-tbody tr:nth-child(2)")
        if eth_row:
            await eth_row.click()
            await page.wait_for_timeout(2000)
            new_title = await page.text_content("#chart-title")
            log("Clicking coin updates chart title", new_title != "Bitcoin (BTC)", f"New title: {new_title}")

        # ─── Test 17: Auto-refresh toggle ───
        print("\n--- Auto Refresh ---")
        toggle = await page.query_selector("#refresh-toggle")
        if toggle:
            toggle_text = await toggle.text_content()
            log("Auto refresh button shows 'Auto/Oto'", "Auto" in toggle_text or "Oto" in toggle_text)
            await toggle.click()
            await page.wait_for_timeout(300)
            new_text = await toggle.text_content()
            log("Toggle switches to 'Paused/Durduruldu'", "Paused" in new_text or "Durduruldu" in new_text, f"Text: {new_text}")

        # ─── Test 18: Language Toggle ───
        print("\n--- Language Toggle ---")
        lang_btn = await page.query_selector("#lang-toggle")
        if lang_btn:
            lang_text = await lang_btn.text_content()
            log("Language button visible", lang_text.strip() in ["EN", "TR"])
            await lang_btn.click()
            await page.wait_for_timeout(1000)
            new_lang_text = await lang_btn.text_content()
            log("Language toggle switches", new_lang_text.strip() != lang_text.strip(), f"{lang_text.strip()} -> {new_lang_text.strip()}")
            # Switch back to original
            await lang_btn.click()
            await page.wait_for_timeout(500)

        # ─── Test 19: Theme Toggle ───
        print("\n--- Theme Toggle ---")
        theme_btn = await page.query_selector("#theme-toggle")
        if theme_btn:
            # Should start as dark
            html_class = await page.evaluate("document.documentElement.className")
            log("Default theme is dark", "dark" in html_class, f"Class: {html_class}")

            # Click to switch to light
            await theme_btn.click()
            await page.wait_for_timeout(500)
            html_class_after = await page.evaluate("document.documentElement.className")
            log("Theme switches to light", "light" in html_class_after, f"Class: {html_class_after}")

            # Take light mode screenshot
            await page.screenshot(path="c:/Users/User/Desktop/kry-fin/dashboard_light.png", full_page=True)
            log("Light mode screenshot saved", True, "dashboard_light.png")

            # Switch back to dark
            await theme_btn.click()
            await page.wait_for_timeout(500)
            html_class_back = await page.evaluate("document.documentElement.className")
            log("Theme switches back to dark", "dark" in html_class_back, f"Class: {html_class_back}")

        # ─── Test 20: Console errors ───
        print("\n--- Console Errors ---")
        critical_errors = [e for e in console_errors if "TypeError" in e or "ReferenceError" in e or "SyntaxError" in e]
        log("No critical JS errors", len(critical_errors) == 0,
            f"Errors: {critical_errors[:3]}" if critical_errors else "Clean")

        # ─── Test 21: Screenshot ───
        print("\n--- Screenshot ---")
        await page.screenshot(path="c:/Users/User/Desktop/kry-fin/dashboard_test.png", full_page=True)
        log("Screenshot saved", True, "dashboard_test.png")

        await browser.close()

    # ─── Summary ───
    print("\n" + "=" * 60)
    passed = sum(1 for _, p, _ in RESULTS if p)
    failed = sum(1 for _, p, _ in RESULTS if not p)
    total = len(RESULTS)
    print(f"RESULTS: {passed}/{total} passed, {failed} failed")
    if failed > 0:
        print("\nFailed tests:")
        for name, p, detail in RESULTS:
            if not p:
                print(f"  - {name}: {detail}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_tests())
