const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

let selectedDate = new Date();
let monthMode = false;
let activeTab = 'planner';

function toPersianDigits(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function parseLocalizedNumber(value) {
  if (value == null || value === '') return NaN;
  let s = String(value).trim();
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(PERSIAN_DIGITS[i], String(i));
  }
  s = s.replace(/[^\d.]/g, '');
  return s ? Number(s) : NaN;
}

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Math.round(Number(value) * 10) / 10;
}

function gramsLabel(value) {
  const n = formatNumber(value);
  return n === '—' ? '—' : `${n} g`;
}

function formatFaDate(date) {
  if (I18N.getLang() === 'fa') {
    return date.toLocaleDateString('fa-IR', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString(I18N.locale(), { weekday: 'long', month: 'long', day: 'numeric' });
}

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function jalaliToGregorian(jy, jm, jd) {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const sal = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  let day = gd;
  for (; gm <= 12 && day > sal[gm]; gm++) day -= sal[gm];
  return new Date(gy, gm - 1, day, 12);
}

function isJalaliLeap(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  let jp = breaks[0];
  let jump = 0;
  let leap = 0;
  for (let i = 1; i < bl; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (jump - n < 6) n = n - jump + Math.floor((jump + 4) / 33) * 33;
  leap = ((((n + 1) % 33) - 1) % 4);
  if (leap === -1) leap = 4;
  return leap === 0;
}

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

function shiftDisplayedMonth(delta) {
  if (I18N.getLang() !== 'fa') {
    selectedDate.setMonth(selectedDate.getMonth() + delta);
    return;
  }
  const j = gregorianToJalali(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate());
  let jm = j.jm + delta;
  let jy = j.jy;
  while (jm > 12) {
    jm -= 12;
    jy += 1;
  }
  while (jm < 1) {
    jm += 12;
    jy -= 1;
  }
  const jd = Math.min(j.jd, jalaliMonthLength(jy, jm));
  selectedDate = jalaliToGregorian(jy, jm, jd);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function openManualForSlot(slot) {
  const card = document.querySelector('.manual-card');
  if (card) card.open = true;
  const slotEl = document.getElementById('manual-slot');
  if (slotEl) slotEl.value = slot;
  document.getElementById('manual-name')?.focus();
}

function showView(id) {
  document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showToast(text) {
  const el = document.getElementById('toast');
  el.hidden = false;
  el.textContent = text;
  setTimeout(() => {
    el.hidden = true;
  }, 2500);
}

function fillPlanHead() {
  const user = HNP.currentUser();
  const nameEl = document.getElementById('user-name');
  const subEl = document.getElementById('user-sub');
  if (nameEl) nameEl.textContent = HNP.displayName(user);
  if (subEl) subEl.textContent = 'برنامه غذایی';
}

function route() {
  fillPlanHead();
  if (!HNP.isLoggedIn()) {
    location.href = 'login.html?next=plan.html';
    return;
  }
  if (!HNP.isPremium()) {
    showView('view-paywall');
    return;
  }
  showView('view-app');
  const user = HNP.currentUser();
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.hidden = !user;
  const params = new URLSearchParams(location.search);
  const dateParam = params.get('date');
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    selectedDate = new Date(`${dateParam}T12:00:00`);
  }
  const focusSlot = params.get('slot') || '';
  consumePendingScan();
  renderPlanner();
  renderFacts();
  renderOwnedPlans();
  if (focusSlot) {
    document.querySelector(`[data-slot-block="${focusSlot}"]`)?.scrollIntoView({ block: 'center' });
  }
}

function consumePendingScan() {
  const params = new URLSearchParams(location.search);
  if (params.get('fromScan') !== '1') return;
  const pending = HNP.getPendingScan();
  if (!pending?.scan) return;
  const slot = pending.slot || HNP.guessSlot();
  const date = HNP.dateKey(selectedDate);
  HNP.addMeal(HNP.mealFromScan(pending.scan, slot, date));
  HNP.clearPendingSlot();
  const check = HNP.slotStatus(date, slot);
  let msg = I18N.t('saved.as', { slot: I18N.t(`slot.${slot}`) });
  if (check.status !== 'none') msg += ' — ' + I18N.t(`alert.${check.status}`);
  showToast(msg);
  history.replaceState({}, '', 'plan.html');
}

function monthTitle(date) {
  if (I18N.getLang() === 'fa') {
    const j = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return `${JALALI_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;
  }
  return date.toLocaleDateString(I18N.locale(), { month: 'long', year: 'numeric' });
}

function dayMark(key) {
  const calories = Number(HNP.dayTotals(key).calories) || 0;
  const logged = HNP.allMeals(HNP.getDayMeals(key)).length;
  if (calories) return `${formatNumber(calories)} kcal`;
  if (logged) return I18N.t('month.logged');
  return I18N.t('month.open');
}

function renderPlanner() {
  const key = HNP.dateKey(selectedDate);
  document.getElementById('day-label').textContent = monthTitle(selectedDate);
  const totals = HNP.dayTotals(key);
  renderLimitAlarm(key);
  const totalsEl = document.getElementById('day-totals');
  if (!totals.calories && !totals.sugar && !totals.fat) {
    totalsEl.textContent = '';
  } else {
    totalsEl.textContent = I18N.t('totals', {
      cal: formatNumber(totals.calories),
      sugar: formatNumber(totals.sugar),
      fat: formatNumber(totals.fat),
    });
  }

  const monthWrap = document.getElementById('month-wrap');
  const weekWrap = document.getElementById('week-strip');
  monthWrap.hidden = !monthMode;
  weekWrap.hidden = monthMode;
  if (monthMode) renderMonthGrid();
  else renderWeekStrip();

  const todayPlan = document.getElementById('today-plan');
  todayPlan.hidden = true;
  todayPlan.innerHTML = '';
  document.getElementById('day-slots').hidden = false;

  const meals = HNP.getDayMeals(key);
  const slotsEl = document.getElementById('day-slots');
  slotsEl.innerHTML = HNP.SLOT_ORDER.map((slot) => {
      const items = meals[slot] || [];
      const check = HNP.slotStatus(key, slot);
      const options = check.planned ? HNP.planOptions(check.planned) : [];
      const selectedName = String(items[0]?.nameFa || check.planned?.name || '').replace(/\s+/g, ' ').trim();
      const planLine = options.length
        ? `<label class="plan-pick-wrap"><span>${I18N.t('coach.planned')}</span>
            <select class="plan-pick" data-slot="${slot}">
              ${options
                .map(
                  (option) => {
                    const label = String(option).replace(/\s+/g, ' ').trim();
                    return `<option value="${escapeHtml(label)}" ${label === selectedName ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                  }
                )
                .join('')}
            </select></label>`
        : '';
      const alertLine =
        check.status === 'none'
          ? ''
          : `<p class="alert-line alert-${check.status}">${I18N.t(`alert.${check.status}`)}</p>`;
      const confirmBtn = check.planned
        ? `<div class="slot-actions">
            <button type="button" class="btn btn-secondary btn-confirm" data-confirm="${slot}">${I18N.t('confirm.same')}</button>
            <button type="button" class="btn btn-secondary btn-offplan" data-offplan="${slot}">${I18N.t('confirm.offPlan')}</button>
          </div>`
        : '';
      const rows = items.length
        ? items
            .map(
              (meal) => `
          <div class="meal-row">
            <div>
              <p class="fa-text">${I18N.nameOf({ fa: meal.nameFa, en: meal.nameEn, ar: meal.nameAr }) || meal.nameFa}</p>
              ${mealMeta(meal)}
            </div>
            <button type="button" class="btn-tiny" data-remove="${escapeHtml(String(meal.id || ''))}" data-slot="${slot}" aria-label="حذف">×</button>
          </div>`
            )
            .join('')
        : `<p class="auth-note">${check.planned ? I18N.t('empty.planned') : I18N.t('empty.meals')}</p>`;
      return `
        <div class="slot-block" data-slot-block="${slot}">
          <div class="slot-title">${I18N.t(`slot.${slot}`)}</div>
          ${planLine}
          ${alertLine}
          ${confirmBtn}
          ${rows}
        </div>`;
    }).join('');

  slotsEl.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      HNP.removeMeal(key, btn.dataset.slot, btn.dataset.remove);
      renderPlanner();
      renderFacts();
    });
  });
  function logPickedFood(slot, chosen) {
    const saved = HNP.confirmSlotFollowed(key, slot, chosen);
    renderPlanner();
    renderFacts();
    showToast(
      saved
        ? I18N.t('saved.as', { slot: I18N.t(`slot.${slot}`) })
        : I18N.t('confirm.blocked')
    );
  }
  slotsEl.querySelectorAll('.plan-pick').forEach((pick) => {
    pick.addEventListener('change', () => logPickedFood(pick.dataset.slot, pick.value));
  });
  slotsEl.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.confirm;
      const pick = slotsEl.querySelector(`.plan-pick[data-slot="${slot}"]`);
      logPickedFood(slot, pick?.value || '');
    });
  });
  slotsEl.querySelectorAll('[data-offplan]').forEach((btn) => {
    btn.addEventListener('click', () => openManualForSlot(btn.dataset.offplan));
  });
}

function startOfWeek(date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 1) % 7));
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function renderWeekStrip() {
  const strip = document.getElementById('week-strip');
  const start = startOfWeek(selectedDate);
  const selectedKey = HNP.dateKey(selectedDate);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = HNP.dateKey(date);
    const calories = Number(HNP.dayTotals(key).calories) || 0;
    const logged = HNP.allMeals(HNP.getDayMeals(key)).length;
    const hasPlan = Object.keys(HNP.getDayPlan(key)).length > 0;
    const dayNum =
      I18N.getLang() === 'fa'
        ? toPersianDigits(date.toLocaleDateString('fa-IR', { day: 'numeric' }))
        : String(date.getDate());
    const isToday = key === HNP.dateKey(new Date()) ? 'is-today' : '';
    cells.push(
      `<button type="button" class="week-cell month-cell ${key === selectedKey ? 'selected' : ''} ${isToday} ${hasPlan ? 'has-plan' : ''} ${logged || calories ? 'is-logged' : 'is-empty'}" data-day="${key}">
        <div class="cal">${dayNum}</div>
        <div class="dots">${dayMark(key)}</div>
      </button>`
    );
  }
  const heads = [0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="dow">${I18N.t(`wd.${i}`)}</div>`).join('');
  strip.innerHTML = heads + cells.join('');
  strip.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = new Date(`${btn.dataset.day}T12:00:00`);
      renderPlanner();
      renderFacts();
    });
  });
}

function setRangeMode(mode) {
  monthMode = mode === 'month';
  document.getElementById('btn-day').classList.toggle('active', !monthMode);
  document.getElementById('btn-month').classList.toggle('active', monthMode);
  renderPlanner();
}

function dayFoodTotals(key) {
  const meals = HNP.getDayMeals(key);
  const sum = { sugar: 0, salt: 0, fat: 0, saturatedFat: 0, calories: 0, count: 0 };
  HNP.SLOT_ORDER.forEach((slot) => {
    (meals[slot] || []).forEach((meal) => {
      const name = meal.nameFa || meal.nameEn || meal.nameAr || '';
      if (!String(name).trim() && !(Number(meal.calories) > 0)) return;
      sum.count += 1;
      sum.sugar += Number(meal.sugar) || 0;
      sum.salt += Number(meal.salt) || 0;
      sum.fat += Number(meal.fat) || 0;
      sum.saturatedFat += Number(meal.saturatedFat) || 0;
      sum.calories += Number(meal.calories) || 0;
    });
  });
  return sum;
}

function healthFlags() {
  const profile = typeof HNP.getProfile === 'function'
    ? HNP.getProfile()
    : (HNP.currentUser()?.profile || {});
  const note = String(profile.injuries || '');
  const marked = (key) => profile[key] === '1' || profile[key] === true;
  const flags = {
    diabetes: marked('diabetes') || /دیابت|قند خون/.test(note),
    highBp: marked('highBp') || /فشار خون بالا|فشارخون بالا/.test(note),
    highChol: marked('highChol') || /کلسترول|چربی خون/.test(note),
  };
  try {
    const raw = JSON.parse(localStorage.getItem('hnp-vitals') || '{}');
    const days = raw.days && typeof raw.days === 'object' ? raw.days : {};
    const latest = Object.keys(days).sort().reduce((found, key) => days[key] || found, null);
    if (latest) {
      const sugar = parseLocalizedNumber(latest.sugar);
      const sys = parseLocalizedNumber(latest.sys);
      const dia = parseLocalizedNumber(latest.dia);
      if (sugar >= 126) flags.diabetes = true;
      if (sys >= 140 || dia >= 90) flags.highBp = true;
    }
  } catch { /* اندازه‌ای نیست */ }
  return flags;
}

function alarmMeals(key) {
  const meals = HNP.getDayMeals(key);
  const rows = [];
  HNP.SLOT_ORDER.forEach((slot) => {
    (meals[slot] || []).forEach((meal) => {
      const name = String(meal.nameFa || meal.nameEn || meal.nameAr || '').replace(/\s+/g, ' ').trim();
      if (!name && !(Number(meal.calories) > 0)) return;
      rows.push({
        name: name || 'غذا',
        offPlan: Boolean(meal.offPlan),
        fat: Number(meal.fat) || 0,
        saturatedFat: Number(meal.saturatedFat) || 0,
        sugar: Number(meal.sugar) || 0,
        salt: Number(meal.salt) || 0,
      });
    });
  });
  return rows;
}

function skipHint(rows, total, limit, field, label) {
  const enough = rows.filter((row) => row[field] > 0 && total - row[field] <= limit);
  if (!enough.length) return '';
  const extras = enough.filter((row) => row.offPlan);
  const pool = extras.length ? extras : enough;
  pool.sort((a, b) => b[field] - a[field]);
  const pick = pool[0];
  const left = Math.round((total - pick[field]) * 10) / 10;
  const food = pick.name.length > 32 ? `${pick.name.slice(0, 32)}…` : pick.name;
  return `اگر ${food} را نمی‌خوردی، ${label} حدود ${formatNumber(left)} گرم می‌ماند و این هشدار نمی‌آمد.`;
}

function renderLimitAlarm(key) {
  const el = document.getElementById('limit-alarm');
  if (!el) return;
  const sum = dayFoodTotals(key);
  const flags = healthFlags();
  const over = [];
  if (sum.count && flags.diabetes && sum.sugar > 50) over.push('قند');
  if (sum.count && flags.highBp && sum.salt > 5) over.push('نمک');
  if (sum.count && flags.highChol && (sum.saturatedFat > 20 || sum.fat > 70)) over.push('چربی');
  if (!over.length) {
    el.hidden = true;
    el.classList.remove('is-open');
    el.innerHTML = '';
    return;
  }
  const wasOpen = el.dataset.day === key && el.classList.contains('is-open');
  const name = over.length === 1 ? `${over[0]}ت` : `${over.join(' و ')}ت`;
  const rows = alarmMeals(key);
  const lines = [];
  const hints = [];
  if (flags.highChol) {
    lines.push(`جمع چربی ${formatNumber(sum.fat)} گرم است. حد هشدار ۷۰ گرم است.`);
    lines.push(sum.saturatedFat > 20
      ? `چربی اشباع ${formatNumber(sum.saturatedFat)} گرم است و از ۲۰ گرم گذشته.`
      : `چربی اشباع ${formatNumber(sum.saturatedFat)} گرم است و هنوز به ۲۰ گرم نرسیده.`);
    if (sum.fat > 70) hints.push(skipHint(rows, sum.fat, 70, 'fat', 'چربی'));
    else if (sum.saturatedFat > 20) hints.push(skipHint(rows, sum.saturatedFat, 20, 'saturatedFat', 'چربی اشباع'));
  }
  if (flags.diabetes) {
    lines.push(sum.sugar > 50
      ? `قند ${formatNumber(sum.sugar)} گرم است و از ۵۰ گرم گذشته.`
      : `قند ${formatNumber(sum.sugar)} گرم است و زیر ۵۰ است.`);
    if (sum.sugar > 50) hints.push(skipHint(rows, sum.sugar, 50, 'sugar', 'قند'));
  }
  if (flags.highBp) {
    lines.push(sum.salt > 5
      ? `نمک ${formatNumber(sum.salt)} گرم است و از ۵ گرم گذشته.`
      : `نمک ${formatNumber(sum.salt)} گرم است و زیر ۵ است.`);
    if (sum.salt > 5) hints.push(skipHint(rows, sum.salt, 5, 'salt', 'نمک'));
  }
  el.hidden = false;
  el.dataset.day = key;
  el.classList.toggle('is-open', wasOpen);
  el.innerHTML = `
    <button type="button" class="limit-alarm-hit">امروز مرز ${name} از حد طبیعی گذشته</button>
    <div class="limit-alarm-body" ${wasOpen ? '' : 'hidden'}>
      ${lines.map((line) => `<p>${line}</p>`).join('')}
      ${hints.filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
      <p class="limit-alarm-note">این تخمین آموزشی است، نه تشخیص پزشکی.</p>
    </div>`;
  el.querySelector('.limit-alarm-hit').addEventListener('click', () => {
    const body = el.querySelector('.limit-alarm-body');
    const open = body.hidden;
    body.hidden = !open;
    el.classList.toggle('is-open', open);
  });
}

function mealMeta(meal) {
  const cal = Number(meal.calories) || 0;
  const sugar = Number(meal.sugar) || 0;
  const fat = Number(meal.fat) || 0;
  const grams = Number(meal.grams) || 0;
  const amount = Number(meal.amount) || 0;
  const unitBit =
    meal.unit && meal.unit !== 'g' && amount
      ? `${formatNumber(amount)} ${HNP.unitLabel(meal.unit, I18N.getLang())} · `
      : '';
  if (!cal && !sugar && !fat && !grams) return '';
  const gramBit = grams ? `${formatNumber(grams)}g · ` : '';
  return `<p class="meta">${unitBit}${gramBit}${formatNumber(cal)} kcal · ${I18N.t('sugar.short')} ${formatNumber(sugar)}g · ${I18N.t('facts.fat')} ${formatNumber(fat)}g</p>`;
}

let lastBankFood = null;
let foodSuggestTimer = 0;

function fillManualNutrition(event) {
  const name = document.getElementById('manual-name')?.value.trim();
  const amountEl = document.getElementById('manual-grams');
  const unitEl = document.getElementById('manual-unit');
  const calEl = document.getElementById('manual-cal');
  const sugarEl = document.getElementById('manual-sugar');
  if (!name || !calEl || !sugarEl) return;
  const unit = unitEl?.value || 'g';
  let amount = parseLocalizedNumber(amountEl.value);
  if (!amount) {
    if (event?.target?.id === 'manual-grams') return;
    if (unit === 'g') {
      amount = lastBankFood?.grams || HNP.servingGrams(name);
      amountEl.value = String(amount);
    } else {
      amount = 1;
      amountEl.value = '1';
    }
  }
  const grams = HNP.amountToGrams(name, unit, amount);
  if (lastBankFood && lastBankFood.name === name && lastBankFood.grams) {
    const ratio = grams / lastBankFood.grams;
    calEl.value = String(Math.round((lastBankFood.calories || 0) * ratio));
    sugarEl.value = String(Math.round((lastBankFood.sugar || 0) * ratio * 10) / 10);
    return;
  }
  const nut = HNP.nutritionForGrams(name, grams);
  calEl.value = String(nut.calories);
  sugarEl.value = String(nut.sugar);
}

function hideFoodSuggest() {
  const box = document.getElementById('food-suggest');
  if (box) {
    box.hidden = true;
    box.innerHTML = '';
  }
}

function pickBankFood(food) {
  lastBankFood = food;
  const nameEl = document.getElementById('manual-name');
  const gramsEl = document.getElementById('manual-grams');
  if (nameEl) nameEl.value = food.name;
  if (gramsEl && !gramsEl.value.trim() && food.grams) gramsEl.value = String(food.grams);
  hideFoodSuggest();
  fillManualNutrition();
}

async function suggestFoods() {
  const name = document.getElementById('manual-name')?.value.trim();
  const box = document.getElementById('food-suggest');
  if (!box) return;
  if (name.length < 1) {
    hideFoodSuggest();
    return;
  }
  try {
    const res = await fetch(`/api/foods?q=${encodeURIComponent(name)}`);
    const data = await res.json();
    const foods = data.foods || [];
    box.hidden = false;
    box.replaceChildren();
    if (!foods.length) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = 'این اسم هنوز در بانک نیست؛ بعد از ثبت اضافه می‌شود.';
      box.append(note);
      return;
    }
    foods.forEach((food) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = food.name;
      btn.addEventListener('click', () => pickBankFood(food));
      box.append(btn);
    });
  } catch {
    hideFoodSuggest();
  }
}

function renderMonthGrid() {
  const grid = document.getElementById('month-grid');
  const selectedKey = HNP.dateKey(selectedDate);
  const jalali = I18N.getLang() === 'fa';
  let first;
  let daysInMonth;
  let year;
  let month;
  let jalaliYear;
  let jalaliMonth;

  if (jalali) {
    const j = gregorianToJalali(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate());
    jalaliYear = j.jy;
    jalaliMonth = j.jm;
    daysInMonth = jalaliMonthLength(j.jy, j.jm);
    first = jalaliToGregorian(j.jy, j.jm, 1);
    HNP.ensureMonthPlan(first);
    HNP.ensureMonthPlan(jalaliToGregorian(j.jy, j.jm, daysInMonth));
  } else {
    year = selectedDate.getFullYear();
    month = selectedDate.getMonth();
    first = new Date(year, month, 1, 12);
    daysInMonth = new Date(year, month + 1, 0).getDate();
    HNP.ensureMonthPlan(selectedDate);
  }

  const startWeekday = (first.getDay() + 1) % 7;
  const cells = [0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="dow">${I18N.t(`wd.${i}`)}</div>`);
  for (let i = 0; i < startWeekday; i++) cells.push('<div></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = jalali ? jalaliToGregorian(jalaliYear, jalaliMonth, day) : new Date(year, month, day, 12);
    const key = HNP.dateKey(date);
    const calories = Number(HNP.dayTotals(key).calories) || 0;
    const logged = HNP.allMeals(HNP.getDayMeals(key)).length;
    const selected = key === selectedKey ? 'selected' : '';
    const isToday = key === HNP.dateKey(new Date()) ? 'is-today' : '';
    const hasPlan = Object.keys(HNP.getDayPlan(key)).length > 0;
    const mark = dayMark(key);
    cells.push(
      `<button type="button" class="month-cell ${selected} ${isToday} ${hasPlan ? 'has-plan' : ''} ${logged ? 'is-logged' : 'is-empty'}" data-day="${key}"><div class="cal">${toPersianDigits(day)}</div><div class="dots">${mark}</div></button>`
    );
  }
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDate = new Date(`${btn.dataset.day}T12:00:00`);
      renderPlanner();
      renderFacts();
    });
  });
}

function renderFacts() {
  const key = HNP.dateKey(selectedDate);
  const meals = HNP.allMeals(HNP.getDayMeals(key));
  const empty = document.getElementById('facts-empty');
  const body = document.getElementById('facts-body');
  document.getElementById('facts-day-label').textContent = formatFaDate(selectedDate);
  if (!meals.length) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;
  const sum = meals.reduce(
    (acc, meal) => {
      acc.calories += Number(meal.calories) || 0;
      acc.fat += Number(meal.fat) || 0;
      acc.saturatedFat += Number(meal.saturatedFat) || 0;
      acc.carbs += Number(meal.carbs) || 0;
      acc.fiber += Number(meal.fiber) || 0;
      acc.sugar += Number(meal.sugar) || 0;
      acc.protein += Number(meal.protein) || 0;
      acc.salt += Number(meal.salt) || 0;
      return acc;
    },
    { calories: 0, fat: 0, saturatedFat: 0, carbs: 0, fiber: 0, sugar: 0, protein: 0, salt: 0 }
  );
  const sodiumMg = Math.round(sum.salt * 400);
  body.innerHTML = `
    <p class="facts-serving">${I18N.t('facts.daySum', { n: String(meals.length) })}</p>
    <table class="facts-table">
      <tbody>
        <tr class="facts-row-calories"><th>${I18N.t('facts.cal')}</th><td>${formatNumber(sum.calories)}</td></tr>
        <tr><th>${I18N.t('facts.fat')}</th><td>${gramsLabel(sum.fat)}</td></tr>
        <tr class="facts-indent"><th>${I18N.t('facts.sat')}</th><td>${gramsLabel(sum.saturatedFat)}</td></tr>
        <tr><th>${I18N.t('facts.carbs')}</th><td>${gramsLabel(sum.carbs)}</td></tr>
        <tr class="facts-indent"><th>${I18N.t('facts.fiber')}</th><td>${gramsLabel(sum.fiber)}</td></tr>
        <tr class="facts-indent"><th>${I18N.t('facts.sugar')}</th><td>${gramsLabel(sum.sugar)}</td></tr>
        <tr><th>${I18N.t('facts.protein')}</th><td>${gramsLabel(sum.protein)}</td></tr>
        <tr><th>${I18N.t('facts.salt')}</th><td>${gramsLabel(sum.salt)}</td></tr>
        <tr><th>${I18N.t('facts.sodium')}</th><td>${sum.salt ? `${sodiumMg} mg` : '—'}</td></tr>
      </tbody>
    </table>`;
}

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tabs .tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.getElementById('tab-planner').hidden = name !== 'planner';
  document.getElementById('tab-facts').hidden = name !== 'facts';
  if (name === 'facts') renderFacts();
}

document.getElementById('btn-auth')?.addEventListener('click', async () => {
  const err = document.getElementById('auth-error');
  err.hidden = true;
  try {
    await HNP.registerOrLogin(
      document.getElementById('auth-email').value,
      document.getElementById('auth-password').value
    );
    route();
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message;
  }
});

document.getElementById('btn-upgrade')?.addEventListener('click', async () => {
  location.href = 'subscribe.html?next=plan.html';
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await HNP.logout();
  location.href = 'login.html';
});
document.getElementById('btn-logout-pw')?.addEventListener('click', async () => {
  await HNP.logout();
  location.href = 'login.html';
});

document.querySelectorAll('.tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('btn-day').addEventListener('click', () => setRangeMode('day'));
document.getElementById('btn-month').addEventListener('click', () => setRangeMode('month'));

document.getElementById('btn-prev').addEventListener('click', () => {
  if (monthMode) shiftDisplayedMonth(-1);
  else selectedDate.setDate(selectedDate.getDate() - 7);
  renderPlanner();
});
document.getElementById('btn-next').addEventListener('click', () => {
  if (monthMode) shiftDisplayedMonth(1);
  else selectedDate.setDate(selectedDate.getDate() + 7);
  renderPlanner();
});

document.getElementById('btn-manual').addEventListener('click', () => {
  const nameFa = document.getElementById('manual-name').value.trim();
  if (!nameFa) {
    showToast(I18N.t('manual.needName'));
    return;
  }
  HNP.addManualMeal({
    date: HNP.dateKey(selectedDate),
    slot: document.getElementById('manual-slot').value,
    nameFa,
    amount: parseLocalizedNumber(document.getElementById('manual-grams').value) || 0,
    unit: document.getElementById('manual-unit').value || 'g',
    calories: parseLocalizedNumber(document.getElementById('manual-cal').value),
    sugar: parseLocalizedNumber(document.getElementById('manual-sugar').value),
  });
  lastBankFood = null;
  hideFoodSuggest();
  document.getElementById('manual-name').value = '';
  document.getElementById('manual-grams').value = '';
  document.getElementById('manual-cal').value = '';
  document.getElementById('manual-sugar').value = '';
  renderPlanner();
  renderFacts();
  const slot = document.getElementById('manual-slot').value;
  const check = HNP.slotStatus(HNP.dateKey(selectedDate), slot);
  let msg = I18N.t('manual.ok');
  if (check.status !== 'none') msg += ' — ' + I18N.t(`alert.${check.status}`);
  showToast(msg);
});

function confirmReplacePlan() {
  return window.confirm('مطمئنی می‌خواهی برنامهٔ فعلی را عوض کنی؟');
}

function renderOwnedPlans() {
  const box = document.getElementById('owned-plans');
  const list = document.getElementById('owned-list');
  if (!box || !list || typeof HNP.ownedPlans !== 'function') return;
  const plans = HNP.ownedPlans();
  box.hidden = !plans.length;
  list.innerHTML = plans.map((plan) => `
    <div class="coach-file">
      <strong>${plan.name}</strong>
      <span>${plan.coachName || ''}</span>
      <button type="button" class="btn btn-secondary" data-use-plan="${plan.file}">بگذار در برنامهٔ غذایی</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-use-plan]').forEach((btn) => {
    btn.addEventListener('click', () => useOwnedPlan(btn.dataset.usePlan));
  });
}

async function useOwnedPlan(url) {
  if (!url || !confirmReplacePlan()) return;
  const res = await fetch(url);
  if (!res.ok) {
    showToast('فایل رژیم پیدا نشد');
    return;
  }
  const blob = await res.blob();
  const name = url.split('/').pop() || 'plan.txt';
  await uploadPlanFile(new File([blob], name, { type: blob.type || 'text/plain' }), true);
}

async function uploadPlanFile(file, alreadyConfirmed) {
  if (!file) return;
  if (!alreadyConfirmed && !confirmReplacePlan()) return;
  const status = document.getElementById('plan-photo-status');
  status.hidden = false;
  status.textContent = I18N.t('photo.loading');
  try {
    const body = new FormData();
    body.append('photo', file);
    const response = await fetch('/api/parse-meal-plan', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || I18N.t('photo.fail'));
    const n = HNP.applyParsedPlan(data, HNP.dateKey(selectedDate));
    renderPlanner();
    renderFacts();
    renderOwnedPlans();
    status.textContent = I18N.t('photo.ok', { n: String(n) });
    showToast(I18N.t('photo.ok', { n: String(n) }));
  } catch (err) {
    status.textContent = err.message || I18N.t('photo.fail');
  }
}

document.getElementById('btn-plan-photo').addEventListener('click', () => {
  document.getElementById('plan-photo').click();
});
document.getElementById('plan-photo').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  await uploadPlanFile(file);
});

document.getElementById('manual-name')?.addEventListener('input', (event) => {
  lastBankFood = null;
  fillManualNutrition(event);
  clearTimeout(foodSuggestTimer);
  foodSuggestTimer = setTimeout(suggestFoods, 180);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.lookup')) hideFoodSuggest();
});
document.getElementById('manual-grams')?.addEventListener('input', fillManualNutrition);
document.getElementById('manual-unit')?.addEventListener('change', fillManualNutrition);

document.addEventListener('i18n:change', () => {
  renderPlanner();
  renderFacts();
});

route();
