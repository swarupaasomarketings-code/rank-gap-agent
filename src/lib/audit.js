import { phoneKey } from './siteCheck.js';

// Problems on your own website, independent of competitors. Each issue says where it was found and how to fix it.
export const SEVERITY = { Critical: 4, High: 3, Medium: 2, Low: 1 };
// "https://x.com/page/ (69)" → "/page/ (69)"; the home page shows as the domain.
const short = (entry) => {
  const [, u, note = ''] = /^(\S+)(\s.*)?$/.exec(String(entry)) || [null, entry];
  try { const x = new URL(u); return `${x.pathname === '/' || !x.pathname ? x.hostname : decodeURIComponent(x.pathname)}${note}`; } catch { return entry; }
};

export function auditSite(site, { business = {}, terms } = {}) {
  const issues = [];
  const add = (severity, area, title, detail, fix, urls = []) => issues.push({ severity, area, title, detail, fix, urls: urls.slice(0, 12).map(short), more: Math.max(0, urls.length - 12) });
  if (!site?.ok) {
    add('Critical', 'Website', 'Website could not be checked', site?.error || 'It did not load.', 'Open it on a phone using mobile data. Fix server errors, redirect loops or firewall rules that block visitors and Google.');
    return issues;
  }
  const pages = site.pages.filter((p) => !p.error);
  const home = site.home;

  // Crawling and indexing
  if (site.robots.disallowAll) add('Critical', 'Indexing', 'robots.txt blocks the whole site', 'robots.txt tells every crawler, Google included, not to read any page.', 'Remove "Disallow: /" from robots.txt (in WordPress: Settings → Reading → untick "Discourage search engines").');
  const noindex = pages.filter((p) => p.noindex);
  if (noindex.length) add(noindex.includes(home) ? 'Critical' : 'High', 'Indexing', `${noindex.length} page${noindex.length > 1 ? 's are' : ' is'} marked noindex`, 'A noindex tag keeps the page out of Google.', 'Remove the noindex robots tag from pages you want found (check the SEO plugin settings for each page).', noindex.map((p) => p.url));
  if (!site.sitemap.found) add('Medium', 'Indexing', 'No XML sitemap found', 'Checked robots.txt, /sitemap.xml, /sitemap_index.xml and /wp-sitemap.xml.', 'Generate a sitemap (Rank Math or Yoast do it), list it in robots.txt and submit it in Google Search Console.');
  if (!site.robots.found) add('Low', 'Indexing', 'No robots.txt', 'Not required, but it is where crawlers look for the sitemap.', 'Add a robots.txt with a Sitemap: line.');
  if (!site.https) add('High', 'Security', 'Website is not on HTTPS', 'Browsers show "Not secure" and Google prefers secure pages.', 'Install a free SSL certificate and redirect every http address to https.');
  if (site.brokenLinks.length) add('High', 'Links', `${site.brokenLinks.length} broken internal link${site.brokenLinks.length > 1 ? 's' : ''}`, `Out of ${site.checkedLinks} internal addresses checked, these answer with an error (${[...new Set(site.brokenLinks.map((l) => l.status))].join(', ')}).`, 'Fix or remove the links, or redirect the old address to the right page (301).', site.brokenLinks.map((l) => l.url));

  // Speed
  const sp = site.speed;
  if (sp && !sp.error) {
    if (sp.score < 50) add('High', 'Speed', `Mobile performance score ${sp.score}/100`, 'Measured by Google PageSpeed (Lighthouse, mobile). Under 50 is poor.', 'Compress and lazy-load images, serve WebP, cache pages, remove unused plugins and scripts, use a CDN.');
    else if (sp.score < 90) add('Medium', 'Speed', `Mobile performance score ${sp.score}/100`, 'Measured by Google PageSpeed (Lighthouse, mobile). 90 or more is good.', 'Compress images, defer scripts that are not needed at first load, cache pages.');
    if (sp.lcpMs > 4000) add('High', 'Speed', `Main content appears after ${(sp.lcpMs / 1000).toFixed(1)} s on mobile`, 'Largest Contentful Paint should be under 2.5 s.', 'Make the first large image or heading load first: smaller hero image, preload it, no slider at the top.');
    else if (sp.lcpMs > 2500) add('Medium', 'Speed', `Main content appears after ${(sp.lcpMs / 1000).toFixed(1)} s on mobile`, 'Largest Contentful Paint should be under 2.5 s.', 'Use a smaller hero image and preload it.');
    if (sp.cls > 0.25) add('Medium', 'Speed', `Layout shifts while loading (CLS ${sp.cls.toFixed(2)})`, 'Content jumps as the page loads. It should be under 0.1.', 'Give images and banners fixed width and height; load fonts with font-display: swap.');
  } else if (site.responseMs > 2500) add('Medium', 'Speed', `Home page took ${(site.responseMs / 1000).toFixed(1)} s to arrive`, 'One measurement from this computer (PageSpeed was not available).', 'Enable page caching and check the hosting plan.');
  if (site.htmlKb > 500) add('Low', 'Speed', `Home page HTML is ${site.htmlKb} KB`, 'Large HTML usually means page-builder bloat or inline code.', 'Remove unused sections and inline styles; most home pages need under 150 KB of HTML.');

  // On-page, across the pages read
  const missingTitle = pages.filter((p) => !p.title);
  if (missingTitle.length) add('High', 'On-page', `${missingTitle.length} page${missingTitle.length > 1 ? 's have' : ' has'} no title`, 'The title is what Google shows as the blue link.', 'Write a unique title for each page: service, city, brand.', missingTitle.map((p) => p.url));
  const longTitle = pages.filter((p) => p.titleLength > 65);
  if (longTitle.length) add('Low', 'On-page', `${longTitle.length} title${longTitle.length > 1 ? 's are' : ' is'} longer than 65 characters`, 'Google cuts long titles off in results.', 'Keep titles to about 50–60 characters with the service and city first.', longTitle.map((p) => `${p.url} (${p.titleLength})`));
  const dupTitles = groupDupes(pages, 'title');
  if (dupTitles.length) add('Medium', 'On-page', `${dupTitles.length} page${dupTitles.length > 1 ? 's share' : ' shares'} a title with another page`, 'Duplicate titles make Google guess which page to show.', 'Give every page its own title.', dupTitles.map((p) => p.url));
  const noDesc = pages.filter((p) => !p.description);
  if (noDesc.length) add('Medium', 'On-page', `${noDesc.length} page${noDesc.length > 1 ? 's have' : ' has'} no meta description`, 'Google then writes its own snippet, often a poor one.', 'Write a 120–155 character description with the service, city and a reason to click.', noDesc.map((p) => p.url));
  const noH1 = pages.filter((p) => p.h1Count === 0);
  if (noH1.length) add('Medium', 'On-page', `${noH1.length} page${noH1.length > 1 ? 's have' : ' has'} no H1 heading`, 'The H1 tells Google and visitors what the page is about.', 'Add one H1 per page that names the service (and city on service pages).', noH1.map((p) => p.url));
  const manyH1 = pages.filter((p) => p.h1Count > 1);
  if (manyH1.length) add('Low', 'On-page', `${manyH1.length} page${manyH1.length > 1 ? 's have' : ' has'} more than one H1`, 'Several H1s blur the main topic.', 'Keep one H1 and turn the others into H2.', manyH1.map((p) => `${p.url} (${p.h1Count})`));
  const thin = pages.filter((p) => p !== home && p.wordCount < 300 && !/contact|about|portfolio|gallery/i.test(p.url));
  if (thin.length) add('Medium', 'Content', `${thin.length} thin page${thin.length > 1 ? 's' : ''} (under 300 words)`, 'Service pages with little text rarely rank.', 'Expand each with what you do, process, prices, local examples and FAQs.', thin.map((p) => `${p.url} (${p.wordCount} words)`));
  const altMissing = pages.reduce((a, p) => a + (p.imagesWithoutAlt || 0), 0);
  if (altMissing) add('Low', 'On-page', `${altMissing} images without alt text`, `Across ${pages.length} pages read. Alt text helps image search and screen readers.`, 'Describe each meaningful image in a few words; decorative images can keep an empty alt.', pages.filter((p) => p.imagesWithoutAlt).sort((a, b) => b.imagesWithoutAlt - a.imagesWithoutAlt).map((p) => `${p.url} (${p.imagesWithoutAlt})`));
  if (!home.viewport) add('High', 'Mobile', 'Home page has no mobile viewport', 'Phones show the desktop layout zoomed out.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
  const noCanon = pages.filter((p) => !p.canonical);
  if (noCanon.length > pages.length / 2) add('Low', 'On-page', 'Most pages have no canonical tag', 'Canonical tags stop duplicate addresses (with and without slash, tracking parameters) competing.', 'Let the SEO plugin output a self-referencing canonical on every page.', noCanon.map((p) => p.url));

  // Local signals
  if (terms && !home.serviceInTitle && !(site.service?.serviceInTitle)) add('High', 'Local relevance', `No page title mentions "${terms.phrase}"`, 'Neither the home page nor a service page targets the search.', `Create or retitle a page for "${terms.phrase}${terms.city[0] ? ` in ${terms.city[0]}` : ''}".`);
  else if (terms && !home.serviceInTitle && site.service?.serviceInTitle) add('Medium', 'Local relevance', `Home page is not about "${terms.phrase}"`, `Home title: "${home.title}". Your page "${site.service.title}" targets it, but the Business Profile usually links to the home page.`, 'Link the Business Profile website field to that service page, or mention the service in the home title and H1.', [site.service.url]);
  if (!pages.some((p) => p.localSchema)) add('Medium', 'Local relevance', 'No LocalBusiness schema', 'Structured data spells out the business name, address and phone for Google.', 'Add LocalBusiness or ProfessionalService JSON-LD matching the Business Profile exactly.');
  else if (!pages.some((p) => p.schemaLocality)) add('Low', 'Local relevance', 'Business schema has no address', 'The schema exists but does not say where the business is.', 'Add the full postal address (addressLocality, postalCode) to the schema.');
  const gbpPhone = phoneKey(business.phone);
  const sitePhones = new Set(pages.flatMap((p) => p.phones || []));
  if (gbpPhone && sitePhones.size && !sitePhones.has(gbpPhone)) add('High', 'Local relevance', 'Phone on Google differs from the website', `Google profile: ${business.phone}. Website shows: ${[...sitePhones].slice(0, 3).join(', ')}.`, 'Use the same main number on the profile, the website header or footer and the schema.');
  if (!pages.some((p) => p.phoneLink)) add('Low', 'Conversion', 'No click-to-call link', 'Mobile visitors cannot tap to call.', 'Link the phone number with tel: in the header.');
  if (!pages.some((p) => p.contactForm)) add('Low', 'Conversion', 'No enquiry form found', 'Checked the pages read for a form with email, phone or message fields.', 'Add a short enquiry form to the contact page and service pages.');
  if (!pages.some((p) => p.mapEmbed)) add('Low', 'Local relevance', 'No Google map on the site', 'An embedded map of the Business Profile ties the site to the listing.', 'Embed your Business Profile map on the contact page.');
  if (!pages.some((p) => p.testimonials)) add('Low', 'Trust', 'No testimonials or reviews shown', 'Social proof on the site helps visitors from the map pack decide.', 'Show a few real Google reviews or client quotes on the home and service pages.');

  return issues.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity]);
}

/** Problems with your Google listing, judged against the competitors found for the same search. */
export function auditProfile(me, rivals, { terms, totalResults, found } = {}) {
  const issues = [];
  const add = (severity, title, detail, fix) => issues.push({ severity, area: 'Google profile', title, detail, fix, urls: [], more: 0 });
  const q = terms?.keyword ? `"${terms.keyword}"` : 'this search';
  if (!found) {
    add('Critical', 'Your Google Business Profile was not found', `It did not appear for ${q}, and no listing matched your name, website or phone.`, 'Check that the profile exists, is verified and not suspended, and that its name, website and phone match your site. Create one at business.google.com if needed.');
    return issues;
  }
  if (me.rank == null) add('Critical', `Not in Google's top ${totalResults || 20} for ${q}`, 'Your listing exists but Google does not show it for this search.', 'Work through the gaps and action plan below, starting with category, services and reviews.');
  else if (me.rank > 3) add('High', `#${me.rank} for ${q}, outside the top 3`, 'The map pack on the results page shows only the first three.', 'Close the High gaps below; reviews and relevance move a listing into the top 3.');
  const avg = (k) => { const v = rivals.map((r) => r[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const avgReviews = avg('reviews'); const avgRating = avg('rating');
  if (me.reviews != null && avgReviews != null && me.reviews < avgReviews * 0.5) add('High', `Only ${me.reviews} reviews; competitors average ${Math.round(avgReviews)}`, 'Review count is one of the strongest prominence signals.', `Aim for about ${Math.round(avgReviews - me.reviews)} more genuine reviews: ask every client, share your review link on WhatsApp, reply to every review.`);
  else if (me.reviews != null && me.reviews < 20) add('Medium', `Only ${me.reviews} reviews`, 'Under 20 reviews looks thin to searchers.', 'Ask every finished client for a review.');
  if (me.rating != null && me.rating < 4) add('High', `Rating ${me.rating}`, 'Many searchers skip listings under 4 stars.', 'Fix the service issues behind low reviews and reply to each one calmly.');
  else if (me.rating != null && avgRating != null && avgRating - me.rating >= 0.3) add('Medium', `Rating ${me.rating}; competitors average ${avgRating.toFixed(1)}`, 'A lower rating loses clicks in the map pack.', 'Reply to negative reviews and ask happy clients for reviews.');
  if (me.lastReviewDays != null && me.lastReviewDays > 60) add('Medium', `Newest review is ${me.lastReviewDays} days old`, 'Recent reviews show Google the business is active.', 'Get new reviews every week, not in bursts.');
  if (!me.hours) add('Medium', 'No opening hours on the profile', 'Google favours businesses it knows are open at the time of the search.', 'Add regular hours and special hours for holidays.');
  if (!me.website) add('High', 'No website linked on the profile', 'Google cannot use your site to judge relevance.', 'Add your website in Business Profile → Edit profile → Contact.');
  if (!me.phone) add('Medium', 'No phone number on the profile', 'Searchers cannot call from the map pack.', 'Add your main number, the same one as on the website.');
  const svc = terms?.service || [];
  const matches = (c) => svc.length > 0 && svc.every((w) => String(c || '').toLowerCase().includes(w));
  if (me.category && !matches(me.category) && rivals.some((r) => matches(r.category))) {
    const theirs = rivals.find((r) => matches(r.category)).category;
    add('High', `Primary category "${me.category}" does not match the search`, `A competitor uses "${theirs}".`, `If "${theirs}" describes your main service, make it your primary category and keep "${me.category}" as an additional one.`);
  }
  return issues;
}

function groupDupes(pages, key) {
  const by = new Map();
  for (const p of pages) { const v = (p[key] || '').trim().toLowerCase(); if (v) by.set(v, [...(by.get(v) || []), p]); }
  return [...by.values()].filter((g) => g.length > 1).flat();
}
