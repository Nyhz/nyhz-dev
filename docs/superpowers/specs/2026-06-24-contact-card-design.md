# Contact card — "available for work" → expanding contact form

**Date:** 2026-06-24
**Status:** Approved (design), pending implementation plan

## Goal

Make the "available for work" indicator an actionable, direct contact channel.
Move it into the hero (right-aligned at the height of the `nyhz` name), give it a
clear clickable affordance, and on click expand it — anchored from the chip — into
a card containing Name / Email / Message fields that send an email via Resend.

## Decisions (from brainstorming)

- **Placement:** chip lives in the hero content (not the fixed `Frame` overlay),
  right-aligned at the vertical height of the `nyhz` name. Visible on mobile.
- **Affordance:** rendered as a `<button>` (action, not navigation). Pill with the
  existing green `live` dot + label; hover/focus brightens the border to `--fg`,
  small lift, and reveals a `↗`/`+` glyph.
- **Animation:** expands anchored from the chip toward the bottom-left, white border
  drawing in as it grows (GSAP). Backdrop (blur + dim) over the page. Fields stagger
  in. Close via Esc / backdrop click / ✕, reverse animation. `prefers-reduced-motion`
  → plain fade, no morph. Mobile: card clamps to `min(92vw, …)`.
- **Backend:** full Resend wiring this iteration.

## Architecture

### Components
- **`Frame.astro`** — remove the `available for work` meta label (`.meta.c`). Bottom-left
  becomes free; keep the clock · © bottom-right.
- **`Hero.astro`** — add a top row: `[ eyebrow + name … contact chip ]`. The chip is a
  `<button>` that opens the contact card.
- **`Contact.astro`** (new) — the chip + card markup, styles, and the open/close +
  submit client script (GSAP timeline). Owns its own DOM and is self-contained.

### Endpoint — `src/pages/api/contact.ts`
- `export const prerender = false` (only this route is server-rendered via the existing
  `@astrojs/node` standalone adapter; `/` stays static).
- `POST` accepting JSON `{ name, email, message, company }` where `company` is a hidden
  honeypot.
- **Validation (server-side):** all required; valid email; `name` ≤ 100, `message` ≤ 5000.
  Honeypot non-empty → silently succeed (drop). Invalid → `400 { error }`.
- **Send:** `fetch('https://api.resend.com/emails')` (no new dependency) with
  `Authorization: Bearer ${RESEND_API_KEY}`, body `{ from, to, reply_to: email, subject, html/text }`.
- **Response:** `200 { ok: true }` on success, `4xx/5xx { error }` otherwise.

### Config (server-only env, never `PUBLIC_`)
- `RESEND_API_KEY` — Resend API key.
- `CONTACT_TO` — recipient (the owner's inbox).
- `CONTACT_FROM` — verified-domain sender (or `onboarding@resend.dev` for testing).
- Document in `.env.example`.

### Frontend submit
- `fetch('/api/contact', { method: 'POST', body: JSON })`.
- States in-card: idle → sending (button disabled) → success (confirmation) / error
  (retryable message). No page reload.

## Data flow
1. User clicks chip → backdrop + card expand (GSAP).
2. User fills Name/Email/Message → submits.
3. Client POSTs JSON to `/api/contact`.
4. Endpoint validates, checks honeypot, calls Resend.
5. Endpoint returns ok/error → card shows success or error state.

## Error handling
- Client-side: required + email-format hints before submit; disable during request;
  show server `error` text on failure with retry.
- Server-side: validation `400`; Resend/transport failure `502`; unexpected `500`.
  Honeypot hit returns success without sending.

## Accessibility
- `<button>` chip (keyboard/focus by default).
- Card is a dialog: focus moves in on open, Esc closes, focus returns to chip on close.
  `aria-expanded` on the chip; labelled fields.
- `prefers-reduced-motion` respected.

## Testing
- Endpoint unit tests (vitest): valid payload → calls Resend (mocked `fetch`) and returns
  ok; missing/invalid fields → 400; honeypot filled → 200 without calling Resend.
- Manual: open/close animation, submit success + error, keyboard/Esc, mobile layout,
  reduced-motion.

## Out of scope
- Rate limiting beyond the honeypot (revisit if spam appears).
- CAPTCHA.
- Persisting messages anywhere other than the email.
