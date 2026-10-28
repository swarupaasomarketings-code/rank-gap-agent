import dns from 'node:dns/promises';
import net from 'node:net';
// A user-facing error: the message is shown as is.
export class FetchError extends Error {}

// Blocks private, loopback, link-local, CGNAT, multicast and metadata ranges.
export function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('ff')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return a === 10 || a === 127 || a === 0 || a >= 224
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}

export async function assertPublicUrl(rawUrl, { lookup = dns.lookup } = {}) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new FetchError('Invalid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new FetchError('Only http(s) URLs are allowed');
  if (u.username || u.password) throw new FetchError('URLs with credentials are not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new FetchError('Local hostnames are not allowed');
  let addrs;
  try { addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }); } catch (e) {
    throw new FetchError(`Could not resolve "${host}" (${e.code || 'DNS lookup failed'}). Check the address and try again.`);
  }
  if (!addrs.length) throw new FetchError('Host did not resolve');
  for (const a of addrs) if (isPrivateIp(a.address)) throw new FetchError('URL resolves to a private or reserved network address');
  return u;
}

/**
 * Fetch for untrusted URLs (crawling, link verification). Re-validates every redirect hop,
 * caps the body size and time, and never forwards credentials.
 */
export async function safeFetch(rawUrl, { maxRedirects = 5, timeoutMs = 15000, maxBytes = 2_000_000, method = 'GET', headers = {}, lookup, userAgent = 'Mozilla/5.0 (compatible; ASWM-RankGapAgent/1.0)' } = {}) {
  const redirects = [];
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current, { lookup });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(current, { method, redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5', ...headers } });
    } finally { clearTimeout(timer); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location'), current).toString();
      redirects.push({ from: current, to: next, status: res.status });
      current = next; continue;
    }
    let body = '';
    let bytes = 0;
    let truncated = false;
    if (method !== 'HEAD' && res.body) {
      const reader = res.body.getReader();
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > maxBytes) { truncated = true; await reader.cancel(); break; }
        chunks.push(value);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    return { status: res.status, url: current, redirects, headers: res.headers, body, bytes, truncated, contentType: res.headers.get('content-type') || '' };
  }
  throw new FetchError(`Exceeded ${maxRedirects} redirects`);
}
