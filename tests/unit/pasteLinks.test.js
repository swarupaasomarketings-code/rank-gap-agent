import { describe, it, expect } from 'vitest';
import { websitesFromHtml, realUrl } from '../../src/lib/pasteLinks.js';
import { parseGoogleResults } from '../../src/lib/parseResults.js';

// Shaped like the HTML a browser puts on the clipboard when the Businesses block is copied (fixture).
const HTML = `<div><span>Sponsored</span><div role="heading">Web Make</div><span>4.7</span><span>(27)</span> · Internet marketing service
<a href="/aclk?sa=l&amp;ai=xyz&amp;adurl=https://webmake.example/">Website</a><a href="/maps/dir/">Directions</a></div>
<div><div role="heading">Digital Piloto Pvt. Ltd.</div><span>4.8</span><span>(104)</span> · Internet marketing service<br>7+ years in business · Ranikuthi<br>Open 24 hours · 070039 41041<br>Provides: Best SEO Company India
<a class="x" href="/url?sa=t&amp;url=https%3A%2F%2Fwww.digitalpiloto.com%2F&amp;usg=abc"><div><span>Website</span></div></a><a href="https://www.google.com/maps/dir/">Directions</a></div>
<div><div role="heading">No Site Agency</div><span>4.5</span><span>(12)</span> · Marketing agency<br>Open · Closes 7 pm</div>
<div><div role="heading">AS Webmarketings - Digital Marketing</div><span>4.9</span><span>(31)</span> · Internet marketing service<br>Open · Closes 11:30 pm · 089729 69179
<a aria-label="Website of AS Webmarketings" href="https://aswebmarketings.com/"><span>Visit</span></a></div>`;

describe('website links from copied Google results', () => {
  const names = ['Web Make', 'Digital Piloto Pvt. Ltd.', 'No Site Agency', 'AS Webmarketings - Digital Marketing'];
  const map = websitesFromHtml(HTML, names);
  it('gives each business the Website link listed under it', () => {
    expect(map.get('Digital Piloto Pvt. Ltd.')).toBe('https://www.digitalpiloto.com/');
    expect(map.get('AS Webmarketings - Digital Marketing')).toBe('https://aswebmarketings.com/');
  });
  it('does not hand a link to a business without one', () => { expect(map.has('No Site Agency')).toBe(false); });
  it('ignores Google links such as directions and ad redirects', () => { expect(map.has('Web Make')).toBe(false); });
  it('unwraps Google redirect links', () => {
    expect(realUrl('/url?q=https://example.com/a&sa=U')).toBe('https://example.com/a');
    expect(realUrl('https://maps.google.com/x')).toBeNull();
  });
  it('the same paste still reads as text', () => {
    const text = HTML.replace(/<br>/g, '\n').replace(/<\/div>/g, '\n').replace(/<[^>]+>/g, '\n');
    const r = parseGoogleResults(text);
    expect(r.map((b) => b.name)).toEqual(names);
  });
});
