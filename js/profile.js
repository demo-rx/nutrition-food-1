const FIELDS = [
  'firstName', 'lastName', 'birthDate', 'gender', 'marital', 'city', 'phone', 'sport',
  'goal', 'activity', 'heightCm', 'weightKg', 'experienceYears', 'injuries',
  'targetWeight', 'goalNote', 'startWeight', 'startDate', 'progressNote',
];

const CATS = {
  under: { label: 'کم‌وزن', tip: 'زیر محدوده سالم. با غذای مغذی آرام بالا بیا.' },
  normal: { label: 'سالم', tip: 'BMI در محدوده سالم است.' },
  over: { label: 'اضافه‌وزن', tip: 'کمی بالاتر از محدوده سالم.' },
  obese: { label: 'چاق', tip: 'BMI بالاست. با مربی یا پزشک هماهنگ کن.' },
};

const MUSIC_DB = 'hnp-music-db';
let music = [];
let playing;

function musicKey() {
  return (HNP.currentUser()?.id || HNP.currentUser()?.email || 'guest').toString();
}

function openMusicDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MUSIC_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveTrackFile(id, file) {
  const db = await openMusicDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').put({ id, owner: musicKey(), name: file.name, type: file.type, blob: file });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getTrackFile(id) {
  const db = await openMusicDb();
  return new Promise((resolve) => {
    const tx = db.transaction('tracks', 'readonly');
    const req = tx.objectStore('tracks').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function deleteTrackFile(id) {
  const db = await openMusicDb();
  await new Promise((resolve) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.objectStore('tracks').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

function num(id) {
  const raw = String(document.getElementById(id)?.value || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d.]/g, '');
  const n = Number(raw);
  return n > 0 ? n : 0;
}

function initials(first, last) {
  const a = (first || '').trim().charAt(0);
  const b = (last || '').trim().charAt(0);
  return (a + b || 'و').slice(0, 2);
}

function classify(bmi) {
  if (bmi < 18.5) return 'under';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'over';
  return 'obese';
}

function bmiPinPct(bmi) {
  const bands = [[15, 18.5], [18.5, 25], [25, 30], [30, 40]];
  const x = Math.min(40, Math.max(15, bmi));
  for (let i = 0; i < bands.length; i++) {
    const [a, b] = bands[i];
    if (x <= b || i === bands.length - 1) {
      return i * 25 + ((Math.min(b, x) - a) / (b - a)) * 25;
    }
  }
  return 100;
}

function renderBmi() {
  const h = num('heightCm');
  const w = num('weightKg');
  const board = document.getElementById('bmi-board');
  const line = document.getElementById('bmi-line');
  const pin = document.getElementById('bmi-pin');
  const n = document.getElementById('bmi-num');
  const cat = document.getElementById('bmi-cat');
  const tip = document.getElementById('bmi-tip');
  if (!h || !w) {
    board.className = 'bmi-board';
    line.className = 'bmi-line';
    pin.hidden = true;
    n.textContent = '—';
    cat.textContent = 'قد و وزن را بزن';
    tip.textContent = 'BMI از روی قد و وزن فعلی حساب می‌شود';
    const stat = document.getElementById('stat-bmi');
    if (stat) stat.textContent = '—';
    return;
  }
  const bmi = Math.round((w / (h / 100) ** 2) * 10) / 10;
  const key = classify(bmi);
  board.className = `bmi-board is-${key}`;
  line.className = `bmi-line is-${key}`;
  pin.hidden = false;
  pin.style.left = `${bmiPinPct(bmi)}%`;
  n.textContent = String(bmi);
  cat.textContent = CATS[key].label;
  tip.textContent = CATS[key].tip;
  const stat = document.getElementById('stat-bmi');
  if (stat) stat.textContent = String(bmi);
}

function renderChart() {
  const start = num('startWeight');
  const now = num('weightKg');
  const goal = num('targetWeight');
  const svg = document.getElementById('goal-chart');
  const text = document.getElementById('j-text');
  if (!start || !now || !goal) {
    svg.innerHTML = '<text x="160" y="100" text-anchor="middle" fill="#6b7280" font-size="13">وزن شروع، فعلی و هدف را بزن</text>';
    text.textContent = 'سه عدد را بزن تا نمودار مسیرت رسم شود.';
    const stat = document.getElementById('stat-pct');
    if (stat) stat.textContent = '—';
    return;
  }
  const vals = [start, now, goal];
  const min = Math.min(...vals) - 2;
  const max = Math.max(...vals) + 2;
  const span = max - min || 1;
  const xs = [48, 160, 272];
  const ys = vals.map((v) => 28 + (1 - (v - min) / span) * 120);
  const labels = ['شروع', 'الان', 'هدف'];
  const colors = ['#86efac', '#16a34a', '#047857'];
  const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x},${ys[i]}`).join(' ');
  const area = `${line} L272,168 L48,168 Z`;
  const ticks = [max, (max + min) / 2, min].map((v, i) => {
    const y = 28 + i * 60;
    return `<line x1="36" y1="${y}" x2="300" y2="${y}" stroke="#dcfce7"/><text x="8" y="${y + 4}" fill="#6b7280" font-size="10">${Math.round(v)}</text>`;
  }).join('');
  const dots = xs.map((x, i) => `
    <circle cx="${x}" cy="${ys[i]}" r="7" fill="${colors[i]}" stroke="#fff" stroke-width="2"/>
    <text x="${x}" y="${ys[i] - 12}" text-anchor="middle" fill="#14532d" font-size="12" font-weight="700">${vals[i]}</text>
    <text x="${x}" y="188" text-anchor="middle" fill="#15803d" font-size="12" font-weight="700">${labels[i]}</text>
  `).join('');
  svg.innerHTML = `
    <rect x="0" y="0" width="320" height="200" fill="#f0fdf4"/>
    ${ticks}
    <path d="${area}" fill="#bbf7d0" opacity="0.45"/>
    <path d="${line}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  `;
  const done = (start - now) / (start - goal);
  const pct = Math.max(0, Math.min(100, Math.round(done * 100)));
  const left = Math.round((now - goal) * 10) / 10;
  text.textContent = pct >= 100
    ? 'به هدف رسیدی. همین روند را نگه دار.'
    : `${pct}٪ مسیر را آمده‌ای. حدود ${Math.abs(left)} کیلو تا هدف مانده.`;
  const stat = document.getElementById('stat-pct');
  if (stat) stat.textContent = `${pct}٪`;
}

function ageFromBirth(iso) {
  if (!iso) return '';
  const born = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(born.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) years -= 1;
  return years >= 0 && years < 120 ? String(years) : '';
}

function renderHero() {
  const first = document.getElementById('firstName').value.trim();
  const last = document.getElementById('lastName').value.trim();
  const sport = document.getElementById('sport').value.trim();
  const age = ageFromBirth(document.getElementById('birthDate').value);
  document.getElementById('avatar').textContent = initials(first, last);
  document.getElementById('hero-name').textContent = [first, last].filter(Boolean).join(' ') || 'ورزشکار';
  document.getElementById('hero-sub').textContent = sport || 'رشته‌ات را پایین بنویس';
  document.getElementById('stat-age').textContent = age || '—';
}

function renderSub() {
  const user = HNP.currentUser();
  const active = HNP.isPremium();
  const until = user?.subscriptionUntil
    ? (useShamsi()
      ? JALALI.label(`${new Date(Number(user.subscriptionUntil)).getFullYear()}-${String(new Date(Number(user.subscriptionUntil)).getMonth() + 1).padStart(2, '0')}-${String(new Date(Number(user.subscriptionUntil)).getDate()).padStart(2, '0')}`)
      : new Date(Number(user.subscriptionUntil)).toLocaleDateString('fa-IR'))
    : '';
  document.getElementById('sub-title').textContent = active ? 'اشتراک فعال' : 'اشتراک نداری';
  document.getElementById('sub-detail').textContent = active
    ? (until ? `تا ${until}` : 'این ماه باز است')
    : 'پلنر، گزارش و اسکن با خرید این ماه باز می‌شود';
  document.getElementById('sub-action').textContent = active ? 'تمدید' : 'خرید اشتراک';
  document.getElementById('sub-card').classList.toggle('is-on', active);
}

function stopPlaying() {
  if (playing) {
    playing.pause();
    playing = null;
  }
}

function renderMusic() {
  const box = document.getElementById('music-list');
  box.innerHTML = music.length
    ? music.map((item, i) => `
      <div class="music-item">
        <button type="button" class="play" data-play="${item.id}" aria-label="پخش">▶</button>
        <span>${item.name}</span>
        <button type="button" class="del" data-i="${i}" aria-label="حذف">×</button>
      </div>`).join('')
    : '<span class="note">موزیک‌هایت را از گوشی ایمپورت کن</span>';

  box.querySelectorAll('[data-i]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.i);
      const gone = music.splice(i, 1)[0];
      if (gone?.id) await deleteTrackFile(gone.id);
      renderMusic();
    });
  });

  box.querySelectorAll('[data-play]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = await getTrackFile(btn.dataset.play);
      if (!row?.blob) return;
      if (playing && playing.dataset.id === row.id) {
        if (!playing.paused) { playing.pause(); return; }
      }
      stopPlaying();
      const url = URL.createObjectURL(row.blob);
      playing = new Audio(url);
      playing.dataset.id = row.id;
      playing.play();
      playing.onended = () => { URL.revokeObjectURL(url); stopPlaying(); };
    });
  });
}

function collect() {
  const next = {};
  FIELDS.forEach((key) => { next[key] = document.getElementById(key).value; });
  next.music = music.map((item) => ({ id: item.id, name: item.name }));
  next.diabetes = document.getElementById('cond-diabetes').checked ? '1' : '';
  next.highBp = document.getElementById('cond-bp').checked ? '1' : '';
  next.highChol = document.getElementById('cond-chol').checked ? '1' : '';
  return next;
}

function fill(profile, user) {
  FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el && profile[key]) el.value = profile[key];
  });
  document.getElementById('email').value = user?.email || '';
  document.getElementById('cond-diabetes').checked = profile.diabetes === '1';
  document.getElementById('cond-bp').checked = profile.highBp === '1';
  document.getElementById('cond-chol').checked = profile.highChol === '1';
  if (Array.isArray(profile.music)) {
    music = profile.music.map((item, i) => (
      typeof item === 'string' ? { id: `old-${i}`, name: item } : { id: item.id || `old-${i}`, name: item.name }
    )).filter((item) => item.name);
  } else {
    music = [];
  }
  renderHero();
  renderBmi();
  renderChart();
  renderMusic();
  renderSub();
}

const SHAMSI_IDS = ['birthDate', 'startDate'];
let pick = { id: '', jy: 1404, jm: 1 };

function useShamsi() {
  return typeof I18N !== 'undefined' && I18N.getLang() === 'fa';
}

function syncDateButtons() {
  SHAMSI_IDS.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const value = input.value;
    let btn = input.parentElement.querySelector(`[data-shamsi="${id}"]`);
    if (useShamsi()) {
      input.type = 'text';
      input.value = value;
      input.classList.add('is-shamsi');
      input.readOnly = true;
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shamsi-open';
        btn.dataset.shamsi = id;
        input.after(btn);
        btn.addEventListener('click', () => openPicker(id, btn));
      }
      btn.hidden = false;
      btn.textContent = JALALI.label(value) || 'انتخاب تاریخ';
    } else {
      input.classList.remove('is-shamsi');
      input.readOnly = false;
      input.type = 'date';
      input.value = value;
      if (btn) btn.hidden = true;
      closePicker();
    }
  });
}

function closePicker() {
  document.getElementById('jalali-pop').hidden = true;
}

function shiftMonth(delta) {
  let jm = pick.jm + delta;
  let jy = pick.jy;
  while (jm > 12) { jm -= 12; jy += 1; }
  while (jm < 1) { jm += 12; jy -= 1; }
  pick.jm = jm;
  pick.jy = jy;
  renderPicker();
}

function renderPicker() {
  const days = document.getElementById('jalali-days');
  const selected = JALALI.fromIso(document.getElementById(pick.id).value);
  const today = JALALI.today();
  document.getElementById('jalali-title').textContent = `${JALALI.MONTHS[pick.jm - 1]} ${JALALI.fa(pick.jy)}`;
  const first = JALALI.jalaliToGregorian(pick.jy, pick.jm, 1);
  const offset = (first.getDay() + 1) % 7;
  const length = JALALI.monthLength(pick.jy, pick.jm);
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span></span>');
  for (let day = 1; day <= length; day++) {
    const on = selected && selected.jy === pick.jy && selected.jm === pick.jm && selected.jd === day;
    const now = today.jy === pick.jy && today.jm === pick.jm && today.jd === day;
    cells.push(`<button type="button" data-day="${day}" class="${on ? 'is-on' : ''} ${now ? 'is-today' : ''}">${JALALI.fa(day)}</button>`);
  }
  days.innerHTML = cells.join('');
}

function openPicker(id, btn) {
  pick.id = id;
  const current = JALALI.fromIso(document.getElementById(id).value) || JALALI.today();
  pick.jy = current.jy;
  pick.jm = current.jm;
  const pop = document.getElementById('jalali-pop');
  pop.hidden = false;
  renderPicker();
  const rect = btn.getBoundingClientRect();
  const width = pop.offsetWidth;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = Math.min(rect.bottom + 8, window.innerHeight - pop.offsetHeight - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${Math.max(8, top)}px`;
}

if (!HNP.isLoggedIn()) {
  location.href = 'login.html?next=profile.html';
} else {
  document.getElementById('jalali-week').innerHTML = JALALI.WEEK.map((day) => `<span>${day}</span>`).join('');
  document.getElementById('jalali-pop').addEventListener('click', (e) => {
    const shift = e.target.closest('[data-shift]');
    if (shift) {
      shiftMonth(Number(shift.dataset.shift));
      return;
    }
    const day = e.target.closest('[data-day]');
    if (!day || !pick.id) return;
    const input = document.getElementById(pick.id);
    input.value = JALALI.toIso(pick.jy, pick.jm, Number(day.dataset.day));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    syncDateButtons();
    closePicker();
  });
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('jalali-pop');
    if (pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest('[data-shamsi]')) return;
    closePicker();
  });
  document.addEventListener('i18n:change', syncDateButtons);
  fill(HNP.getProfile(), HNP.currentUser());
  syncDateButtons();
  ['firstName', 'lastName', 'sport', 'birthDate'].forEach((id) => document.getElementById(id).addEventListener('input', renderHero));
  ['heightCm', 'weightKg'].forEach((id) => document.getElementById(id).addEventListener('input', () => { renderBmi(); renderChart(); }));
  ['startWeight', 'targetWeight'].forEach((id) => document.getElementById(id).addEventListener('input', renderChart));

  document.getElementById('music-file').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('audio/'));
    for (const file of files.slice(0, 10)) {
      const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await saveTrackFile(id, file);
      music.push({ id, name: file.name.replace(/\.[^.]+$/, '') });
    }
    e.target.value = '';
    renderMusic();
  });

  document.getElementById('save').addEventListener('click', async () => {
    const err = document.getElementById('err');
    const msg = document.getElementById('msg');
    err.hidden = true;
    msg.hidden = true;
    try {
      await HNP.saveProfile(collect());
      msg.hidden = false;
      msg.textContent = 'اطلاعات ثبت شد.';
    } catch (e) {
      err.hidden = false;
      err.textContent = e.message;
    }
  });

  document.getElementById('out').addEventListener('click', async () => {
    stopPlaying();
    await HNP.logout();
    location.href = 'index.html';
  });
}
