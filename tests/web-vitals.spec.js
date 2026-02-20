// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_URL || 'https://bedavafinans.info';

test.describe('Web Vitals & Performance', () => {

    test('Core Web Vitals - LCP, CLS, DOM size', async ({ page }) => {
        // Collect performance entries
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Wait for content to render
        await page.waitForTimeout(3000);

        // --- LCP (Largest Contentful Paint) ---
        const lcp = await page.evaluate(() => {
            return new Promise((resolve) => {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    resolve(entries.length ? entries[entries.length - 1].startTime : null);
                }).observe({ type: 'largest-contentful-paint', buffered: true });
                // Fallback if no LCP entry
                setTimeout(() => resolve(null), 2000);
            });
        });

        console.log(`LCP: ${lcp ? Math.round(lcp) + 'ms' : 'N/A'}`);
        if (lcp) {
            // Good: <2500ms, Needs improvement: <4000ms, Poor: >4000ms
            expect(lcp).toBeLessThan(4000);
        }

        // --- CLS (Cumulative Layout Shift) ---
        const cls = await page.evaluate(() => {
            return new Promise((resolve) => {
                let clsValue = 0;
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                    resolve(clsValue);
                }).observe({ type: 'layout-shift', buffered: true });
                setTimeout(() => resolve(clsValue), 2000);
            });
        });

        console.log(`CLS: ${cls.toFixed(4)}`);
        // Good: <0.1, Needs improvement: <0.25, Poor: >0.25
        expect(cls).toBeLessThan(0.25);

        // --- DOM Size ---
        const domStats = await page.evaluate(() => {
            return {
                totalElements: document.querySelectorAll('*').length,
                maxDepth: (() => {
                    let max = 0;
                    const walk = (el, depth) => {
                        if (depth > max) max = depth;
                        for (const child of el.children) walk(child, depth + 1);
                    };
                    walk(document.documentElement, 0);
                    return max;
                })(),
                bodyChildren: document.body.children.length,
            };
        });

        console.log(`DOM elements: ${domStats.totalElements}`);
        console.log(`DOM max depth: ${domStats.maxDepth}`);
        // Lighthouse flags >1500 elements
        expect(domStats.totalElements).toBeLessThan(3000);

        // --- Page weight ---
        const resources = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource');
            let totalBytes = 0;
            const byType = {};
            entries.forEach(e => {
                const size = e.transferSize || 0;
                totalBytes += size;
                const ext = e.name.split('?')[0].split('.').pop() || 'other';
                byType[ext] = (byType[ext] || 0) + size;
            });
            return { totalBytes, byType, count: entries.length };
        });

        console.log(`Total transfer: ${(resources.totalBytes / 1024).toFixed(0)} KB (${resources.count} requests)`);
        Object.entries(resources.byType).sort((a, b) => b[1] - a[1]).forEach(([type, bytes]) => {
            console.log(`  .${type}: ${(bytes / 1024).toFixed(0)} KB`);
        });
    });

    test('Performance metrics - TTFB, FCP, Load time', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        const timing = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            const fcp = paint.find(p => p.name === 'first-contentful-paint');

            return {
                ttfb: Math.round(nav.responseStart - nav.requestStart),
                fcp: fcp ? Math.round(fcp.startTime) : null,
                domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
                loadComplete: Math.round(nav.loadEventEnd),
                domInteractive: Math.round(nav.domInteractive),
            };
        });

        console.log(`TTFB: ${timing.ttfb}ms`);
        console.log(`FCP: ${timing.fcp}ms`);
        console.log(`DOM Interactive: ${timing.domInteractive}ms`);
        console.log(`DOM Content Loaded: ${timing.domContentLoaded}ms`);
        console.log(`Load Complete: ${timing.loadComplete}ms`);

        // TTFB should be under 800ms (good < 200ms)
        expect(timing.ttfb).toBeLessThan(2000);
        // FCP should be under 3s
        if (timing.fcp) expect(timing.fcp).toBeLessThan(3000);
    });

    test('Render blocking resources', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

        const blocking = await page.evaluate(() => {
            const resources = performance.getEntriesByType('resource');
            return resources
                .filter(r => r.renderBlockingStatus === 'blocking')
                .map(r => ({
                    name: r.name.split('/').pop().split('?')[0],
                    type: r.initiatorType,
                    duration: Math.round(r.duration),
                    size: r.transferSize ? Math.round(r.transferSize / 1024) + 'KB' : 'cached',
                }));
        });

        console.log(`Render-blocking resources: ${blocking.length}`);
        blocking.forEach(r => {
            console.log(`  ${r.name} (${r.type}) - ${r.duration}ms, ${r.size}`);
        });
    });

    test('Image optimization check', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        const images = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src.split('/').pop().split('?')[0],
                width: img.naturalWidth,
                height: img.naturalHeight,
                displayWidth: img.clientWidth,
                displayHeight: img.clientHeight,
                loading: img.loading,
                oversized: img.naturalWidth > img.clientWidth * 2,
            }));
        });

        const missingLazy = images.filter(i => i.loading !== 'lazy');
        const oversized = images.filter(i => i.oversized);

        console.log(`Total images: ${images.length}`);
        console.log(`Missing loading="lazy": ${missingLazy.length}`);
        console.log(`Oversized (>2x display size): ${oversized.length}`);

        if (missingLazy.length > 0) {
            missingLazy.slice(0, 5).forEach(i => console.log(`  No lazy: ${i.src} (${i.width}x${i.height})`));
        }
    });

    test('Accessibility basics', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        const a11y = await page.evaluate(() => {
            const issues = [];

            // Check images without alt
            const imgsNoAlt = document.querySelectorAll('img:not([alt])');
            if (imgsNoAlt.length) issues.push(`${imgsNoAlt.length} images without alt attribute`);

            // Check buttons without accessible name
            document.querySelectorAll('button').forEach(btn => {
                if (!btn.textContent.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('title')) {
                    issues.push(`Button without accessible name: ${btn.outerHTML.slice(0, 80)}`);
                }
            });

            // Check contrast of text
            const html = document.documentElement;
            const isDark = html.classList.contains('dark');

            // Check heading hierarchy
            const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
            let lastLevel = 0;
            headings.forEach(h => {
                const level = parseInt(h.tagName[1]);
                if (level > lastLevel + 1) {
                    issues.push(`Heading skip: h${lastLevel} -> h${level}`);
                }
                lastLevel = level;
            });

            // Check for meta viewport
            const viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) issues.push('Missing viewport meta tag');

            // Check lang attribute
            if (!html.getAttribute('lang')) issues.push('Missing lang attribute on html');

            return { issues, headingCount: headings.length };
        });

        console.log(`Accessibility issues: ${a11y.issues.length}`);
        a11y.issues.forEach(i => console.log(`  - ${i}`));
        console.log(`Heading elements: ${a11y.headingCount}`);
    });

    test('Third-party script impact', async ({ page }) => {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        const scripts = await page.evaluate(() => {
            const entries = performance.getEntriesByType('resource');
            const origin = window.location.origin;
            return entries
                .filter(r => r.initiatorType === 'script' && !r.name.startsWith(origin))
                .map(r => ({
                    url: r.name.split('?')[0],
                    duration: Math.round(r.duration),
                    size: r.transferSize ? Math.round(r.transferSize / 1024) + 'KB' : 'cached',
                    blocking: r.renderBlockingStatus === 'blocking',
                }));
        });

        console.log(`Third-party scripts: ${scripts.length}`);
        scripts.forEach(s => {
            console.log(`  ${s.url.split('/').slice(2, 4).join('/')} - ${s.duration}ms, ${s.size}${s.blocking ? ' [BLOCKING]' : ''}`);
        });
    });
});
