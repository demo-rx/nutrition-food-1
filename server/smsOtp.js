const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'otp.json');
const TTL_MS = 5 * 60 * 1000;
const RESEND_MS = 60 * 1000;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (raw && typeof raw === 'object') return raw;
  } catch {
    /* empty */
  }
  return { items: {} };
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function hasSmsProvider() {
  return Boolean(
    String(process.env.KAVENEGAR_API_KEY || '').trim() ||
    String(process.env.SMS_API_URL || '').trim()
  );
}

function hashCode(phone, code) {
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

function makeCode() {
  return String(crypto.randomInt(10000, 100000));
}

function originHost(req) {
  const host = String(req?.headers?.host || 'localhost').split(':')[0];
  return host || 'localhost';
}

async function sendSms(phone, code, req) {
  const message = `کد ورود Healthy Nutrition Plan: ${code}\n\n@${originHost(req)} #${code}`;
  const kave = String(process.env.KAVENEGAR_API_KEY || '').trim();
  if (kave) {
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(kave)}/sms/send.json`;
    const body = new URLSearchParams({ receptor: phone, message });
    const res = await fetch(url, { method: 'POST', body });
    if (!res.ok) throw new Error('ارسال پیامک انجام نشد');
    return true;
  }
  const hook = String(process.env.SMS_API_URL || '').trim();
  if (hook) {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, code }),
    });
    if (!res.ok) throw new Error('ارسال پیامک انجام نشد');
    return true;
  }
  console.log(`[otp] ${phone} → ${code}`);
  return false;
}

async function issue(phone, req) {
  const data = load();
  const prev = data.items[phone];
  if (prev?.sentAt && Date.now() - prev.sentAt < RESEND_MS) {
    const wait = Math.ceil((RESEND_MS - (Date.now() - prev.sentAt)) / 1000);
    return { error: `تا ${wait} ثانیه دیگر صبر کن`, status: 429 };
  }
  const code = makeCode();
  data.items[phone] = {
    hash: hashCode(phone, code),
    exp: Date.now() + TTL_MS,
    tries: 0,
    sentAt: Date.now(),
  };
  save(data);
  let sent = false;
  try {
    sent = await sendSms(phone, code, req);
  } catch (err) {
    return { error: err.message || 'ارسال پیامک انجام نشد', status: 502 };
  }
  const out = { ok: true, sent, ttl: 300 };
  if (!hasSmsProvider()) out.devCode = code;
  return out;
}

function consume(phone, code) {
  const digits = String(code || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '');
  const data = load();
  const row = data.items[phone];
  if (!row) return { error: 'اول کد را بگیر', status: 400 };
  if (Date.now() > row.exp) {
    delete data.items[phone];
    save(data);
    return { error: 'کد منقضی شد', status: 400 };
  }
  row.tries = (row.tries || 0) + 1;
  if (row.tries > 5) {
    delete data.items[phone];
    save(data);
    return { error: 'کد باطل شد. دوباره بگیر', status: 400 };
  }
  if (row.hash !== hashCode(phone, digits)) {
    save(data);
    return { error: 'کد اشتباه است', status: 401 };
  }
  delete data.items[phone];
  save(data);
  return { ok: true };
}

module.exports = { issue, consume, hasSmsProvider };
