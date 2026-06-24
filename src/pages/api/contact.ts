// src/pages/api/contact.ts
import type { APIRoute } from 'astro';
import { validateContact, sendViaResend } from '../../scripts/contact';

// Server-rendered: the rest of the site stays static (only this route uses the node adapter).
export const prerender = false;

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid request' }, 400);
  }

  const result = validateContact(body);
  if (!result.ok) return json({ error: result.error }, 400);
  if (result.drop) return json({ ok: true }, 200); // honeypot: pretend success, send nothing

  // Runtime secrets — read from process.env (node standalone adapter), not build-time inlined.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM;
  const to = process.env.CONTACT_TO;
  if (!apiKey || !from || !to) return json({ error: 'contact is not configured' }, 500);

  const sent = await sendViaResend(result.data, { apiKey, from, to });
  if (!sent.ok) return json({ error: sent.error }, 502);
  return json({ ok: true }, 200);
};
