/* Demo account layer — localStorage only, no server, not a real auth system. */

const HNP = (() => {
  const USERS_KEY = 'hnp-users';
  const SESSION_KEY = 'hnp-session';
  const PENDING_KEY = 'hnp-pending-scan';
  const LOG_KEY = 'hnp-meal-log';
  const PLAN_KEY = 'hnp-coach-plan';
  const WEEK_TEMPLATE_KEY = 'hnp-coach-week';
  const ROLE_KEY = 'hnp-role';

  const SLOT_ORDER = ['breakfast', 'snackAm', 'lunch', 'snackPm', 'dinner', 'snackNight'];

  const SLOTS = {
    breakfast: { fa: 'صبحانه', en: 'Breakfast' },
    snackAm: { fa: 'میان‌وعده ۱', en: 'Snack 1' },
    lunch: { fa: 'ناهار', en: 'Lunch' },
    snackPm: { fa: 'میان‌وعده ۲', en: 'Snack 2' },
    dinner: { fa: 'شام', en: 'Dinner' },
    snackNight: { fa: 'قبل خواب', en: 'Before sleep' },
  };

  function scope() {
    const session = readJsonRaw(SESSION_KEY, null);
    return session?.id || session?.email || 'guest';
  }

  function sk(key) {
    return `${key}::${scope()}`;
  }

  function readJsonRaw(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getUsers() {
    return readJson(USERS_KEY, {});
  }

  function saveUsers(users) {
    writeJson(USERS_KEY, users);
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function normalizePhone(raw) {
    const digits = String(raw || '')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\D/g, '');
    let phone = digits;
    if (phone.startsWith('98') && phone.length === 12) phone = `0${phone.slice(2)}`;
    if (phone.startsWith('9') && phone.length === 10) phone = `0${phone}`;
    return /^09\d{9}$/.test(phone) ? phone : '';
  }

  function getSession() {
    return readJsonRaw(SESSION_KEY, null);
  }

  function currentUser() {
    const session = getSession();
    if (!session?.email) return null;
    if (session.token) return { ...session };
    const user = getUsers()[session.email];
    return user ? { ...user, email: session.email, id: user.id || session.id } : null;
  }

  function isLoggedIn() {
    return Boolean(currentUser());
  }

  function isPremium() {
    const user = currentUser();
    if (user?.subscriptionUntil && Number(user.subscriptionUntil) > Date.now()) return true;
    return Boolean(user?.premium);
  }

  function applyServerUser(payload) {
    const user = payload.user;
    writeJson(SESSION_KEY, {
      id: user.id,
      email: user.email,
      phone: user.phone || '',
      name: user.name,
      role: user.role,
      admin: Boolean(user.admin),
      token: payload.token,
      coachId: user.coachId,
      subscriptionUntil: user.subscriptionUntil,
      premium: user.subscribed,
      profile: user.profile || {},
    });
  }

  function displayName(user = currentUser()) {
    if (!user) return 'مهمان';
    const profile = user.profile || {};
    const full = [profile.firstName || user.name, profile.lastName].filter(Boolean).join(' ').trim();
    return full || 'ورزشکار';
  }

  function getProfile() {
    const user = currentUser();
    if (!user) return {};
    const profile = { ...(user.profile || {}) };
    if (!profile.firstName && user.name) {
      const [first, ...rest] = String(user.name).split(/\s+/);
      profile.firstName = first || '';
      if (!profile.lastName) profile.lastName = rest.join(' ');
    }
    return profile;
  }

  async function saveProfile(input) {
    const session = getSession();
    if (!session) throw new Error('اول وارد شو');
    const profile = {
      firstName: String(input.firstName || '').trim(),
      lastName: String(input.lastName || '').trim(),
      birthDate: String(input.birthDate || '').trim(),
      age: (() => {
        const iso = String(input.birthDate || '').trim();
        if (!iso) return String(input.age || '').trim();
        const born = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(born.getTime())) return '';
        const now = new Date();
        let years = now.getFullYear() - born.getFullYear();
        const month = now.getMonth() - born.getMonth();
        if (month < 0 || (month === 0 && now.getDate() < born.getDate())) years -= 1;
        return years >= 0 && years < 120 ? String(years) : '';
      })(),
      gender: String(input.gender || '').trim(),
      marital: String(input.marital || '').trim(),
      city: String(input.city || '').trim(),
      phone: String(input.phone || '').trim(),
      sport: String(input.sport || '').trim(),
      goal: String(input.goal || '').trim(),
      activity: String(input.activity || '').trim(),
      heightCm: String(input.heightCm || '').trim(),
      weightKg: String(input.weightKg || '').trim(),
      experienceYears: String(input.experienceYears || '').trim(),
      injuries: String(input.injuries || '').trim(),
      diabetes: input.diabetes === '1' || input.diabetes === true ? '1' : '',
      highBp: input.highBp === '1' || input.highBp === true ? '1' : '',
      highChol: input.highChol === '1' || input.highChol === true ? '1' : '',
      targetWeight: String(input.targetWeight || '').trim(),
      goalNote: String(input.goalNote || '').trim(),
      startWeight: String(input.startWeight || '').trim(),
      startDate: String(input.startDate || '').trim(),
      progressNote: String(input.progressNote || '').trim(),
      music: Array.isArray(input.music)
        ? input.music.map((item) => (
          typeof item === 'string'
            ? { id: '', name: item.trim() }
            : { id: String(item.id || ''), name: String(item.name || '').trim() }
        )).filter((item) => item.name).slice(0, 20)
        : [],
    };
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    if (session.token) {
      const res = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ذخیره نشد');
      applyServerUser({ token: session.token, user: data.user });
    } else if (session.email) {
      const { users, user } = ensureLocalUser(session.email);
      user.profile = profile;
      if (full) user.name = full;
      users[session.email] = user;
      saveUsers(users);
      writeJson(SESSION_KEY, { ...session, name: full || session.name, profile });
    }
    if (profile.heightCm && profile.weightKg) {
      try { saveBmi(profile.heightCm, profile.weightKg); } catch { /* later */ }
    }
    return currentUser();
  }

  async function pullBundle() {
    const session = getSession();
    if (!session?.token) return;
    try {
      const res = await fetch('/api/me/bundle', { headers: { Authorization: `Bearer ${session.token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const bundle = data.bundle || {};
      if (bundle.log) writeJson(sk(LOG_KEY), bundle.log);
      if (bundle.plan) writeJson(sk(PLAN_KEY), bundle.plan);
      if (bundle.week) writeJson(sk(WEEK_TEMPLATE_KEY), bundle.week);
    } catch {
      /* offline */
    }
  }

  let syncTimer = 0;
  function pushBundle() {
    const session = getSession();
    if (!session?.token) return;
    fetch('/api/me/bundle', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({
        bundle: {
          log: readJson(sk(LOG_KEY), {}),
          plan: readJson(sk(PLAN_KEY), {}),
          week: readJson(sk(WEEK_TEMPLATE_KEY), null),
        },
      }),
    }).catch(() => {});
  }

  function scheduleSync() {
    const session = getSession();
    if (!session?.token) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = 0;
      pushBundle();
    }, 200);
  }

  window.addEventListener('pagehide', () => {
    if (!syncTimer) return;
    clearTimeout(syncTimer);
    syncTimer = 0;
    pushBundle();
  });

  async function registerOrLogin(email, password, name, options) {
    const phone = normalizePhone(options?.phone);
    const key = normalizeEmail(email);
    const mode = options?.mode === 'signup' || options?.mode === 'login' ? options.mode : '';
    if (!phone && (!key || !key.includes('@'))) {
      throw new Error('شماره موبایل یا ایمیل را بنویس.');
    }
    if (!password || String(password).length < 4) {
      throw new Error(typeof I18N !== 'undefined' ? I18N.t('auth.badPass') : 'Password too short.');
    }

    const payload = { email: key, password, name, phone, role: 'athlete' };
    try {
      let res;
      if (mode === 'signup') {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: key, password, phone }),
        });
        if (!mode && res.status === 401) {
          res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.status === 409) {
            throw new Error(typeof I18N !== 'undefined' ? I18N.t('auth.wrong') : 'Wrong password.');
          }
        }
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'login failed');
      applyServerUser(data);
      await pullBundle();
      return { created: mode === 'signup', user: currentUser() };
    } catch (err) {
      if (/ایمیل|رمز|موبایل|شماره/.test(String(err.message || ''))) throw err;
      const localKey = key.includes('@') ? key : (phone ? `${phone}@phone.local` : '');
      if (!localKey) throw err;
      const users = getUsers();
      const existing = users[localKey];
      if (!existing) {
        users[localKey] = {
          id: `local-${localKey}`,
          name: String(name || '').trim() || localKey.split('@')[0],
          password: String(password),
          phone,
          premium: false,
          bmi: null,
          meals: {},
          lastScan: null,
        };
        saveUsers(users);
        writeJson(SESSION_KEY, { id: users[localKey].id, email: localKey, phone });
        return { created: true, user: currentUser() };
      }
      if (existing.password !== String(password)) {
        throw new Error(typeof I18N !== 'undefined' ? I18N.t('auth.wrong') : 'Wrong password.');
      }
      writeJson(SESSION_KEY, { id: existing.id || `local-${localKey}`, email: localKey, phone: existing.phone || phone });
      return { created: false, user: currentUser() };
    }
  }

  async function sendPhoneOtp(phone, mode) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('شماره موبایل را بنویس.');
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, mode: mode === 'signup' ? 'signup' : 'login' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'کد ارسال نشد');
    return data;
  }

  async function verifyPhoneOtp(phone, code, name, mode) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('شماره موبایل را بنویس.');
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: normalized,
        code,
        name,
        mode: mode === 'signup' ? 'signup' : 'login',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'کد اشتباه است');
    applyServerUser(data);
    await pullBundle();
    return { user: currentUser() };
  }

  async function logout() {
    const session = getSession();
    if (session?.token) {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(SESSION_KEY);
  }

  async function upgradePremium() {
    const session = getSession();
    if (!session?.email) throw new Error(typeof I18N !== 'undefined' ? I18N.t('auth.needLogin') : 'Please log in first.');
    if (session.token) {
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'subscribe failed');
      applyServerUser({ token: session.token, user: data.user });
      return;
    }
    const users = getUsers();
    users[session.email].premium = true;
    saveUsers(users);
  }

  function ensureLocalUser(email) {
    const users = getUsers();
    const key = normalizeEmail(email);
    if (!key) return { users, user: null };
    if (!users[key]) {
      const session = getSession();
      users[key] = {
        id: session?.id || `local-${key}`,
        password: '',
        premium: Boolean(session?.premium),
        bmi: null,
        meals: {},
        lastScan: null,
      };
    }
    if (!users[key].meals || typeof users[key].meals !== 'object') users[key].meals = {};
    return { users, user: users[key] };
  }

  function saveBmi(heightCm, weightKg) {
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!h || !w) return;
    const pack = { heightCm: h, weightKg: w };
    try { localStorage.setItem('hnp-bmi-profile', JSON.stringify(pack)); } catch { /* ignore */ }
    writeJson(sk('hnp-bmi-profile'), pack);
    const session = getSession();
    if (!session?.email) return;
    const { users, user } = ensureLocalUser(session.email);
    if (!user) return;
    user.bmi = pack;
    saveUsers(users);
  }

  function saveLastScan(scan) {
    writeJson(sk(PENDING_KEY), {
      scan,
      savedAt: Date.now(),
    });
    const session = getSession();
    if (!session?.email) return;
    const { users, user } = ensureLocalUser(session.email);
    if (!user) return;
    user.lastScan = scan;
    saveUsers(users);
  }

  function getLastScan() {
    const user = currentUser();
    if (user?.lastScan) return user.lastScan;
    return readJson(sk(PENDING_KEY), null)?.scan || null;
  }

  function getPendingScan() {
    return readJson(sk(PENDING_KEY), null);
  }

  function clearPendingSlot() {
    const pending = readJson(sk(PENDING_KEY), null);
    if (!pending) return;
    delete pending.slot;
    writeJson(sk(PENDING_KEY), pending);
  }

  function setPendingSlot(slot) {
    const pending = readJson(sk(PENDING_KEY), null) || {};
    pending.slot = slot;
    pending.savedAt = Date.now();
    writeJson(sk(PENDING_KEY), pending);
  }

  function dateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function guessSlot(date = new Date()) {
    const hour = date.getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 12) return 'snackAm';
    if (hour < 15) return 'lunch';
    if (hour < 18) return 'snackPm';
    if (hour < 21) return 'dinner';
    return 'snackNight';
  }

  function mealFromScan(scan, slot, date) {
    return {
      id: `meal-${Date.now()}`,
      source: 'scan',
      offPlan: true,
      slot,
      date,
      nameFa: scan.foodName?.fa || 'غذا',
      nameEn: scan.foodName?.en || 'Food',
      nameAr: scan.foodName?.ar || '',
      calories: Number(scan.calories) || 0,
      protein: Number(scan.protein) || 0,
      fat: Number(scan.fat) || 0,
      carbs: Number(scan.carbs) || 0,
      sugar: Number(scan.sugar) || 0,
      salt: Number(scan.salt) || 0,
      fiber: Number(scan.fiber) || 0,
      saturatedFat: Number(scan.saturatedFat) || 0,
      components: scan.components || [],
      scan,
    };
  }

  function emptyDay() {
    return Object.fromEntries(SLOT_ORDER.map((slot) => [slot, []]));
  }

  function allMeals(day) {
    return SLOT_ORDER.flatMap((slot) => day[slot] || []);
  }

  function getLog() {
    return readJson(sk(LOG_KEY), {});
  }

  function rememberFood(meal) {
    const name = String(meal?.nameFa || meal?.nameEn || meal?.nameAr || meal?.name || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 2) return;
    const user = currentUser();
    if (!user?.token) return;
    fetch('/api/foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + user.token },
      body: JSON.stringify({
        name,
        calories: meal.calories,
        protein: meal.protein,
        fat: meal.fat,
        sugar: meal.sugar,
        carbs: meal.carbs,
        fiber: meal.fiber,
        salt: meal.salt,
        saturatedFat: meal.saturatedFat,
        grams: meal.grams,
      }),
    }).catch(() => {});
  }

  function addMeal(meal) {
    const log = getLog();
    const day = meal.date;
    if (!log[day]) log[day] = emptyDay();
    if (!log[day][meal.slot]) log[day][meal.slot] = [];
    log[day][meal.slot].push(meal);
    writeJson(sk(LOG_KEY), log);
    scheduleSync();
    rememberFood(meal);

    const session = getSession();
    if (session?.email) {
      const { users, user } = ensureLocalUser(session.email);
      if (user) {
        if (!user.meals[day]) user.meals[day] = emptyDay();
        if (!user.meals[day][meal.slot]) user.meals[day][meal.slot] = [];
        user.meals[day][meal.slot].push(meal);
        if (meal.scan) user.lastScan = meal.scan;
        saveUsers(users);
      }
    }
    return meal;
  }

  function isConfirmMeal(meal) {
    return meal.source === 'confirm' || meal.confirmed;
  }

  function addManualMeal({ date, slot, nameFa, grams, amount, unit, calories, sugar }) {
    const name = nameFa || 'وعده';
    const unitId = unit || 'g';
    const qty = Number(amount) > 0 ? Number(amount) : Number(grams) > 0 ? Number(grams) : 0;
    const g = amountToGrams(name, unitId, qty || servingGrams(name));
    const nut = nutritionForGrams(name, g);
    if (calories !== '' && calories != null && Number.isFinite(Number(calories))) {
      nut.calories = Number(calories);
    }
    if (sugar !== '' && sugar != null && Number.isFinite(Number(sugar))) {
      nut.sugar = Number(sugar);
    }
    return addMeal({
      id: `meal-${Date.now()}`,
      source: 'manual',
      offPlan: true,
      slot,
      date,
      nameFa: name,
      nameEn: name,
      unit: unitId,
      amount: qty || g,
      ...nut,
      grams: g,
      components: [],
    });
  }

  function removeMeal(date, slot, id) {
    const want = String(id || '');
    const log = getLog();
    if (log[date]?.[slot]) {
      log[date][slot] = log[date][slot].filter((item) => String(item.id) !== want);
      writeJson(sk(LOG_KEY), log);
      scheduleSync();
    }
    const session = getSession();
    if (!session?.email) return;
    const users = getUsers();
    const user = users[session.email];
    if (!user?.meals?.[date]?.[slot]) return;
    user.meals[date][slot] = user.meals[date][slot].filter((item) => String(item.id) !== want);
    saveUsers(users);
  }

  function getDayMeals(date) {
    const raw = getLog()[date] || emptyDay();
    const day = emptyDay();
    SLOT_ORDER.forEach((slot) => {
      const list = raw[slot] || [];
      day[slot] = list.map((meal) => {
        if (Number(meal.calories) > 0 && !isConfirmMeal(meal)) return meal;
        if (isConfirmMeal(meal)) {
          const eatenName = meal.nameFa || meal.nameEn || meal.nameAr || '';
          return { ...meal, slot, ...estimateNutrition(eatenName) };
        }
        const eatenName = meal.nameFa || meal.nameEn || meal.nameAr || '';
        return { ...meal, slot, ...estimateNutrition(eatenName) };
      });
    });
    return day;
  }

  function dayTotals(date) {
    const all = allMeals(getDayMeals(date));
    return all.reduce(
      (sum, meal) => {
        sum.calories += Number(meal.calories) || 0;
        sum.sugar += Number(meal.sugar) || 0;
        sum.protein += Number(meal.protein) || 0;
        sum.fat += Number(meal.fat) || 0;
        sum.count += 1;
        return sum;
      },
      { calories: 0, sugar: 0, protein: 0, fat: 0, count: 0 }
    );
  }

  function addDays(date, n) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  function rangeKeys(from, to) {
    const keys = [];
    const cur = new Date(from);
    cur.setHours(12, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 0);
    while (cur <= end) {
      keys.push(dateKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  function periodRange(kind) {
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const start = new Date(end);
    if (kind === 'week') start.setDate(end.getDate() - 6);
    else if (kind === 'month') start.setDate(end.getDate() - 29);
    else if (kind === 'six') start.setMonth(end.getMonth() - 6);
    else start.setFullYear(end.getFullYear() - 1);
    return { start, end };
  }

  function getCalorieTarget() {
    const n = Number(localStorage.getItem('hnp-calorie-target'));
    return n > 800 && n < 6000 ? n : 2000;
  }

  function setCalorieTarget(value) {
    localStorage.setItem('hnp-calorie-target', String(value));
  }

  function rangeReport(kind) {
    const dailyTarget = getCalorieTarget();
    const { start, end } = periodRange(kind);
    const keys = rangeKeys(start, end);
    const days = keys.map((key) => {
      const totals = dayTotals(key);
      const meals = allMeals(getDayMeals(key));
      return { key, meals, ...totals };
    });
    const totals = days.reduce(
      (sum, day) => {
        sum.calories += day.calories;
        sum.sugar += day.sugar;
        sum.protein += day.protein;
        sum.fat += day.fat;
        sum.count += day.count;
        return sum;
      },
      { calories: 0, sugar: 0, protein: 0, fat: 0, count: 0 }
    );
    const dayCount = keys.length;
    const targetTotal = dailyTarget * dayCount;
    const deficit = targetTotal - totals.calories;
    const kg = deficit / 7700;
    return { kind, start, end, days, totals, dayCount, dailyTarget, targetTotal, deficit, kg };
  }

  function getRole() {
    return localStorage.getItem(ROLE_KEY) === 'coach' ? 'coach' : 'athlete';
  }

  function setRole(role) {
    localStorage.setItem(ROLE_KEY, role === 'coach' ? 'coach' : 'athlete');
  }

  function getCoachPlan() {
    return readJson(sk(PLAN_KEY), {});
  }

  function getCoachSlot(date, slot) {
    return getCoachPlan()[date]?.[slot] || null;
  }

  function getDayPlan(date) {
    return getCoachPlan()[date] || {};
  }

  function asNameList(value) {
    const parts = Array.isArray(value) ? value : String(value || '').split(/[,،]/);
    return parts.map((item) => String(item).trim()).filter(Boolean);
  }

  function setCoachSlot(date, slot, { name, alts }) {
    const plan = getCoachPlan();
    if (!plan[date]) plan[date] = {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      delete plan[date][slot];
      if (!Object.keys(plan[date]).length) delete plan[date];
    } else {
      plan[date][slot] = {
        name: cleanName,
        alts: asNameList(alts),
      };
    }
    writeJson(sk(PLAN_KEY), plan);
    scheduleSync();
  }

  function parseDateKey(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function numNut(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
  }

  function estimateNutrition(name) {
    const t = String(name || '');
    if (/بادام|گردو|تخمه/.test(t) && !/نان/.test(t)) return { calories: 220, protein: 7, fat: 19, sugar: 2, carbs: 8, fiber: 4, salt: 0, saturatedFat: 2 };
    if (/جو دوسر|اسکوپ پروتئین/.test(t) && /شیر/.test(t)) return { calories: 280, protein: 22, fat: 6, sugar: 8, carbs: 32, fiber: 4, salt: 0.3, saturatedFat: 2 };
    if (/تخم/.test(t) && /سیب زمینی/.test(t)) return { calories: 360, protein: 22, fat: 12, sugar: 4, carbs: 32, fiber: 3, salt: 0.6, saturatedFat: 4 };
    if (/ماست ایسلندی|کره بادام/.test(t)) return { calories: 420, protein: 28, fat: 16, sugar: 8, carbs: 32, fiber: 3, salt: 0.5, saturatedFat: 4 };
    if (/عدس|لوبیا/.test(t) && /برنج|پلو/.test(t)) return { calories: 520, protein: 28, fat: 12, sugar: 5, carbs: 70, fiber: 10, salt: 1, saturatedFat: 3 };
    if (/عدس|لوبیا/.test(t)) return { calories: 380, protein: 16, fat: 5, sugar: 4, carbs: 62, fiber: 11, salt: 0.8, saturatedFat: 1 };
    if (/مرغ|ماهی|تن ماهی|ران/.test(t)) return { calories: 480, protein: 38, fat: 10, sugar: 3, carbs: 48, fiber: 2, salt: 0.8, saturatedFat: 2 };
    if (/قیمه|کتلت|کوبیده|استیک|دل و جگر|خورش|قرمه/.test(t)) return { calories: 520, protein: 32, fat: 16, sugar: 5, carbs: 52, fiber: 5, salt: 1, saturatedFat: 5 };
    if (/ماکارونی|پاستا/.test(t)) return { calories: 500, protein: 28, fat: 14, sugar: 4, carbs: 62, fiber: 4, salt: 0.9, saturatedFat: 4 };
    if (/برنج|پلو/.test(t)) return { calories: 450, protein: 12, fat: 8, sugar: 4, carbs: 78, fiber: 4, salt: 0.6, saturatedFat: 2 };
    if (/تخم|املت|نیمرو/.test(t)) return { calories: 240, protein: 14, fat: 14, sugar: 3, carbs: 12, fiber: 1, salt: 0.5, saturatedFat: 4 };
    if (/نان|پنیر|گردو|سنگک|تافتون/.test(t)) return { calories: 300, protein: 12, fat: 12, sugar: 3, carbs: 34, fiber: 3, salt: 0.7, saturatedFat: 4 };
    if (/جو دوسر|سوپ/.test(t)) return { calories: 220, protein: 8, fat: 5, sugar: 6, carbs: 34, fiber: 4, salt: 0.7, saturatedFat: 2 };
    if (/موز/.test(t)) return { calories: 105, protein: 1, fat: 0, sugar: 14, carbs: 27, fiber: 3, salt: 0, saturatedFat: 0 };
    if (/پرتقال|نارنگی/.test(t)) return { calories: 70, protein: 1, fat: 0, sugar: 12, carbs: 16, fiber: 3, salt: 0, saturatedFat: 0 };
    if (/هندوانه|طالبی|خربزه/.test(t)) return { calories: 50, protein: 1, fat: 0, sugar: 10, carbs: 12, fiber: 1, salt: 0, saturatedFat: 0 };
    if (/سیب/.test(t)) return { calories: 80, protein: 0, fat: 0, sugar: 16, carbs: 21, fiber: 3, salt: 0, saturatedFat: 0 };
    if (/کیوی/.test(t)) return { calories: 50, protein: 1, fat: 0, sugar: 7, carbs: 12, fiber: 2, salt: 0, saturatedFat: 0 };
    if (/خرما/.test(t)) return { calories: 23, protein: 0, fat: 0, sugar: 5, carbs: 6, fiber: 1, salt: 0, saturatedFat: 0 };
    if (/هلو|گلابی|آلو|انار|زرد آلو|میوه/.test(t)) return { calories: 70, protein: 1, fat: 0, sugar: 13, carbs: 18, fiber: 2, salt: 0, saturatedFat: 0 };
    if (/بادام/.test(t)) return { calories: 80, protein: 3, fat: 7, sugar: 1, carbs: 3, fiber: 1, salt: 0, saturatedFat: 0.5 };
    if (/شیر|ماست|دوغ/.test(t)) return { calories: 100, protein: 6, fat: 3, sugar: 10, carbs: 12, fiber: 0, salt: 0.3, saturatedFat: 2 };
    if (/سالاد|خیار|کاهو|چای/.test(t)) return { calories: 40, protein: 2, fat: 1, sugar: 3, carbs: 6, fiber: 2, salt: 0.2, saturatedFat: 0 };
    return { calories: 220, protein: 8, fat: 7, sugar: 6, carbs: 28, fiber: 3, salt: 0.5, saturatedFat: 2 };
  }

  function servingGrams(name) {
    const t = String(name || '');
    if (/بادام|گردو|تخمه/.test(t) && !/نان/.test(t)) return 30;
    if (/خرما/.test(t)) return 20;
    if (/نان|سنگک|تافتون/.test(t)) return 80;
    if (/موز|پرتقال|نارنگی|سیب|کیوی|هلو|گلابی|آلو|انار|میوه|هندوانه|طالبی/.test(t)) return 120;
    if (/شیر|ماست|دوغ/.test(t)) return 200;
    if (/برنج|پلو|خورش|مرغ|ماهی|عدس|لوبیا|ماکارونی|پاستا|قیمه|کتلت/.test(t)) return 300;
    return 100;
  }

  function scaleNut(nut, factor) {
    const round = (n) => Math.round(Number(n || 0) * factor * 10) / 10;
    return {
      calories: Math.round(Number(nut.calories || 0) * factor),
      protein: round(nut.protein),
      fat: round(nut.fat),
      sugar: round(nut.sugar),
      carbs: round(nut.carbs),
      fiber: round(nut.fiber),
      salt: round(nut.salt),
      saturatedFat: round(nut.saturatedFat),
    };
  }

  function nutritionForGrams(name, grams) {
    const base = servingGrams(name);
    const g = Number(grams) > 0 ? Number(grams) : base;
    return { ...scaleNut(estimateNutrition(name), g / base), grams: Math.round(g) };
  }

  const MEASURE_UNITS = [
    { id: 'g', fa: 'گرم', en: 'grams' },
    { id: 'tbsp', fa: 'قاشق غذاخوری', en: 'tablespoon' },
    { id: 'tsp', fa: 'قاشق مرباخوری', en: 'teaspoon' },
    { id: 'piece', fa: 'عدد', en: 'piece' },
    { id: 'cup', fa: 'لیوان', en: 'cup' },
    { id: 'halfCup', fa: 'نصف لیوان', en: 'half cup' },
    { id: 'scoop', fa: 'اسکوپ', en: 'scoop' },
    { id: 'halfScoop', fa: 'نصف اسکوپ', en: 'half scoop' },
    { id: 'matchbox', fa: 'قوطی کبریت', en: 'matchbox' },
    { id: 'palm', fa: 'کف دست', en: 'palm' },
  ];

  function unitLabel(unitId, lang) {
    const unit = MEASURE_UNITS.find((item) => item.id === unitId) || MEASURE_UNITS[0];
    return lang === 'en' ? unit.en : unit.fa;
  }

  function gramsPerUnit(name, unitId) {
    const t = String(name || '');
    if (unitId === 'g') return 1;
    if (unitId === 'tbsp') {
      if (/مربا|عسل|کره/.test(t)) return 20;
      if (/برنج|پلو|ماکارونی|جو/.test(t)) return 15;
      return 15;
    }
    if (unitId === 'tsp') return /مربا|عسل|کره/.test(t) ? 7 : 5;
    if (unitId === 'cup') return /شیر|دوغ|ماست|عدس|لوبیا|هندوانه/.test(t) ? 200 : 200;
    if (unitId === 'halfCup') return 100;
    if (unitId === 'scoop' || unitId === 'halfScoop') return unitId === 'scoop' ? 30 : 15;
    if (unitId === 'matchbox') return 30;
    if (unitId === 'palm') return 90;
    if (unitId === 'piece') {
      if (/بادام/.test(t)) return 1.2;
      if (/گردو/.test(t)) return 5;
      if (/خرما/.test(t)) return 8;
      if (/تخم/.test(t)) return 50;
      if (/سیب|موز|هلو|گلابی|کیوی|پرتقال|نارنگی/.test(t)) return 120;
      if (/آلو/.test(t)) return 40;
      if (/زرد آلو/.test(t)) return 25;
      if (/ران|کتلت|کوبیده/.test(t)) return 90;
      if (/بادنجان/.test(t)) return 150;
      return 50;
    }
    return 1;
  }

  function amountToGrams(name, unitId, amount) {
    const n = Number(amount);
    const qty = n > 0 ? n : 1;
    return Math.round(qty * gramsPerUnit(name, unitId || 'g') * 10) / 10;
  }

  function nutritionOf(item) {
    const n = {
      calories: numNut(item?.calories),
      protein: numNut(item?.protein),
      fat: numNut(item?.fat),
      sugar: numNut(item?.sugar),
      carbs: numNut(item?.carbs),
      fiber: numNut(item?.fiber),
      salt: numNut(item?.salt),
      saturatedFat: numNut(item?.saturatedFat),
    };
    if (n.calories) return n;
    return estimateNutrition(item?.name);
  }

  function cloneDaySlots(slots) {
    const out = {};
    SLOT_ORDER.forEach((slot) => {
      const item = slots?.[slot];
      if (!item?.name) return;
      out[slot] = {
        name: String(item.name).trim(),
        alts: asNameList(item.alts),
        ...nutritionOf(item),
      };
    });
    return out;
  }

  function weekStart(date) {
    const copy = new Date(date);
    const diff = (copy.getDay() + 1) % 7;
    copy.setDate(copy.getDate() - diff);
    copy.setHours(12, 0, 0, 0);
    return copy;
  }

  function ownedPlans() {
    return readJson(sk('hnp-owned-plans'), []);
  }

  function addOwnedPlan(plan) {
    const list = ownedPlans().filter((item) => item.coachId !== plan.coachId);
    list.unshift({
      coachId: plan.coachId,
      name: plan.name,
      coachName: plan.coachName,
      file: plan.file,
      savedAt: Date.now(),
    });
    writeJson(sk('hnp-owned-plans'), list);
    return list;
  }

  function applyParsedPlan(parsed, fromDate) {
    writeJson(sk(PLAN_KEY), {});
    writeJson(sk(LOG_KEY), {});
    localStorage.removeItem(sk(PENDING_KEY));

    const session = getSession();
    if (session?.email) {
      const users = getUsers();
      if (users[session.email]) {
        users[session.email].meals = {};
        users[session.email].lastScan = null;
        saveUsers(users);
      }
    }

    const days = Array.isArray(parsed?.days) ? parsed.days : [];
    const byOffset = new Map();
    days.forEach((day) => {
      const off = Number(day.offset);
      if (Number.isFinite(off)) byOffset.set(((off % 7) + 7) % 7, day.slots);
    });
    const dailySlots = days[0]?.slots || {};
    const template = [];
    for (let i = 0; i < 7; i++) {
      template[i] = cloneDaySlots(byOffset.get(i) || dailySlots);
    }
    writeJson(sk(WEEK_TEMPLATE_KEY), template);

    const ref = parseDateKey(fromDate);
    const plan = {};
    const cursor = new Date(ref.getFullYear(), ref.getMonth(), 1, 12);
    const last = new Date(ref.getFullYear(), ref.getMonth() + 3, 0, 12);
    while (cursor <= last) {
      const clean = template[(cursor.getDay() + 1) % 7];
      if (clean && Object.keys(clean).length) {
        plan[dateKey(cursor)] = JSON.parse(JSON.stringify(clean));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    writeJson(sk(PLAN_KEY), plan);
    scheduleSync();
    return new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  }

  function getWeekTemplate() {
    const saved = readJson(sk(WEEK_TEMPLATE_KEY), null);
    if (Array.isArray(saved) && saved.length === 7) return saved;
    const plan = getCoachPlan();
    const template = [{}, {}, {}, {}, {}, {}, {}];
    Object.keys(plan).forEach((key) => {
      const off = (parseDateKey(key).getDay() + 1) % 7;
      if (!Object.keys(template[off]).length) template[off] = plan[key];
    });
    return template;
  }

  function ensureMonthPlan(date) {
    const template = getWeekTemplate();
    if (template.every((day) => !day || !Object.keys(day).length)) return 0;
    const plan = getCoachPlan();
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let filled = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const cursor = new Date(year, month, day, 12);
      const key = dateKey(cursor);
      if (plan[key] && Object.keys(plan[key]).length) continue;
      const slots = template[(cursor.getDay() + 1) % 7];
      if (!slots || !Object.keys(slots).length) continue;
      plan[key] = JSON.parse(JSON.stringify(slots));
      filled += 1;
    }
    writeJson(sk(PLAN_KEY), plan);
    scheduleSync();
    return filled;
  }

  function planOptions(planned) {
    if (!planned?.name) return [];
    const seen = new Set();
    return [planned.name, ...asNameList(planned.alts)].filter((name) => {
      const key = normalizeName(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isPlanOption(planned, name) {
    return planOptions(planned).some((option) => namesMatch(name, option));
  }

  function confirmSlotFollowed(date, slot, chosenName) {
    const planned = getCoachSlot(date, slot);
    if (!planned?.name) return null;
    const chosen = String(chosenName || planned.name).replace(/\s+/g, ' ').trim();
    if (!isPlanOption(planned, chosen)) return null;
    const nut = estimateNutrition(chosen);
    const log = getLog();
    if (!log[date]) log[date] = emptyDay();
    const meal = {
      id: `meal-${Date.now()}`,
      source: 'confirm',
      confirmed: true,
      coachPick: true,
      slot,
      date,
      nameFa: chosen,
      nameEn: chosen,
      ...nut,
      components: [],
    };
    log[date][slot] = [meal];
    writeJson(sk(LOG_KEY), log);
    const session = getSession();
    if (session?.email) {
      const { users, user } = ensureLocalUser(session.email);
      if (user) {
        if (!user.meals[date]) user.meals[date] = emptyDay();
        user.meals[date][slot] = [meal];
        saveUsers(users);
      }
    }
    scheduleSync();
    return meal;
  }

  function normalizeName(value) {
    return String(value || '')
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

  function eatenNames(meals) {
    return meals.flatMap((meal) => [meal.nameFa, meal.nameEn, meal.nameAr].filter(Boolean));
  }

  function isCoachPickMeal(meal) {
    return isConfirmMeal(meal);
  }

  function isOffPlanLog(meal) {
    return meal.offPlan || meal.source === 'manual' || meal.source === 'scan';
  }

  function slotStatus(date, slot) {
    const planned = getCoachSlot(date, slot);
    const eaten = getDayMeals(date)[slot] || [];
    if (!planned?.name) return { status: 'none', planned: null, eaten };
    if (!eaten.length) return { status: 'missed', planned, eaten };
    if (eaten.some(isOffPlanLog)) {
      return { status: 'substitute', planned, eaten };
    }
    if (eaten.every((meal) => isCoachPickMeal(meal))) {
      return { status: 'followed', planned, eaten };
    }
    const names = eatenNames(eaten);
    if (names.some((name) => isPlanOption(planned, name))) {
      return { status: 'followed', planned, eaten };
    }
    return { status: 'substitute', planned, eaten };
  }

  function rangeCompliance(kind) {
    const { start, end } = periodRange(kind);
    const keys = rangeKeys(start, end);
    const counts = { followed: 0, altOk: 0, substitute: 0, missed: 0, planned: 0 };
    const details = [];
    keys.forEach((date) => {
      SLOT_ORDER.forEach((slot) => {
        const result = slotStatus(date, slot);
        if (result.status === 'none') return;
        counts.planned += 1;
        counts[result.status] += 1;
        details.push({ date, slot, ...result });
      });
    });
    const done = counts.followed + counts.altOk;
    const rate = counts.planned ? Math.round((done / counts.planned) * 100) : 0;
    return { start, end, counts, details, rate };
  }

  function dayPlanCounts(date) {
    let planned = 0;
    let followed = 0;
    SLOT_ORDER.forEach((slot) => {
      const result = slotStatus(date, slot);
      if (result.status === 'none') return;
      planned += 1;
      if (result.status === 'followed' || result.status === 'altOk') followed += 1;
    });
    return { planned, followed };
  }

  function burndownForMonth(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthStart = new Date(year, month, 1, 12);
    const monthEnd = new Date(year, month + 1, 0, 12);
    const keys = rangeKeys(monthStart, monthEnd);
    const first = keys.findIndex((date) => dayPlanCounts(date).planned > 0);
    if (first < 0) {
      return { start: monthStart, end: monthEnd, total: 0, gap: 0, points: [] };
    }
    const span = keys.slice(first);
    const daily = span.map((date) => ({ date, ...dayPlanCounts(date) }));
    const total = daily.reduce((sum, day) => sum + day.planned, 0);
    const todayKey = dateKey(new Date());
    let done = 0;
    const points = daily.map((day, i) => {
      const past = day.date <= todayKey;
      if (past) done += day.followed;
      const n = daily.length;
      const ideal = total * (1 - (i + 1) / n);
      const remaining = past ? total - done : null;
      const gap = remaining == null ? 0 : remaining - ideal;
      return {
        label: day.date.slice(8),
        date: day.date,
        remaining,
        ideal: Math.round(ideal * 10) / 10,
        gap: Math.round(gap * 10) / 10,
        week: Math.min(4, Math.floor(i / 7) + 1),
      };
    });
    const lastActual = [...points].reverse().find((p) => p.remaining != null);
    return {
      start: span[0],
      end: dateKey(monthEnd),
      total,
      gap: lastActual ? Math.round(lastActual.gap) : 0,
      points,
    };
  }

  function planBurndown(kind) {
    const { start, end } = periodRange(kind);
    if (kind === 'six' || kind === 'year') {
      const points = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
      const last = new Date(end.getFullYear(), end.getMonth(), 1, 12);
      while (cursor <= last) {
        const month = burndownForMonth(cursor);
        const lastActual = [...month.points].reverse().find((p) => p.remaining != null);
        points.push({
          label: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
          remaining: lastActual ? lastActual.remaining : month.total,
          ideal: 0,
          gap: month.gap,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const gap = points.reduce((sum, p) => sum + (Number(p.gap) || 0), 0);
      return { mode: 'months', start, end: dateKey(end), total: 0, gap: Math.round(gap), points };
    }
    const month = burndownForMonth(end);
    return { mode: 'days', ...month };
  }

  function getBmiProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(sk('hnp-bmi-profile')) || 'null');
      const heightCm = Number(saved?.heightCm);
      const weightKg = Number(saved?.weightKg);
      if (!heightCm || !weightKg) return null;
      const bmi = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
      let cat = 'obese';
      if (bmi < 18.5) cat = 'under';
      else if (bmi < 25) cat = 'normal';
      else if (bmi < 30) cat = 'over';
      return { heightCm, weightKg, bmi, cat };
    } catch {
      return null;
    }
  }

  return {
    SLOTS,
    SLOT_ORDER,
    allMeals,
    getCalorieTarget,
    setCalorieTarget,
    rangeReport,
    getRole,
    setRole,
    getCoachSlot,
    getDayPlan,
    setCoachSlot,
    applyParsedPlan,
    ownedPlans,
    addOwnedPlan,
    ensureMonthPlan,
    planOptions,
    confirmSlotFollowed,
    slotStatus,
    rangeCompliance,
    planBurndown,
    currentUser,
    displayName,
    getProfile,
    saveProfile,
    isLoggedIn,
    isPremium,
    registerOrLogin,
    sendPhoneOtp,
    verifyPhoneOtp,
    logout,
    upgradePremium,
    saveBmi,
    getBmiProfile,
    saveLastScan,
    getLastScan,
    getPendingScan,
    setPendingSlot,
    clearPendingSlot,
    dateKey,
    guessSlot,
    mealFromScan,
    addMeal,
    addManualMeal,
    servingGrams,
    nutritionForGrams,
    MEASURE_UNITS,
    unitLabel,
    amountToGrams,
    removeMeal,
    getDayMeals,
    dayTotals,
    guessSlot: guessSlot,
    mealFromScan: mealFromScan,
    dayTotals: dayTotals,
    getDayMeals: getDayMeals,
    registerOrLogin: registerOrLogin,
    getLastScan: getLastScan,
  };
})();
window.HNP = HNP;
