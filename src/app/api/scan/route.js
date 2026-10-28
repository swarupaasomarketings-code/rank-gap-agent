import { scanOwnSite } from '@/lib/discover';

export const runtime = 'nodejs';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Send JSON' }, { status: 400 }); }
  const website = String(body.website || '').trim().slice(0, 300);
  if (!website) return Response.json({ error: 'Enter your website' }, { status: 400 });
  try {
    return Response.json({ ...(await scanOwnSite(website)), serverKey: Boolean(process.env.GOOGLE_API_KEY || process.env.SERPER_API_KEY) });
  } catch (e) {
    return Response.json({ error: e?.name === 'AbortError' ? 'Your website did not answer within 15 seconds.' : e.message }, { status: 400 });
  }
}
