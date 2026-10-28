import { searchTerms } from './terms.js';

// Compares your business with every competitor, factor by factor, and explains the gaps.
// Factors follow Google's own description of local ranking (relevance, distance, prominence) plus the website the profile links to.
// Google does not publish weights, so impact is a plain High / Medium / Low judgement, not a score.

export const IMPACT = { High: 3, Medium: 2, Low: 1 };
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const yearsOf = (s) => { const m = /(\d+)/.exec(String(s || '')); return m ? Number(m[1]) : null; };
const is24h = (h) => /open 24 hours/i.test(h || '');
// The checked home page, or the title and heading typed by hand when the site blocks automated visits.
const home = (b) => (b.site?.ok ? b.site.home : b.site?.manualHome || null);
const hasAny = (text, words) => words.some((w) => String(text || '').toLowerCase().includes(w));
const hasAll = (text, words) => words.length > 0 && words.every((w) => String(text || '').toLowerCase().includes(w));
const yesNo = (v) => (v == null ? '–' : v ? 'Yes' : 'No');
const ms = (v) => (v == null ? '–' : `${(v / 1000).toFixed(1)} s`);
// Compares two booleans: 1 when they have it and you do not, -1 the other way round.
const flag = (t, y) => (t == null || y == null ? null : t && !y ? 1 : !t && y ? -1 : 0);
const more = (t, y, { ratio = 1.15, min = 0 } = {}) => (t == null || y == null ? null : t > Math.max(y * ratio, y + min) ? 1 : y > Math.max(t * ratio, t + min) ? -1 : 0);

// manual: the factor can also be read from a title and heading typed in by hand.
const site = (pick, show = yesNo, { manual = false } = {}) => ({ get: (b) => { const h = home(b); const v = h && (manual || !h.partial) ? pick(h, b) : null; return v === undefined ? null : v; }, show });

export const FACTORS = [
  // Prominence
  { key: 'reviews', group: 'Prominence', label: 'Google reviews', get: (b) => num(b.reviews), show: (v) => (v == null ? '–' : String(v)),
    compare: (t, y) => more(t, y, { min: 3 }),
    impact: (t, y) => (y === 0 || t / Math.max(y, 1) >= 2 ? 'High' : 'Medium'),
    why: (c) => `${c.them} has ${c.t} Google reviews, you have ${c.y}${c.y ? ` (${(c.t / Math.max(c.y, 1)).toFixed(1)}× more)` : ''}. Review count is one of the strongest prominence signals in the local results.`,
    fix: (c) => `Get about ${c.t - c.y + 5} more genuine reviews to pass ${end(c.them)}. Ask every client at hand-over, send your direct review link on WhatsApp and email, and reply to each review. At 10 a month that is about ${Math.ceil((c.t - c.y + 5) / 10)} month(s). Never buy or swap reviews: Google removes them and can suspend the profile.`,
    action: 'Close the review gap' },
  { key: 'rating', group: 'Prominence', label: 'Star rating', get: (b) => num(b.rating), show: (v) => (v == null ? '–' : v.toFixed(1)),
    compare: (t, y) => (t == null || y == null ? null : t - y >= 0.15 ? 1 : y - t >= 0.15 ? -1 : 0),
    impact: (t, y) => (t - y >= 0.4 ? 'High' : t - y >= 0.25 ? 'Medium' : 'Low'),
    why: (c) => `${c.them} is rated ${c.t.toFixed(1)}, you are ${c.y.toFixed(1)}. Searchers compare stars at a glance and Google uses rating alongside review count.`,
    fix: () => 'Reply to every negative review calmly and fix the cause, then ask happy clients for reviews so the average recovers.',
    action: 'Lift the star rating' },
  { key: 'reviews90', group: 'Prominence', label: 'Reviews in last 90 days', get: (b) => num(b.reviews90), show: (v) => (v == null ? '–' : String(v)),
    compare: (t, y) => more(t, y, { min: 2 }), impact: () => 'High',
    why: (c) => `${c.them} got ${c.t} reviews in the last 90 days, you got ${c.y}. Fresh reviews show Google the business is active now.`,
    fix: () => 'Make review requests a routine step for every finished project so new reviews arrive every week, not in bursts.',
    action: 'Get reviews every week' },
  { key: 'photos', group: 'Prominence', label: 'Photos on profile', get: (b) => num(b.photos), show: (v) => (v == null ? '–' : String(v)),
    compare: (t, y) => more(t, y, { ratio: 1.5, min: 10 }), impact: () => 'Low',
    why: (c) => `${c.them} has ${c.t} photos on the profile, you have ${c.y}.`,
    fix: () => 'Add real photos of the office, team and work every month (geo-tagging is not needed).',
    action: 'Add photos regularly' },
  // Relevance
  { key: 'provides', group: 'Relevance', label: '"Provides" match shown by Google', get: (b) => Boolean(b.provides), show: (v, b) => (v ? b.provides : 'Not shown'),
    compare: flag, impact: () => 'High',
    why: (c) => `Google shows "Provides: ${c.tb.provides}" under ${c.them}. It found a match for "${c.keyword}" in their services or website, and shows that line as the reason for listing them. Your listing shows no such line, so Google is less sure you offer "${c.terms.phrase}".`,
    fix: (c) => `In your Business Profile open Edit services and add "${c.terms.phrase}" as a service, plus related services (for example local ${c.terms.phrase}), each with a short description that names ${c.city || 'your city'}. Make sure your website has a page for it too.`,
    action: 'Add the searched service to your Business Profile' },
  { key: 'category', group: 'Relevance', label: 'Primary category', get: (b) => b.category || null, show: (v) => v || '–',
    compare: (t, y, c) => {
      if (!t || !y) return null;
      if (t.toLowerCase() === y.toLowerCase()) return 0;
      const tm = hasAll(t, c.terms.service); const ym = hasAll(y, c.terms.service);
      return tm && !ym ? 1 : ym && !tm ? -1 : 0;
    },
    impact: () => 'High',
    why: (c) => `${c.them}'s primary category "${c.t}" matches "${c.terms.phrase}" more closely than yours, "${c.y}". The primary category is one of the strongest relevance signals.`,
    fix: (c) => `Check whether a category closer to "${c.terms.phrase}" exists in Business Profile and fits your main work. Make it primary only if it is your main service, and keep the others as additional categories.`,
    action: 'Review your primary category' },
  { key: 'hours', group: 'Relevance', label: 'Opening hours', get: (b) => b.hours || null, show: (v) => v || '–',
    compare: (t, y) => (!t || !y ? null : is24h(t) && !is24h(y) ? 1 : !is24h(t) && is24h(y) ? -1 : 0),
    impact: () => 'Medium',
    why: (c) => `${c.them} is listed as open 24 hours, you are listed as "${c.y}". Google favours businesses that are open at the moment of the search, so after your closing time they can move above you.`,
    fix: () => 'Make the hours match when someone really answers calls and enquiries. If the phone is answered late or on Sundays, add those hours. Do not list 24 hours unless it is true: Google treats false hours as a guideline breach.',
    action: 'Set hours that cover when you really answer' },
  { key: 'distance', group: 'Distance', label: 'Distance to searcher (km)', get: (b) => num(b.distanceKm), show: (v) => (v == null ? '–' : `${v} km`),
    compare: (t, y) => (t == null || y == null ? null : y - t >= 1 ? 1 : t - y >= 1 ? -1 : 0), impact: () => 'High',
    why: (c) => `${c.them} is about ${c.t} km from the searcher, you are about ${c.y} km. Distance is one of Google's three local factors.`,
    fix: () => 'Distance cannot be changed. Check that your map pin and address are exact, then win on reviews and relevance, which can outweigh distance.',
    action: 'Make up for distance with reviews and relevance' },
  { key: 'name', group: 'Relevance', label: 'Searched service in business name', get: (b, c) => (b.name ? hasAll(b.name, c.terms.service) : null), show: yesNo,
    compare: flag, impact: () => 'Low',
    why: (c) => `${c.them}'s business name contains "${c.terms.phrase}", which Google counts as relevance.`,
    fix: () => 'Do not add keywords to your business name unless they are part of your real, registered name. Google can suspend profiles for it, and competitors can report it.',
    action: 'Keep the business name honest' },
  { key: 'years', group: 'Trust', label: 'Years in business', get: (b) => yearsOf(b.years), show: (v) => (v == null ? '–' : `${v}+ years`),
    compare: (t, y) => more(t, y, { ratio: 1, min: 2 }), impact: () => 'Low',
    why: (c) => `${c.them} shows ${c.t}+ years in business, you show ${c.y}+.`,
    fix: () => 'Shown to searchers as a trust signal, not a confirmed ranking factor. Make sure your opening date is set in the profile.',
    action: 'Set your opening date' },
  // Website the profile links to
  { key: 'siteOk', group: 'Website', label: 'Website could be checked', get: (b) => (b.website ? Boolean(b.site?.ok) : null), show: (v, b) => (v == null ? 'No URL' : v ? 'Yes' : `No: ${b.site?.error || 'failed'}`),
    // Only your own failure counts: a competitor that blocks automated checks is not a weakness of theirs.
    compare: (t, y) => (t == null || y == null ? null : t && !y ? 1 : 0), impact: () => 'High',
    why: (c) => `${c.them}'s website loads, but yours could not be checked (${c.yb.site?.error || 'it failed to load'}). If Google's crawler has the same problem, your profile loses website relevance.`,
    fix: () => 'Open your website from a phone on mobile data and fix any error, redirect loop or firewall that blocks visitors and crawlers.',
    action: 'Fix your website so it loads for everyone' },
  { key: 'noindex', group: 'Website', label: 'Home page allowed in Google', ...site((h) => !h.noindex),
    compare: flag, impact: () => 'High',
    why: () => 'Your home page has a "noindex" robots tag, which tells Google not to list it.',
    fix: () => 'Remove the noindex tag (in WordPress: Settings → Reading → untick "Discourage search engines").',
    action: 'Remove noindex from your home page' },
  { key: 'serviceInTitle', group: 'Website', label: 'Service in page title', ...site((h) => h.serviceInTitle, yesNo, { manual: true }),
    compare: flag, impact: () => 'High',
    why: (c) => `${c.them}'s home page title mentions "${c.terms.phrase}": "${home(c.tb).title}". Yours is "${home(c.yb).title || '(empty)'}". The page your profile links to is part of how Google judges relevance.`,
    fix: (c) => {
      const svc = c.yb.site?.service;
      if (svc?.serviceInTitle) return `You already have a page for it, "${svc.title}" (${svc.url}), but your home page is about something else. Point the website link in your Business Profile to that page, or add "${c.terms.phrase}" to the home page title and H1 if it is your main service.`;
      return `Rewrite your home page title to lead with the service and city, for example "${cap(c.terms.phrase)} in ${cap(c.city || 'Your City')} | ${c.yb.name.split(/\s[-|–]\s/)[0]}". Keep it under about 60 characters.`;
    },
    action: 'Put the service and city in your page title' },
  { key: 'cityInTitle', group: 'Website', label: 'City in page title', ...site((h) => h.cityInTitle, yesNo, { manual: true }),
    compare: flag, impact: () => 'Medium',
    why: (c) => `${c.them}'s home page title names ${c.city}. Yours does not.`,
    fix: (c) => `Add "${cap(c.city)}" to your home page title.`,
    action: 'Put the service and city in your page title' },
  { key: 'serviceInH1', group: 'Website', label: 'Service in main heading (H1)', ...site((h) => h.serviceInH1, yesNo, { manual: true }),
    compare: flag, impact: () => 'Medium',
    why: (c) => `${c.them}'s main heading is "${home(c.tb).h1[0] || ''}". Yours is "${home(c.yb).h1[0] || '(no H1)'}".`,
    fix: (c) => `Use one H1 on the home page that says what you do and where, for example "${cap(c.terms.phrase)} in ${cap(c.city || 'your city')}".`,
    action: 'Say the service and city in your main heading' },
  { key: 'servicePage', group: 'Website', label: 'Dedicated service page', ...site((h) => Boolean(h.servicePageUrl)),
    compare: flag, impact: () => 'Medium',
    why: (c) => `${c.them} links to a page about "${c.terms.phrase}" (${home(c.tb).servicePageUrl}). Your home page has no link to such a page.`,
    fix: (c) => `Create a page for "${c.terms.phrase}" in ${c.city || 'your city'}: what you do, prices or packages, case studies from local clients, FAQs. Link it from the main menu.`,
    action: 'Build a page for the searched service' },
  { key: 'cityMentions', group: 'Website', label: 'City mentions on home page', ...site((h) => h.cityMentions, (v) => (v == null ? '–' : String(v))),
    compare: (t, y) => more(t, y, { ratio: 2, min: 3 }), impact: () => 'Medium',
    why: (c) => `${c.them}'s home page names ${c.city} ${c.t} times, yours ${c.y} times. That tells Google where the business works.`,
    fix: (c) => `Mention ${cap(c.city || 'your city')} and the areas you serve naturally: in the intro, the services list, the address block and client stories.`,
    action: 'Make your location clear on the website' },
  { key: 'wordCount', group: 'Website', label: 'Words on home page', ...site((h) => h.wordCount, (v) => (v == null ? '–' : String(v))),
    compare: (t, y) => (t == null || y == null ? null : t > y * 1.5 && y < 800 ? 1 : y > t * 1.5 && t < 800 ? -1 : 0), impact: () => 'Low',
    why: (c) => `${c.them}'s home page has about ${c.t} words, yours about ${c.y}. Thin pages give Google less to match.`,
    fix: () => 'Add useful content: services, process, results, FAQs. Write for clients, not word count.',
    action: 'Add useful content to the home page' },
  { key: 'localSchema', group: 'Website', label: 'Business schema markup', ...site((h) => h.localSchema),
    compare: flag, impact: () => 'Medium',
    why: (c) => `${c.them}'s site has structured data (${home(c.tb).schemaTypes.slice(0, 3).join(', ')}) that spells out name, address and phone for Google. Yours has none.`,
    fix: () => 'Add LocalBusiness (or ProfessionalService) JSON-LD with the same name, address and phone as the profile. Most SEO plugins (Rank Math, Yoast) can do this.',
    action: 'Add LocalBusiness schema' },
  { key: 'nap', group: 'Website', label: 'Click-to-call or map on site', ...site((h) => h.phoneLink || h.mapEmbed),
    compare: flag, impact: () => 'Low',
    why: (c) => `${c.them}'s home page has a click-to-call link or an embedded Google map. Yours has neither.`,
    fix: () => 'Add a tel: link for your phone number and embed your Google Business Profile map on the contact page.',
    action: 'Show phone and map on the website' },
  { key: 'https', group: 'Website', label: 'HTTPS', get: (b) => (b.site?.ok ? b.site.https : null), show: yesNo,
    compare: flag, impact: () => 'Medium',
    why: () => 'Your website does not end up on HTTPS. Browsers mark it as not secure.',
    fix: () => 'Install a free SSL certificate (most hosts offer Let\'s Encrypt) and redirect http to https.',
    action: 'Move the website to HTTPS' },
  { key: 'mobile', group: 'Website', label: 'Mobile-friendly viewport', ...site((h) => h.viewport),
    compare: flag, impact: () => 'Medium',
    why: () => 'Your home page has no mobile viewport tag, so phones show it zoomed out. Most local searches are on phones.',
    fix: () => 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and check the layout on a phone.',
    action: 'Make the website mobile-friendly' },
  { key: 'speed', group: 'Website', label: 'Home page response time', get: (b) => (b.site?.ok ? b.site.responseMs : null), show: ms,
    compare: (t, y) => (t == null || y == null ? null : y > 2500 && y - t > 1000 ? 1 : t > 2500 && t - y > 1000 ? -1 : 0), impact: () => 'Low',
    why: (c) => `Your home page took ${ms(c.y)} to arrive, ${c.them}'s ${ms(c.t)} (one measurement from this computer).`,
    fix: () => 'Use caching and a CDN, compress images and remove unused plugins. Check with Google PageSpeed Insights.',
    action: 'Speed up the website' },
  { key: 'testimonials', group: 'Website', label: 'Testimonials on site', ...site((h) => h.testimonials),
    compare: flag, impact: () => 'Low',
    why: (c) => `${c.them}'s home page shows client testimonials or reviews. Yours does not.`,
    fix: () => 'Show a few real Google reviews or client quotes on the home page.',
    action: 'Show testimonials on the website' },
  // Whole-site signals from the sitemap, the pages read and Google PageSpeed
  { key: 'servicePages', group: 'Website', label: 'Pages about the searched service', ...whole((s) => (s.sitemap?.found ? s.sitemap.servicePages : undefined), count),
    compare: (t, y) => more(t, y, { ratio: 2, min: 2 }), impact: () => 'Medium',
    why: (c) => `${c.them}'s sitemap lists ${c.t} pages whose address mentions "${c.terms.phrase}", yours ${c.y}. More focused pages give Google more ways to match the search.`,
    fix: (c) => `Add pages for each variation of "${c.terms.phrase}" you offer (for example local, e-commerce or industry-specific), each with its own content, not copies.`,
    action: 'Build out pages for the searched service' },
  { key: 'cityPages', group: 'Website', label: 'Pages about your city or areas', ...whole((s) => (s.sitemap?.found ? s.sitemap.cityPages : undefined), count),
    compare: (t, y) => more(t, y, { ratio: 2, min: 3 }), impact: () => 'Medium',
    why: (c) => `${c.them} has ${c.t} pages whose address names ${c.city}, you have ${c.y}.`,
    fix: (c) => `Create useful pages for ${c.city || 'your city'} and the neighbourhoods you serve, with local projects and clients. Avoid near-identical "doorway" pages.`,
    action: 'Add local area pages' },
  { key: 'blog', group: 'Website', label: 'Blog posts', ...whole((s) => (s.sitemap?.found ? s.sitemap.blogCount : undefined), count),
    compare: (t, y) => more(t, y, { ratio: 2, min: 10 }), impact: () => 'Medium',
    why: (c) => `${c.them} has about ${c.t} blog posts, you have ${c.y}. Regular articles earn links and show expertise.`,
    fix: (c) => `Publish 2–4 helpful posts a month answering what clients in ${c.city || 'your city'} ask about ${c.terms.phrase}, and link them to your service page.`,
    action: 'Publish helpful articles regularly' },
  { key: 'pages', group: 'Website', label: 'Pages in sitemap', ...whole((s) => (s.sitemap?.found ? s.sitemap.urlCount : undefined), count),
    compare: (t, y) => more(t, y, { ratio: 2, min: 30 }), impact: () => 'Low',
    why: (c) => `${c.them}'s sitemap lists ${c.t} pages, yours ${c.y}.`,
    fix: () => 'Grow the site with pages that answer real questions; size alone does not rank, useful coverage does.',
    action: 'Cover more topics on the website' },
  { key: 'sitemap', group: 'Website', label: 'XML sitemap', ...whole((s) => Boolean(s.sitemap?.found)),
    compare: flag, impact: () => 'Low',
    why: () => 'No XML sitemap was found on your site.',
    fix: () => 'Generate a sitemap with your SEO plugin and submit it in Google Search Console.',
    action: 'Add an XML sitemap' },
  { key: 'psi', group: 'Website', label: 'Mobile speed score (Google)', ...whole((s) => (s.speed && !s.speed.error ? s.speed.score : undefined), (v) => (v == null ? '–' : `${v}/100`)),
    compare: (t, y) => (t == null || y == null ? null : t - y >= 15 ? 1 : y - t >= 15 ? -1 : 0), impact: (t, y) => (y < 50 ? 'High' : 'Medium'),
    why: (c) => `Google PageSpeed scores ${c.them}'s home page ${c.t}/100 on mobile, yours ${c.y}/100.`,
    fix: () => 'Compress and lazy-load images, serve WebP, cache pages, remove unused plugins and scripts.',
    action: 'Speed up the website' },
  { key: 'lcp', group: 'Website', label: 'Main content load time (mobile)', ...whole((s) => (s.speed && !s.speed.error ? s.speed.lcpMs : undefined), ms),
    compare: (t, y) => (t == null || y == null ? null : y > 2500 && y - t > 1000 ? 1 : t > 2500 && t - y > 1000 ? -1 : 0), impact: () => 'Medium',
    why: (c) => `Your main content appears after ${ms(c.y)} on mobile, ${c.them}'s after ${ms(c.t)} (Largest Contentful Paint).`,
    fix: () => 'Make the first big image or heading load first: smaller hero image, preload it, no slider at the top.',
    action: 'Speed up the website' },
  { key: 'faq', group: 'Website', label: 'FAQ schema', ...whole((s) => s.pages.some((p) => p.faqSchema)),
    compare: flag, impact: () => 'Low',
    why: (c) => `${c.them} marks up FAQs with schema, which helps Google read questions and answers. Yours has none on the pages read.`,
    fix: () => 'Add an FAQ section with FAQPage schema to your main service page.',
    action: 'Add FAQs with schema' },
  { key: 'form', group: 'Website', label: 'Enquiry form', ...whole((s) => s.pages.some((p) => p.contactForm)),
    compare: flag, impact: () => 'Low',
    why: (c) => `${c.them}'s site has an enquiry form; none was found on yours.`,
    fix: () => 'Add a short enquiry form to the contact and service pages.',
    action: 'Make it easy to enquire' },
  { key: 'whatsapp', group: 'Website', label: 'WhatsApp button', ...whole((s) => s.pages.some((p) => p.whatsapp)),
    compare: flag, impact: () => 'Low',
    why: (c) => `${c.them} offers a WhatsApp link; yours does not.`,
    fix: () => 'Add a WhatsApp chat button (wa.me link) to the site.',
    action: 'Make it easy to enquire' },
  { key: 'social', group: 'Website', label: 'Social profiles linked', ...whole((s) => Math.max(0, ...s.pages.map((p) => p.socialProfiles || 0)), count),
    compare: (t, y) => more(t, y, { ratio: 1, min: 1 }), impact: () => 'Low',
    why: (c) => `${c.them} links ${c.t} social profiles from the site, you link ${c.y}. Consistent profiles help Google tie the brand together.`,
    fix: () => 'Link your active Facebook, Instagram, LinkedIn and YouTube profiles in the footer and in the schema sameAs field.',
    action: 'Link your social profiles' },
  // From the Google listing (automatic mode)
  { key: 'lastReview', group: 'Prominence', label: 'Newest review shown by Google', get: (b) => num(b.lastReviewDays), show: (v) => (v == null ? '–' : v === 0 ? 'today' : `${v} days ago`),
    compare: (t, y) => (t == null || y == null ? null : y - t >= 30 ? 1 : t - y >= 30 ? -1 : 0), impact: () => 'Medium',
    why: (c) => `${c.them}'s newest review is ${c.t} days old, yours ${c.y} days. Recent reviews show Google the business is active now.`,
    fix: () => 'Ask for a review after every finished job so new reviews arrive each week.',
    action: 'Get reviews every week' },
  { key: 'profileWebsite', group: 'Relevance', label: 'Website linked on Google profile', get: (b) => (b.source === 'google_places' ? Boolean(b.profileWebsite) : null), show: yesNo,
    compare: flag, impact: () => 'High',
    why: () => 'Your Google Business Profile has no website link, so Google cannot use your site to judge relevance.',
    fix: () => 'Add your website in Business Profile → Edit profile → Contact → Website.',
    action: 'Link your website on the Business Profile' },
];

// Reads a whole-site signal (sitemap, all pages read, PageSpeed) from a checked website.
function whole(pick, show = yesNo) { return { get: (b) => { if (!b.site?.ok) return null; const v = pick({ pages: [b.site.home].filter(Boolean), ...b.site }, b); return v === undefined ? null : v; }, show }; }
function count(v) { return v == null ? '–' : String(v); }

// Names such as "Pvt. Ltd." already end in a full stop.
const end = (s) => String(s || '').replace(/\.$/, '');
const cap = (s) => String(s || '').replace(/\b\w/g, (m) => m.toUpperCase());

function ownWarnings(me, terms) {
  const w = [];
  if (/\s[-|–:]\s|,/.test(me.name || '') && hasAny(me.name.split(/\s[-|–:]\s|,/).slice(1).join(' '), [...terms.service, 'digital', 'marketing', 'agency', 'seo', ...terms.city])) {
    w.push({ title: 'Your business name may contain extra keywords', detail: `"${me.name}" looks like a name plus a description. If the part after the dash is not in your registered name, Google can suspend the profile when a competitor reports it. Keep only the real name.` });
  }
  if (!me.website) w.push({ title: 'No website given for your business', detail: 'The website check was skipped. Add the URL your Business Profile links to.' });
  if (me.rating != null && me.rating < 4) w.push({ title: 'Rating below 4.0', detail: 'Many searchers skip listings under 4 stars. Work on service issues and reply to every review.' });
  return w;
}

/**
 * @param {{ keyword: string, city?: string, businesses: object[], mineIndex: number }} input
 * businesses carry the fields from the results table plus `site` (the checkSite result or { ok: false, error }).
 */
export function analyse({ keyword, city, businesses, mineIndex, compareAll = false }) {
  const terms = searchTerms(keyword, city);
  const ctxBase = { keyword: terms.keyword, terms, city: terms.city[0] || '' };
  const me = businesses[mineIndex];
  if (!me) throw new Error('Choose which business is yours');

  // Ads bought their position, so they are left out of the comparison.
  const shown = businesses.map((b, i) => ({ b, i })).filter(({ b, i }) => !b.sponsored || i === mineIndex);
  const matrix = FACTORS.map((f) => {
    const vals = businesses.map((b) => f.get(b, ctxBase));
    if (shown.every(({ i }) => vals[i] == null)) return null;
    return {
      key: f.key, group: f.group, label: f.label,
      cells: shown.map(({ b, i }) => ({ text: f.show(vals[i], b), state: i === mineIndex ? 'mine' : stateOf(f.compare(vals[i], vals[mineIndex], ctxBase)) })),
    };
  }).filter(Boolean);

  const organic = businesses.map((b, i) => ({ b, i })).filter(({ b }) => !b.sponsored);
  const myRank = me.sponsored ? null : me.rank ?? null;
  // A competitor without a known position is compared anyway: you added it for a reason.
  const above = organic.filter(({ i, b }) => i !== mineIndex && (myRank == null || b.rank == null || b.rank < myRank));
  // When you are first, compare with the ones right behind you so you know what to defend.
  // compareAll (automatic mode): every competitor found gets its gaps, those above you first.
  const others = organic.filter(({ i }) => i !== mineIndex);
  const targets = compareAll ? [...above, ...others.filter((o) => !above.includes(o))] : above.length ? above : others;

  const competitors = targets.map(({ b, i }) => {
    const gaps = []; const strengths = [];
    for (const f of FACTORS) {
      const t = f.get(b, ctxBase); const y = f.get(me, ctxBase);
      const r = f.compare(t, y, ctxBase);
      if (r == null || r === 0) continue;
      const c = { ...ctxBase, them: b.name, t, y, tb: b, yb: me };
      if (r > 0) gaps.push({ key: f.key, group: f.group, label: f.label, impact: f.impact(t, y), theirs: f.show(t, b), yours: f.show(y, me), why: f.why(c), fix: f.fix(c), action: f.action });
      else strengths.push({ key: f.key, label: f.label, theirs: f.show(t, b), yours: f.show(y, me) });
    }
    gaps.sort((a, z) => IMPACT[z.impact] - IMPACT[a.impact]);
    return { index: i, name: b.name, rank: b.rank, gaps, strengths, siteError: b.website && !b.site?.ok ? b.site?.error : null };
  });

  // One action per factor, ranked by impact and by how many of the businesses above you beat you on it.
  const byKey = new Map();
  for (const c of competitors) for (const g of c.gaps) {
    const e = byKey.get(g.action) || { action: g.action, impact: g.impact, fix: g.fix, group: g.group, against: [] };
    if (IMPACT[g.impact] > IMPACT[e.impact]) { e.impact = g.impact; e.fix = g.fix; }
    e.against.push(c.name); byKey.set(g.action, e);
  }
  const plan = [...byKey.values()].sort((a, z) => IMPACT[z.impact] - IMPACT[a.impact] || z.against.length - a.against.length);

  const ads = businesses.filter((b) => b.sponsored).length;
  return {
    keyword: terms.keyword, city: ctxBase.city, generatedAt: new Date().toISOString(),
    mine: { index: mineIndex, name: me.name, rank: myRank, sponsored: Boolean(me.sponsored) },
    organicCount: organic.length, ads, comparingAbove: above.length > 0,
    businesses: shown.map(({ b, i }) => ({ index: i, name: b.name, rank: b.rank, sponsored: Boolean(b.sponsored), website: b.website || '', siteError: b.website && !b.site?.ok ? b.site?.error || 'failed' : null })),
    matrix, competitors, plan, warnings: ownWarnings(me, terms),
  };
}

// Seen from your side: 'ahead' means that business beats you on the factor.
function stateOf(r) { return r == null ? 'na' : r > 0 ? 'ahead' : r < 0 ? 'behind' : 'same'; }
