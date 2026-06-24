# Contact Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the "available for work" indicator into a clickable chip in the hero that expands into a contact card (Name / Email / Message) which sends email via Resend.

**Architecture:** Pure backend logic (validation + Resend send) lives in `src/scripts/contact.ts` and is unit-tested; a thin Astro API route (`src/pages/api/contact.ts`, `prerender = false`) wraps it. The UI is a self-contained `Contact.astro` (chip + fixed-position card + GSAP open/close + submit), placed in the hero next to the name. The label is removed from the fixed `Frame`.

**Tech Stack:** Astro 7, `@astrojs/node` (standalone) adapter, GSAP, Resend HTTP API via `fetch` (no new dependency), vitest.

## Global Constraints

- Logic that can be a pure function goes in `src/scripts/` and is tested in `tests/*.test.ts` (vitest, `environment: 'node'`). UI/animation is verified manually.
- No new npm dependencies — call the Resend REST API with `fetch`.
- Secrets are server-only: `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`. Never prefixed `PUBLIC_`; never sent to the client.
- GSAP import style: `import { gsap } from 'gsap';` inside the component `<script>`.
- Honor `prefers-reduced-motion: reduce` (no morph; plain fade).
- Email regex used everywhere: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Limits: `name` ≤ 100 chars, `message` ≤ 5000 chars.
- Copy/labels are lowercase to match the site (`available for work`, `name`, `email`, `message`, `send`).

---

### Task 1: Backend logic — validate + Resend send (pure, TDD)

**Files:**
- Create: `src/scripts/contact.ts`
- Test: `tests/contact.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ContactData = { name: string; email: string; message: string }`
  - `type Validated = { ok: false; error: string } | { ok: true; drop: true } | { ok: true; drop: false; data: ContactData }`
  - `validateContact(input: unknown): Validated`
  - `type ResendEnv = { apiKey: string; from: string; to: string }`
  - `sendViaResend(data: ContactData, env: ResendEnv, fetchImpl?: typeof fetch): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing tests**

Create `tests/contact.test.ts`:

```ts
// tests/contact.test.ts
import { describe, it, expect, vi } from 'vitest';
import { validateContact, sendViaResend } from '../src/scripts/contact';

const valid = { name: 'Ada', email: 'ada@example.com', message: 'hello there' };

describe('validateContact', () => {
  it('accepts a valid payload', () => {
    const r = validateContact(valid);
    expect(r).toEqual({ ok: true, drop: false, data: valid });
  });
  it('trims fields', () => {
    const r = validateContact({ name: '  Ada  ', email: 'ada@example.com', message: '  hi  ' });
    expect(r).toEqual({ ok: true, drop: false, data: { name: 'Ada', email: 'ada@example.com', message: 'hi' } });
  });
  it('drops when the honeypot is filled', () => {
    const r = validateContact({ ...valid, company: 'bot inc' });
    expect(r).toEqual({ ok: true, drop: true });
  });
  it('rejects a missing name', () => {
    expect(validateContact({ ...valid, name: '   ' })).toEqual({ ok: false, error: 'name is required' });
  });
  it('rejects an invalid email', () => {
    expect(validateContact({ ...valid, email: 'nope' })).toEqual({ ok: false, error: 'a valid email is required' });
  });
  it('rejects a missing message', () => {
    expect(validateContact({ ...valid, message: '' })).toEqual({ ok: false, error: 'message is required' });
  });
  it('rejects an over-long name', () => {
    expect(validateContact({ ...valid, name: 'a'.repeat(101) })).toEqual({ ok: false, error: 'name is too long' });
  });
  it('rejects an over-long message', () => {
    expect(validateContact({ ...valid, message: 'a'.repeat(5001) })).toEqual({ ok: false, error: 'message is too long' });
  });
  it('rejects non-object input', () => {
    expect(validateContact(null)).toEqual({ ok: false, error: 'name is required' });
  });
});

describe('sendViaResend', () => {
  const env = { apiKey: 'k', from: 'me@site.dev', to: 'inbox@site.dev' };
  it('posts to Resend with reply_to set and returns ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const r = await sendViaResend(valid, env, fetchImpl as any);
    expect(r).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer k');
    const body = JSON.parse(init.body);
    expect(body.reply_to).toBe('ada@example.com');
    expect(body.to).toBe('inbox@site.dev');
    expect(body.from).toBe('me@site.dev');
  });
  it('returns an error when Resend responds non-ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    const r = await sendViaResend(valid, env, fetchImpl as any);
    expect(r).toEqual({ ok: false, error: 'email service error' });
  });
  it('returns an error when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'));
    const r = await sendViaResend(valid, env, fetchImpl as any);
    expect(r).toEqual({ ok: false, error: 'email service error' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- contact`
Expected: FAIL — `Cannot find module '../src/scripts/contact'`.

- [ ] **Step 3: Write the implementation**

Create `src/scripts/contact.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- contact`
Expected: PASS (all 12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/contact.ts tests/contact.test.ts
git commit -m "feat(contact): validation + Resend send logic"
```

---

### Task 2: API endpoint + env config

**Files:**
- Create: `src/pages/api/contact.ts`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env` is ignored)

**Interfaces:**
- Consumes: `validateContact`, `sendViaResend`, `ResendEnv` from `src/scripts/contact.ts`.
- Produces: `POST /api/contact` accepting JSON `{ name, email, message, company? }`, returning `{ ok: true }` (200) or `{ error: string }` (400/500/502).

- [ ] **Step 1: Create the endpoint**

Create `src/pages/api/contact.ts`:

```ts
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
```

- [ ] **Step 2: Create `.env.example`**

Create `.env.example`:

```
# Resend (https://resend.com) — create an API key and a verified sending domain.
# For testing without a domain, use CONTACT_FROM=onboarding@resend.dev
# (it only delivers to the email of your own Resend account).
RESEND_API_KEY=
CONTACT_TO=
CONTACT_FROM=onboarding@resend.dev
```

- [ ] **Step 3: Ensure `.env` is git-ignored**

Run: `grep -qx '.env' .gitignore && echo present || printf '\n.env\n' >> .gitignore`
Expected: prints `present`, or appends `.env` to `.gitignore`.

- [ ] **Step 4: Verify the build still succeeds and the route is server-rendered**

Run: `pnpm build`
Expected: build succeeds; output mentions the `/api/contact` route as on-demand/server-rendered (not prerendered).

- [ ] **Step 5: Smoke-test the endpoint manually**

Run (in one terminal): `pnpm preview`
Run (in another): `curl -s -X POST http://localhost:4321/api/contact -H 'Content-Type: application/json' -d '{"name":"","email":"x","message":""}'`
Expected: `{"error":"name is required"}` with HTTP 400. (A valid payload returns `{"error":"contact is not configured"}` 500 until env vars are set — that is correct.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/contact.ts .env.example .gitignore
git commit -m "feat(contact): POST /api/contact endpoint + env config"
```

---

### Task 3: Move the label out of Frame; add the chip in the hero

**Files:**
- Modify: `src/components/Frame.astro` (remove the `available for work` label)
- Create: `src/components/Contact.astro` (chip only for now)
- Modify: `src/components/Hero.astro` (place the chip next to the name)

**Interfaces:**
- Consumes: nothing (chip label is static; recipient is server-side).
- Produces: a `<Contact />` component exporting a `<button class="contact-chip" data-contact-open aria-expanded="false">` rendered right-aligned at the height of the name.

- [ ] **Step 1: Remove the label from the fixed frame**

In `src/components/Frame.astro`, delete this line (line 9):

```html
  <span class="meta c"><i class="live"></i>available for work</span>
```

Also delete the now-unused `.meta.c` and `.live` rules and the `live` keyframes, and remove `.meta.c` from the mobile-hide rule. In the `<style>` block:
- Delete the `.meta.c { ... }` rule (lines 26-27).
- Delete the `.live { ... }` rule and the `@keyframes live { ... }` block (lines 30-32).
- Change `@media (max-width: 520px) { .meta.c, .meta.d { display: none; } }` to `@media (max-width: 520px) { .meta.d { display: none; } }`.
- Delete the now-unused `@media (prefers-reduced-motion: reduce) { .live { animation: none; } }` block (line 34).

(The clock · © `.meta.d` stays in the bottom-right.)

- [ ] **Step 2: Create the chip component**

Create `src/components/Contact.astro`:

```astro
---
// Self-contained: clickable "available for work" chip. The expanding card and
// submit logic are added in later tasks.
---
<button class="contact-chip" type="button" data-contact-open aria-haspopup="dialog" aria-expanded="false">
  <i class="live" aria-hidden="true"></i>
  <span class="lbl">available for work</span>
  <span class="cue" aria-hidden="true">+</span>
</button>

<style>
  .contact-chip {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px;
    background: transparent; cursor: pointer; color: var(--muted);
    font: 500 0.62rem var(--mono); letter-spacing: 0.16em; text-transform: uppercase;
    transition: color 0.2s, border-color 0.2s, transform 0.2s;
  }
  .contact-chip:hover, .contact-chip:focus-visible { color: var(--fg); border-color: var(--fg); transform: translateY(-1px); }
  .contact-chip:focus-visible { outline: 1px solid var(--fg); outline-offset: 3px; }
  .live { width: 6px; height: 6px; border-radius: 50%; background: #3ad29f; box-shadow: 0 0 8px #3ad29f;
    animation: live 1.6s ease-in-out infinite; }
  .cue { font-size: 0.95em; opacity: 0.6; transition: transform 0.2s, opacity 0.2s; }
  .contact-chip:hover .cue, .contact-chip:focus-visible .cue { opacity: 1; transform: rotate(90deg); }
  @keyframes live { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  @media (prefers-reduced-motion: reduce) {
    .live { animation: none; }
    .contact-chip, .cue { transition: none; }
  }
</style>
```

- [ ] **Step 3: Place the chip next to the name in the hero**

In `src/components/Hero.astro`, add the import at the top of the frontmatter (after line 1 `const { ... } = Astro.props;`):

```astro
import Contact from './Contact.astro';
```

Replace the `<h1 ...>` line (line 13) with a headline row that holds the name and the chip:

```astro
  <div class="hero-headline">
    <h1 class="hero-name" data-text={name}>{name}</h1>
    <Contact />
  </div>
```

Add to the `<style>` block (after the `.hero-block` rule):

```css
  .hero-headline { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .hero-headline .contact-chip { flex-shrink: 0; margin-top: 0.4rem; }
```

- [ ] **Step 4: Verify manually**

Run: `pnpm dev`
Open `http://localhost:4321`. Expected:
- The chip "available for work" (green dot + `+`) appears top-right, aligned with the top of the `nyhz` name.
- It is keyboard-focusable (Tab to it → focus ring) and hovering brightens the border and rotates the `+`.
- The bottom-left of the page frame no longer shows "available for work"; the bottom-right clock · © is unchanged.
- The chip is visible at a narrow width (e.g. 400px) — it does not disappear like the old frame label.

- [ ] **Step 5: Commit**

```bash
git add src/components/Frame.astro src/components/Contact.astro src/components/Hero.astro
git commit -m "feat(contact): clickable available-for-work chip in the hero"
```

---

### Task 4: Expanding card + GSAP open/close animation

**Files:**
- Modify: `src/components/Contact.astro` (add backdrop + card DOM, styles, open/close script)

**Interfaces:**
- Consumes: the `[data-contact-open]` chip from Task 3; `gsap`.
- Produces: a dialog card with `[data-contact-card]`, `[data-contact-backdrop]`, `[data-contact-close]`, fields `[data-field]`, opened/closed by the chip. Form posts in Task 5.

- [ ] **Step 1: Add the backdrop + card markup**

In `src/components/Contact.astro`, immediately after the closing `</button>` of the chip, add:

```astro
<div class="contact-backdrop" data-contact-backdrop hidden></div>
<div class="contact-card" data-contact-card role="dialog" aria-modal="true" aria-label="contact form" hidden>
  <button class="contact-card__close" type="button" data-contact-close aria-label="close">✕</button>
  <p class="contact-card__title" data-field>get in touch</p>
  <form class="contact-form" data-contact-form novalidate>
    <label data-field><span>name</span><input name="name" type="text" maxlength="100" autocomplete="name" required /></label>
    <label data-field><span>email</span><input name="email" type="email" maxlength="200" autocomplete="email" required /></label>
    <label data-field><span>message</span><textarea name="message" maxlength="5000" rows="4" required></textarea></label>
    <input class="hp" name="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <div class="contact-form__foot" data-field>
      <span class="contact-status" data-contact-status role="status" aria-live="polite"></span>
      <button class="contact-send" type="submit">send</button>
    </div>
  </form>
</div>
```

- [ ] **Step 2: Add the card styles**

Append to the `<style>` block in `src/components/Contact.astro`:

```css
  .contact-backdrop { position: fixed; inset: 0; z-index: 8; background: rgba(11,11,11,0.6);
    backdrop-filter: blur(3px); opacity: 0; }
  .contact-card {
    position: fixed; z-index: 9; top: clamp(22px, 7vh, 64px); right: clamp(22px, 2.6vw, 42px);
    width: min(92vw, 360px); transform-origin: top right; overflow: hidden;
    background: var(--bg); border: 1px solid var(--fg); border-radius: 10px;
    padding: 1.4rem; color: var(--fg);
  }
  .contact-card__close { position: absolute; top: 0.7rem; right: 0.8rem; background: transparent;
    border: 0; color: var(--muted); cursor: pointer; font-size: 0.9rem; }
  .contact-card__close:hover { color: var(--fg); }
  .contact-card__title { font: 500 0.66rem var(--mono); letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 1.1rem; }
  .contact-form { display: flex; flex-direction: column; gap: 0.85rem; }
  .contact-form label { display: flex; flex-direction: column; gap: 0.35rem;
    font: 500 0.6rem var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
  .contact-form input, .contact-form textarea {
    background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 0.55rem 0.65rem;
    color: var(--fg); font: 400 0.9rem var(--font); resize: vertical; }
  .contact-form input:focus, .contact-form textarea:focus { outline: none; border-color: var(--fg); }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
  .contact-form__foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 0.2rem; }
  .contact-status { font: 400 0.72rem var(--mono); color: var(--muted); }
  .contact-status[data-state="error"] { color: #ff6b6b; }
  .contact-status[data-state="ok"] { color: #3ad29f; }
  .contact-send { background: var(--fg); color: var(--bg); border: 0; border-radius: 6px;
    padding: 0.5rem 1.1rem; cursor: pointer; font: 500 0.66rem var(--mono); letter-spacing: 0.16em;
    text-transform: uppercase; transition: opacity 0.2s; }
  .contact-send:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 3: Add the open/close script**

Append a `<script>` block to `src/components/Contact.astro`:

```astro
<script>
  import { gsap } from 'gsap';

  const chip = document.querySelector<HTMLButtonElement>('[data-contact-open]');
  const card = document.querySelector<HTMLElement>('[data-contact-card]');
  const backdrop = document.querySelector<HTMLElement>('[data-contact-backdrop]');
  const closeBtn = document.querySelector<HTMLButtonElement>('[data-contact-close]');
  const fields = card ? Array.from(card.querySelectorAll<HTMLElement>('[data-field]')) : [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (chip && card && backdrop && closeBtn) {
    let open = false;

    const show = () => { card.hidden = false; backdrop.hidden = false; };
    const hide = () => { card.hidden = true; backdrop.hidden = true; };

    const tl = gsap.timeline({ paused: true, onReverseComplete: hide });
    if (reduce) {
      tl.set([card, backdrop], { opacity: 1 }).fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    } else {
      // The card already has `border: 1px solid var(--fg)`; the clip-path reveal makes that
      // white border appear to draw in from the top. (Don't tween borderColor — GSAP can't
      // interpolate a CSS `var()` and would just snap it.)
      tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
        .fromTo(card,
          { clipPath: 'inset(0 0 100% 0)', scale: 0.96 },
          { clipPath: 'inset(0 0 0% 0)', scale: 1, duration: 0.45, ease: 'power3.out' }, '<')
        .fromTo(fields, { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.3, ease: 'power2.out' }, '-=0.15');
    }

    const openCard = () => {
      open = true; chip.setAttribute('aria-expanded', 'true'); show();
      tl.play();
      card.querySelector<HTMLElement>('input,textarea')?.focus();
    };
    const closeCard = () => {
      open = false; chip.setAttribute('aria-expanded', 'false');
      tl.reverse();
      chip.focus();
    };

    chip.addEventListener('click', () => (open ? closeCard() : openCard()));
    closeBtn.addEventListener('click', closeCard);
    backdrop.addEventListener('click', closeCard);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeCard(); });
  }
</script>
```

- [ ] **Step 4: Verify manually**

Run: `pnpm dev`
Open `http://localhost:4321`. Expected:
- Clicking the chip dims/blurs the page and the card grows from the top-right with its white border drawing in; fields stagger in.
- The first input is focused on open.
- Clicking ✕, clicking the backdrop, or pressing Esc reverses the animation and hides the card; focus returns to the chip.
- At a narrow width the card is ~92vw and does not overflow the viewport.
- With OS "reduce motion" on, the card just fades in (no morph).

- [ ] **Step 5: Commit**

```bash
git add src/components/Contact.astro
git commit -m "feat(contact): expanding card with GSAP open/close"
```

---

### Task 5: Wire the form submit to /api/contact

**Files:**
- Modify: `src/components/Contact.astro` (extend the `<script>` with submit handling)

**Interfaces:**
- Consumes: `[data-contact-form]`, `[data-contact-status]`, the `.contact-send` button, and `POST /api/contact` from Task 2.
- Produces: end-to-end contact submission with idle/sending/success/error states.

- [ ] **Step 1: Add the submit handler**

In the `<script>` block of `src/components/Contact.astro`, inside the `if (chip && card && backdrop && closeBtn) { ... }` block (after the `keydown` listener), add:

```ts
    const form = card.querySelector<HTMLFormElement>('[data-contact-form]');
    const status = card.querySelector<HTMLElement>('[data-contact-status]');
    const sendBtn = card.querySelector<HTMLButtonElement>('.contact-send');

    if (form && status && sendBtn) {
      const setStatus = (msg: string, state: '' | 'ok' | 'error') => {
        status.textContent = msg;
        if (state) status.setAttribute('data-state', state); else status.removeAttribute('data-state');
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        sendBtn.disabled = true;
        setStatus('sending…', '');
        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const out = await res.json().catch(() => ({}));
          if (res.ok) {
            setStatus('sent — thanks!', 'ok');
            form.reset();
          } else {
            setStatus(out.error || 'something went wrong', 'error');
            sendBtn.disabled = false;
          }
        } catch {
          setStatus('network error — try again', 'error');
          sendBtn.disabled = false;
        }
      });
    }
```

- [ ] **Step 2: Verify the validation/error path manually (no env needed)**

Run: `pnpm dev`
Open the card, fill name + a valid email + message, submit. Expected: status shows `sending…` then `something went wrong` / `contact is not configured` (500 because env vars aren't set yet) and the send button re-enables. Submitting with an empty name shows `name is required`.

- [ ] **Step 3: Verify the success path end-to-end (requires env)**

Create `.env` (git-ignored) from `.env.example` with a real `RESEND_API_KEY`, your `CONTACT_TO`, and `CONTACT_FROM` (a verified domain, or `onboarding@resend.dev` to deliver only to your Resend account email). Then:

Run: `pnpm build && pnpm preview`
Open `http://localhost:4321`, submit a valid message. Expected: status shows `sent — thanks!`, the form resets, and the email arrives at `CONTACT_TO` with reply-to set to the address you entered.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS (existing tests + the 12 contact tests from Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/components/Contact.astro
git commit -m "feat(contact): submit form to /api/contact with status states"
```

---

## Self-Review Notes

- **Spec coverage:** placement right-aligned at name height (Task 3) ✓; clickable affordance (Task 3) ✓; anchored expand + border draw + backdrop + stagger + Esc/backdrop/✕ close + reduced-motion (Task 4) ✓; mobile-visible card clamp (Tasks 3-4) ✓; endpoint `prerender=false` + honeypot + validation + Resend via fetch + server-only env (Tasks 1-2) ✓; in-card sending/success/error states (Task 5) ✓; vitest endpoint logic tests (Task 1) ✓.
- **Accessibility:** `<button>` chip with `aria-haspopup`/`aria-expanded`; card `role="dialog" aria-modal`; focus into card on open and back to chip on close; Esc to close.
- **Out of scope (per spec):** rate limiting beyond honeypot, CAPTCHA, message persistence.
