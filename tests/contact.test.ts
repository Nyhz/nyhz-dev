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
