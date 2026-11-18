const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const store = require('./appStore');
const otp = require('./smsOtp');

const DRAFT_DIR = path.join(__dirname, 'data', 'drafts');
const PUBLIC_PLAN_DIR = path.join(__dirname, '..', 'assets', 'plans');

const uploadDraft = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const name = String(file.originalname || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime.startsWith('text/') || mime === 'application/pdf' || mime === 'application/x-pdf' || name.endsWith('.txt') || name.endsWith('.pdf');
    cb(ok ? null : new Error('فقط فایل متنی، PDF یا عکس'), ok);
  },
});

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function normalizePhone(raw) {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  let digits = String(raw || '').replace(/[۰-۹]/g, (d) => String(persian.indexOf(d))).replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('9') && digits.length === 10) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : '';
}

function findUser(data, phone, email) {
  const users = Object.values(data.users || {});
  if (phone) {
    const byPhone = users.find((user) => String(user.phone || '') === phone);
    if (byPhone) return byPhone;
  }
  if (email && data.users[email]) return data.users[email];
  return null;
}

function authUser(req) {
  const header = String(req.headers.authorization || '');
  const raw = header.startsWith('Bearer ') ? header.slice(7) : req.body?.token || req.query?.token;
  if (!raw) return null;
  const data = store.load();
  const session = data.sessions[raw];
  if (!session) return null;
  const user = data.users[session.email];
  if (!user) return null;
  return { data, token: raw, user };
}

function safeExt(name, mime) {
  const ext = path.extname(String(name || '')).toLowerCase();
  const allowed = ['.txt', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  if (allowed.includes(ext)) return ext;
  const kind = String(mime || '').toLowerCase();
  if (kind.startsWith('image/jpeg')) return '.jpg';
  if (kind.startsWith('image/png')) return '.png';
  if (kind.startsWith('image/webp')) return '.webp';
  if (kind.startsWith('image/gif')) return '.gif';
  if (kind === 'application/pdf' || kind === 'application/x-pdf') return '.pdf';
  if (kind.startsWith('text/')) return '.txt';
  return '';
}

function draftPath(file) {
  const base = path.basename(String(file || ''));
  if (!base || base !== String(file || '')) return null;
  const full = path.join(DRAFT_DIR, base);
  if (!full.startsWith(DRAFT_DIR + path.sep)) return null;
  return full;
}

function isPlanLive(coach) {
  return Boolean(coach?.planFile) && coach.planPublished !== false;
}

function publicCoach(coach, data) {
  const live = isPlanLive(coach);
  return {
    id: coach.id,
    name: coach.name,
    title: coach.title || '',
    photo: coach.photo || '',
    rating: coach.rating || null,
    specialty: coach.specialty || '',
    style: coach.style || '',
    audience: coach.audience || '',
    bio: coach.bio || '',
    videos: coach.videos || [],
    planName: live ? (coach.planName || '') : '',
    planFile: live ? coach.planFile : '',
    athleteCount: store.athleteCount(data, coach.id),
    reviews: publicReviews(coach),
  };
}

function publicReviews(coach) {
  const list = Array.isArray(coach?.reviews) ? coach.reviews : [];
  return list.map((item) => ({
    name: String(item.name || 'ورزشکار').slice(0, 80),
    stars: Math.min(5, Math.max(1, Number(item.stars) || 1)),
    text: String(item.text || '').slice(0, 500),
    at: item.at || null,
  })).filter((item) => item.text).reverse();
}

function draftPreview(file) {
  const full = draftPath(file);
  if (!full || !full.endsWith('.txt') || !fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8').slice(0, 20000);
}

function adminCoach(coach) {
  const draft = coach.draft && coach.draft.file ? coach.draft : null;
  return {
    ...publicCoach(coach, { users: {} }),
    athleteCount: undefined,
    live: isPlanLive(coach),
    publishedName: isPlanLive(coach) ? (coach.planName || '') : '',
    draft: draft ? {
      originalName: draft.originalName || '',
      planName: draft.planName || '',
      uploadedAt: draft.uploadedAt || null,
      mime: draft.mime || '',
      preview: draftPreview(draft.file),
    } : null,
  };
}

const SLOT_ORDER = ['breakfast', 'snackAm', 'lunch', 'snackPm', 'dinner', 'snackNight'];
const SLOT_FA = {
  breakfast: 'صبحانه',
  snackAm: 'میان‌وعده ۱',
  lunch: 'ناهار',
  snackPm: 'میان‌وعده ۲',
  dinner: 'شام',
  snackNight: 'قبل خواب',
};

function coachesForViewer(user, data) {
  if (store.isAdmin(user)) return data.coaches || [];
  const email = String(user.email || '').trim().toLowerCase();
  return (data.coaches || []).filter(
    (coach) => String(coach.accountEmail || '').trim().toLowerCase() === email
  );
}

function parseDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekDates(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
  start.setHours(12, 0, 0, 0);
  const keys = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    keys.push(dateKey(day));
  }
  return keys;
}

function rangeDates(fromDate, toDate) {
  const keys = [];
  const cursor = new Date(fromDate);
  cursor.setHours(12, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(12, 0, 0, 0);
  while (cursor <= end && keys.length < 42) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function normalizeName(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[\s\-_/]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک');
}

function namesMatch(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function planOptions(planned) {
  const alts = Array.isArray(planned?.alts) ? planned.alts : String(planned?.alts || '').split(/[,،]/);
  const seen = new Set();
  return [planned?.name, ...alts].filter((name) => {
    const key = normalizeName(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPlanOption(planned, name) {
  return planOptions(planned).some((option) => namesMatch(name, option));
}

function reviewSlot(planned, eaten) {
  const meals = Array.isArray(eaten) ? eaten : [];
  const names = meals.map((meal) => cleanText(meal.nameFa || meal.nameEn || meal.nameAr)).filter(Boolean);
  if (!planned?.name) {
    return {
      status: names.length ? 'extra' : 'none',
      planned: '',
      eaten: names,
    };
  }
  let status = 'substitute';
  if (!names.length) status = 'missed';
  else if (meals.some((meal) => meal.offPlan || meal.source === 'manual' || meal.source === 'scan')) status = 'substitute';
  else if (meals.every((meal) => meal.source === 'confirm' || meal.confirmed)) status = 'followed';
  else if (names.some((name) => isPlanOption(planned, name))) status = 'followed';
  return { status, planned: cleanText(planned.name), eaten: names };
}

function athleteReview(user, dates) {
  const profile = user.profile && typeof user.profile === 'object' ? user.profile : {};
  const name = [profile.firstName || user.name, profile.lastName].filter(Boolean).join(' ').trim() || user.name || user.email;
  const plan = user.bundle?.plan || {};
  const log = user.bundle?.log || {};
  const counts = { followed: 0, substitute: 0, missed: 0, extra: 0 };
  const days = dates.map((date) => {
    const slots = SLOT_ORDER.map((slot) => {
      const result = reviewSlot(plan[date]?.[slot], log[date]?.[slot]);
      if (counts[result.status] != null) counts[result.status] += 1;
      return { slot, label: SLOT_FA[slot], ...result };
    }).filter((slot) => slot.status !== 'none');
    return { date, slots };
  });
  return {
    id: user.id,
    name,
    email: user.email,
    planTaken: Boolean(user.planTaken),
    counts,
    days,
  };
}

function requireAdmin(req, res) {
  const ctx = authUser(req);
  if (!ctx) {
    res.status(401).json({ error: 'وارد شو' });
    return null;
  }
  if (!store.isAdmin(ctx.user)) {
    res.status(403).json({ error: 'فقط ادمین می‌تواند رژیم را بگذارد' });
    return null;
  }
  return ctx;
}

function mountPlatform(app) {
  app.post('/api/auth/register', (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const key = email.includes('@') ? email : (phone ? `${phone}@phone.local` : '');
    const name = String(req.body.name || '').trim() || (phone || key.split('@')[0]);
    const role = req.body.role === 'coach' ? 'coach' : 'athlete';
    if (!phone && !email.includes('@')) return res.status(400).json({ error: 'شماره موبایل را بنویس' });
    if (password.length < 4) return res.status(400).json({ error: 'رمز حداقل ۴ کاراکتر' });
    const data = store.load();
    if (phone && findUser(data, phone, '')) return res.status(409).json({ error: 'این شماره قبلاً ثبت شده' });
    if (email.includes('@') && data.users[email]) return res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده' });
    const { salt, hash } = store.hashPassword(password);
    const user = {
      id: `u-${Date.now()}`,
      email: key,
      phone: phone || '',
      name,
      role,
      salt,
      hash,
      coachId: null,
      planTaken: false,
      subscriptionUntil: null,
      bundle: {},
    };
    data.users[key] = user;
    const tok = token();
    data.sessions[tok] = { email: key, at: Date.now() };
    store.save(data);
    res.json({ token: tok, user: store.publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const data = store.load();
    const user = findUser(data, phone, email);
    if (!user || !store.checkPassword(password, user.salt, user.hash)) {
      return res.status(401).json({ error: 'شماره، ایمیل یا رمز اشتباه است' });
    }
    const tok = token();
    data.sessions[tok] = { email: user.email, at: Date.now() };
    store.save(data);
    res.json({ token: tok, user: store.publicUser(user) });
  });

  app.post('/api/auth/otp/send', async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const mode = req.body.mode === 'signup' ? 'signup' : 'login';
    if (!phone) return res.status(400).json({ error: 'شماره موبایل را بنویس' });
    const data = store.load();
    const existing = findUser(data, phone, '');
    if (mode === 'signup' && existing) return res.status(409).json({ error: 'این شماره قبلاً ثبت شده' });
    if (mode === 'login' && !existing) return res.status(404).json({ error: 'اول ثبت‌نام کن' });
    const result = await otp.issue(phone, req);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.json(result);
  });

  app.post('/api/auth/otp/verify', (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const mode = req.body.mode === 'signup' ? 'signup' : 'login';
    const name = String(req.body.name || '').trim();
    if (!phone) return res.status(400).json({ error: 'شماره موبایل را بنویس' });
    const checked = otp.consume(phone, req.body.code);
    if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });
    const data = store.load();
    let user = findUser(data, phone, '');
    if (mode === 'signup') {
      if (user) return res.status(409).json({ error: 'این شماره قبلاً ثبت شده' });
      const key = `${phone}@phone.local`;
      const { salt, hash } = store.hashPassword(token());
      user = {
        id: `u-${Date.now()}`,
        email: key,
        phone,
        name: name || phone,
        role: 'athlete',
        salt,
        hash,
        coachId: null,
        planTaken: false,
        subscriptionUntil: null,
        bundle: {},
      };
      data.users[key] = user;
    } else if (!user) {
      return res.status(404).json({ error: 'اول ثبت‌نام کن' });
    }
    const tok = token();
    data.sessions[tok] = { email: user.email, at: Date.now() };
    store.save(data);
    res.json({ token: tok, user: store.publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const ctx = authUser(req);
    if (ctx) {
      delete ctx.data.sessions[ctx.token];
      store.save(ctx.data);
    }
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    res.json({ user: store.publicUser(ctx.user) });
  });

  app.post('/api/me/profile', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    const src = req.body && typeof req.body === 'object' ? req.body : {};
    const profile = {
      firstName: String(src.firstName || '').trim(),
      lastName: String(src.lastName || '').trim(),
      birthDate: String(src.birthDate || '').trim(),
      age: (() => {
        const iso = String(src.birthDate || '').trim();
        if (!iso) return String(src.age || '').trim();
        const born = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(born.getTime())) return '';
        const now = new Date();
        let years = now.getFullYear() - born.getFullYear();
        const month = now.getMonth() - born.getMonth();
        if (month < 0 || (month === 0 && now.getDate() < born.getDate())) years -= 1;
        return years >= 0 && years < 120 ? String(years) : '';
      })(),
      gender: String(src.gender || '').trim(),
      marital: String(src.marital || '').trim(),
      city: String(src.city || '').trim(),
      phone: String(src.phone || '').trim(),
      sport: String(src.sport || '').trim(),
      goal: String(src.goal || '').trim(),
      activity: String(src.activity || '').trim(),
      heightCm: String(src.heightCm || '').trim(),
      weightKg: String(src.weightKg || '').trim(),
      experienceYears: String(src.experienceYears || '').trim(),
      injuries: String(src.injuries || '').trim(),
      diabetes: src.diabetes === '1' || src.diabetes === true ? '1' : '',
      highBp: src.highBp === '1' || src.highBp === true ? '1' : '',
      highChol: src.highChol === '1' || src.highChol === true ? '1' : '',
      targetWeight: String(src.targetWeight || '').trim(),
      goalNote: String(src.goalNote || '').trim(),
      startWeight: String(src.startWeight || '').trim(),
      startDate: String(src.startDate || '').trim(),
      progressNote: String(src.progressNote || '').trim(),
      music: Array.isArray(src.music)
        ? src.music.map((item) => (
          typeof item === 'string'
            ? { id: '', name: String(item).trim() }
            : { id: String(item.id || ''), name: String(item.name || '').trim() }
        )).filter((item) => item.name).slice(0, 20)
        : [],
    };
    ctx.user.profile = profile;
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    if (full) ctx.user.name = full;
    store.save(ctx.data);
    res.json({ user: store.publicUser(ctx.user) });
  });

  app.post('/api/subscribe', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    ctx.user.subscriptionUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
    store.save(ctx.data);
    res.json({ user: store.publicUser(ctx.user) });
  });

  app.post('/api/me/coach', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    const coachId = String(req.body.coachId || '');
    const exists = ctx.data.coaches.some((c) => c.id === coachId);
    if (!exists) return res.status(404).json({ error: 'مربی پیدا نشد' });
    ctx.user.coachId = coachId;
    ctx.user.planTaken = true;
    store.save(ctx.data);
    res.json({ user: store.publicUser(ctx.user), athleteCount: store.athleteCount(ctx.data, coachId) });
  });

  app.put('/api/me/bundle', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    ctx.user.bundle = req.body.bundle && typeof req.body.bundle === 'object' ? req.body.bundle : {};
    store.save(ctx.data);
    res.json({ ok: true });
  });

  app.get('/api/me/bundle', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    res.json({ bundle: ctx.user.bundle || {} });
  });

  app.get('/api/coach/review', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'وارد شو' });
    const allowed = coachesForViewer(ctx.user, ctx.data);
    if (!allowed.length) return res.status(403).json({ error: 'این صفحه فقط برای مربی یا ادمین است' });
    const requested = String(req.query.coachId || '');
    const coach = allowed.find((item) => item.id === requested) || allowed[0];
    const from = parseDateKey(req.query.from);
    const to = parseDateKey(req.query.to);
    const date = parseDateKey(req.query.date) || new Date();
    const dates = from && to ? rangeDates(from, to) : weekDates(date);
    const athletes = Object.values(ctx.data.users)
      .filter((user) => user.role !== 'coach' && user.coachId === coach.id)
      .map((user) => athleteReview(user, dates))
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    res.json({
      coach: { id: coach.id, name: coach.name, photo: coach.photo || '' },
      coaches: allowed.map((item) => ({ id: item.id, name: item.name })),
      dates,
      athletes,
    });
  });

  app.get('/api/ads', (_req, res) => {
    res.json({ ads: store.load().ads });
  });

  app.get('/api/coaches', (_req, res) => {
    const data = store.load();
    res.json({
      coaches: data.coaches.map((coach) => publicCoach(coach, data)),
    });
  });

  app.get('/api/coaches/:id', (req, res) => {
    const data = store.load();
    const coach = data.coaches.find((item) => item.id === req.params.id);
    if (!coach) return res.status(404).json({ error: 'مربی پیدا نشد' });
    res.json({ coach: publicCoach(coach, data) });
  });

  app.post('/api/coaches/:id/reviews', (req, res) => {
    const ctx = authUser(req);
    if (!ctx) return res.status(401).json({ error: 'برای ثبت نظر وارد شو' });
    const coach = ctx.data.coaches.find((item) => item.id === req.params.id);
    if (!coach) return res.status(404).json({ error: 'مربی پیدا نشد' });
    const stars = Math.round(Number(req.body?.stars));
    const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (stars < 1 || stars > 5) return res.status(400).json({ error: 'امتیاز را از ۱ تا ۵ انتخاب کن' });
    if (text.length < 2) return res.status(400).json({ error: 'نظر را بنویس' });
    const profile = ctx.user.profile && typeof ctx.user.profile === 'object' ? ctx.user.profile : {};
    const name = [profile.firstName || ctx.user.name, profile.lastName].filter(Boolean).join(' ').trim() || 'ورزشکار';
    if (!Array.isArray(coach.reviews)) coach.reviews = [];
    const mine = coach.reviews.find((item) => item.userId === ctx.user.id);
    const entry = { userId: ctx.user.id, name, stars, text, at: Date.now() };
    if (mine) Object.assign(mine, entry);
    else coach.reviews.push(entry);
    store.save(ctx.data);
    res.json({ reviews: publicReviews(coach) });
  });

  app.get('/api/admin/coaches', (req, res) => {
    const ctx = requireAdmin(req, res);
    if (!ctx) return;
    res.json({
      coaches: ctx.data.coaches.map((coach) => ({
        ...adminCoach(coach),
        athleteCount: store.athleteCount(ctx.data, coach.id),
      })),
    });
  });

  app.post('/api/admin/coaches/:id/draft', uploadDraft.single('file'), (req, res) => {
    const ctx = requireAdmin(req, res);
    if (!ctx) return;
    const coach = ctx.data.coaches.find((item) => item.id === req.params.id);
    if (!coach) return res.status(404).json({ error: 'مربی پیدا نشد' });
    if (!req.file) return res.status(400).json({ error: 'فایل رژیم را انتخاب کن' });
    const ext = safeExt(req.file.originalname, req.file.mimetype);
    if (!ext) return res.status(400).json({ error: 'فقط فایل متنی، PDF یا عکس' });
    const planName = String(req.body.planName || coach.planName || `رژیم ${coach.name}`).trim().slice(0, 80);
    fs.mkdirSync(DRAFT_DIR, { recursive: true });
    if (coach.draft?.file) {
      const old = draftPath(coach.draft.file);
      if (old && fs.existsSync(old)) fs.unlinkSync(old);
    }
    const filename = `${coach.id}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(DRAFT_DIR, filename), req.file.buffer);
    coach.draft = {
      file: filename,
      originalName: path.basename(String(req.file.originalname || 'plan' + ext)).slice(0, 120),
      mime: req.file.mimetype || '',
      planName,
      uploadedAt: Date.now(),
    };
    store.save(ctx.data);
    res.json({
      coach: { ...adminCoach(coach), athleteCount: store.athleteCount(ctx.data, coach.id) },
    });
  });

  app.get('/api/admin/coaches/:id/draft', (req, res) => {
    const ctx = requireAdmin(req, res);
    if (!ctx) return;
    const coach = ctx.data.coaches.find((item) => item.id === req.params.id);
    const full = coach?.draft?.file ? draftPath(coach.draft.file) : null;
    if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'پیش‌نویسی نیست' });
    res.sendFile(full);
  });

  app.post('/api/admin/coaches/:id/publish', (req, res) => {
    const ctx = requireAdmin(req, res);
    if (!ctx) return;
    const coach = ctx.data.coaches.find((item) => item.id === req.params.id);
    if (!coach) return res.status(404).json({ error: 'مربی پیدا نشد' });
    const full = coach.draft?.file ? draftPath(coach.draft.file) : null;
    if (!full || !fs.existsSync(full)) return res.status(400).json({ error: 'اول فایل را برای ممیزی بگذار' });
    const ext = path.extname(full).toLowerCase();
    fs.mkdirSync(PUBLIC_PLAN_DIR, { recursive: true });
    const publicName = `${coach.id}${ext}`;
    fs.copyFileSync(full, path.join(PUBLIC_PLAN_DIR, publicName));
    coach.planFile = `/assets/plans/${publicName}`;
    coach.planName = coach.draft.planName || coach.planName || `رژیم ${coach.name}`;
    coach.planPublished = true;
    store.save(ctx.data);
    res.json({
      coach: { ...adminCoach(coach), athleteCount: store.athleteCount(ctx.data, coach.id) },
    });
  });

  app.post('/api/admin/coaches/:id/unpublish', (req, res) => {
    const ctx = requireAdmin(req, res);
    if (!ctx) return;
    const coach = ctx.data.coaches.find((item) => item.id === req.params.id);
    if (!coach) return res.status(404).json({ error: 'مربی پیدا نشد' });
    coach.planPublished = false;
    store.save(ctx.data);
    res.json({
      coach: { ...adminCoach(coach), athleteCount: store.athleteCount(ctx.data, coach.id) },
    });
  });

  function ratingSummary(data) {
    const ratings = Array.isArray(data.feedback?.ratings) ? data.feedback.ratings : [];
    const count = ratings.length;
    const avg = count
      ? Math.round((ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / count) * 10) / 10
      : 0;
    const reviews = ratings
      .slice()
      .sort((a, b) => b.at - a.at)
      .filter((item) => String(item.text || '').trim())
      .map((item) => ({
        name: item.name || '',
        stars: item.stars,
        text: item.text,
        at: item.at,
      }));
    return { avg, count, reviews };
  }

  app.get('/api/ratings', (_req, res) => {
    res.json(ratingSummary(store.load()));
  });

  app.post('/api/feedback', (req, res) => {
    const kind = req.body?.kind === 'rate' ? 'rate' : 'bug';
    const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 800);
    const page = String(req.body?.page || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    let ctx = authUser(req);
    if (!ctx && kind === 'rate') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const data = store.load();
      const user = email ? data.users[email] : null;
      if (user) ctx = { data, user };
    }
    if (kind === 'rate' && !ctx) return res.status(401).json({ error: 'برای امتیاز وارد شو' });
    if (kind === 'bug' && text.length < 4) return res.status(400).json({ error: 'مشکل را کمی توضیح بده' });
    const stars = Math.round(Number(req.body?.stars));
    if (kind === 'rate' && (stars < 1 || stars > 5)) return res.status(400).json({ error: 'امتیاز را از ۱ تا ۵ انتخاب کن' });
    const data = ctx?.data || store.load();
    if (!data.feedback || typeof data.feedback !== 'object') data.feedback = { bugs: [], ratings: [] };
    if (!Array.isArray(data.feedback.bugs)) data.feedback.bugs = [];
    if (!Array.isArray(data.feedback.ratings)) data.feedback.ratings = [];
    const profile = ctx?.user?.profile && typeof ctx.user.profile === 'object' ? ctx.user.profile : {};
    const name = ctx
      ? ([profile.firstName || ctx.user.name, profile.lastName].filter(Boolean).join(' ').trim() || ctx.user.email)
      : 'مهمان';
    if (kind === 'bug') {
      data.feedback.bugs.push({
        id: `b-${Date.now()}`,
        userId: ctx?.user?.id || '',
        name,
        email: ctx?.user?.email || '',
        text,
        page,
        at: Date.now(),
      });
      data.feedback.bugs = data.feedback.bugs.slice(-200);
    } else {
      const entry = {
        userId: ctx.user.id,
        name,
        email: ctx.user.email,
        stars,
        text,
        at: Date.now(),
      };
      const mine = data.feedback.ratings.find((item) => item.userId === ctx.user.id);
      if (mine) Object.assign(mine, entry);
      else data.feedback.ratings.push(entry);
    }
    store.save(data);
    res.json({ ok: true, ...ratingSummary(data) });
  });

  app.get('/api/admin/feedback', (req, res) => {
    const ctx = requireAdmin(req, res);
    if (!ctx) return;
    const box = ctx.data.feedback && typeof ctx.data.feedback === 'object' ? ctx.data.feedback : {};
    const bugs = Array.isArray(box.bugs) ? box.bugs.slice().reverse() : [];
    const ratings = Array.isArray(box.ratings) ? box.ratings.slice().sort((a, b) => b.at - a.at) : [];
    const avg = ratings.length
      ? Math.round((ratings.reduce((sum, item) => sum + Number(item.stars || 0), 0) / ratings.length) * 10) / 10
      : 0;
    res.json({ bugs, ratings, avg, count: ratings.length });
  });
}

module.exports = { mountPlatform };
