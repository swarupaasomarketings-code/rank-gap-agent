# Rank Gap Agent – AS Webmarketings

Enter your website. The agent finds your top 4 competitors on Google for the search you choose, reads every website, audits yours, and writes a report: where you rank, what each competitor has that you don't, the problems on your own site, and an action plan in order of impact.

## Run it

You need Node.js 20.9 or newer.

```bash
npm install
npm run build
npm run start        # open http://localhost:3000
```

For development, `npm run dev` instead of build and start.

## Finding competitors: three ways

| Way | Card | What you get |
| --- | --- | --- |
| **Serper key** (recommended) | No | Google Maps results through serper.dev: order, rating, reviews, category, hours, website. Sign up with an email; the free credits are given once (check serper.dev for the current amount), then credits are bought. One report uses 1–2 searches. |
| **Google key** | Yes (billing account) | Google Places API (New), plus the Google PageSpeed score and load times. Google gives a free monthly allowance. Enable Places API (New) and PageSpeed Insights API, create a key (starts with AIza) and restrict it to those two. |
| **No key: paste** | No | Search on Google, select the Businesses list, copy and paste it into the box under the key. Names, order, rating, reviews, hours, "Provides" and the website links are read from the paste. |

Paste the key in the app (it is kept in that browser; Serper or Google is recognised from the key), or put `SERPER_API_KEY=...` or `GOOGLE_API_KEY=...` in `.env.local` and restart. `SERPER_GL` sets the country for Serper (default `in`).

Without a key, speed is measured from your computer instead of Google PageSpeed.

## Automatic mode (home page)

1. **Your website**: type the address and press **Scan website**. The agent reads the business name, city, phone numbers and the searches the site is built for (from titles, headings and page addresses).
2. **Pick the search**: click a suggested search or type your own, check name and city, add a key or paste the Google results, then **Find competitors and gaps**. Progress is shown step by step:
   - The businesses for the search, in Google's order. Your listing is recognised by website domain, then phone number, then name. If you are not in the results, your own listing is looked up so you are still compared.
   - The top 4 other businesses become the competitors (ads are left out).
   - Every website is read: robots.txt (respected), the sitemap (pages, blog posts, service pages, city pages), the home page, the page for the searched service and more pages. Your site gets a deeper read plus a broken-link check.
   - Google PageSpeed (mobile) on every home page, when a Google key is set.
3. **Report**: Google's order with your position; a card per competitor (above you first) with every gap, why it matters and how to fix it; an action plan; **Your Google profile problems** (reviews, rating, hours, category, website and phone, against the competitors' average); **Your website problems** (by severity, with the pages affected); and a side-by-side table of who has what. **Print / save PDF** gives a clean printout.

## Manual mode

To compare businesses of your choice. It starts with room for 4 competitors (empty cards are skipped). Paste Google listings or type them in, add websites, and get the same comparison. **Load example** fills it in for "seo company in kolkata".

## What it compares

| Group | Signals |
| --- | --- |
| Prominence | Review count, star rating, age of the newest review, reviews in the last 90 days and photos (manual) |
| Relevance | Primary category, opening hours (open at the time of search), website linked on the profile, "Provides:" line (manual), keyword in business name |
| Website | Service and city in title and H1, a page for the service, pages about the service and the city, blog posts, total pages, city mentions, content length, LocalBusiness and FAQ schema, sitemap, noindex, HTTPS, mobile viewport, Google PageSpeed score and LCP, click-to-call or map, enquiry form, WhatsApp, social profiles, testimonials |

The audit of your own site also checks: robots.txt blocking, noindex pages, missing or duplicate titles, long titles, missing meta descriptions, missing or multiple H1s, thin pages, images without alt text, canonical tags, broken internal links, HTML size, slow loading and layout shift, schema address, and whether the phone on Google matches the website.

Each gap is rated High, Medium or Low. Google does not publish its weights, so the ratings are a judgement, not a score.

## Limits

- Google's order comes from Places search. The map pack one person sees can differ with their location.
- Some websites block automated visits (for example HTTP 403). The report says so and moves on; it does not try to get around the block.
- Backlinks, citations and profile age are not visible without paid tools, so they are not compared. When a competitor is level with you on everything visible, the report says the difference probably lies there.

## Tests

```bash
npm test                    # unit and route tests (Google answers are mocked fixtures)
node tests/e2e/auto.mjs     # automatic mode in a browser; reads the real aswebmarketings.com
GOOGLE_API_KEY=... node tests/e2e/auto.mjs   # also runs the real competitor search
npm run test:e2e            # manual mode in a browser (needs: npx playwright install chromium)
```

## Code

```
src/app/page.js               Automatic mode
src/app/manual/page.js        Manual mode
src/components/Report.js      The report, shared by both modes
src/app/api/scan/route.js     Reads your website: name, city, phones, searches
src/app/api/auto/route.js     Competitor search, website reads, PageSpeed, comparison and audits, streamed as progress
src/app/api/analyze/route.js  Manual mode comparison
src/lib/google.js             Places API (New) and PageSpeed Insights
src/lib/serper.js             Serper (Google Maps results)
src/lib/pasteLinks.js         Website links from pasted Google results
src/lib/discover.js           Business name, city and searches from a website
src/lib/siteCheck.js          Reads a website: robots.txt, sitemap, pages, links
src/lib/audit.js              Problems on your own website and Google profile
src/lib/engine.js             The comparison: factors, gaps, action plan
src/lib/parseResults.js       Reads text pasted from Google (manual mode)
src/lib/safeFetch.js          Fetching that refuses private network addresses and caps size and time
```
