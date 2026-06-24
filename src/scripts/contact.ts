// src/scripts/contact.ts
export type ContactData = { name: string; email: string; message: string };

export type Validated =
  | { ok: false; error: string }
  | { ok: true; drop: true }
  | { ok: true; drop: false; data: ContactData };

export type ResendEnv = { apiKey: string; from: string; to: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function validateContact(input: unknown): Validated {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  // Honeypot: a real user never fills the hidden `company` field.
  if (str(o.company).length > 0) return { ok: true, drop: true };

  const name = str(o.name);
  const email = str(o.email);
  const message = str(o.message);

  if (!name) return { ok: false, error: 'name is required' };
  if (name.length > 100) return { ok: false, error: 'name is too long' };
  if (!EMAIL.test(email)) return { ok: false, error: 'a valid email is required' };
  if (!message) return { ok: false, error: 'message is required' };
  if (message.length > 5000) return { ok: false, error: 'message is too long' };

  return { ok: true, drop: false, data: { name, email, message } };
}

export async function sendViaResend(
  data: ContactData,
  env: ResendEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.from,
        to: env.to,
        reply_to: data.email,
        subject: `portfolio contact — ${data.name}`,
        text: `From: ${data.name} <${data.email}>\n\n${data.message}`,
      }),
    });
    if (!res.ok) return { ok: false, error: 'email service error' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'email service error' };
  }
}
