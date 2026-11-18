const FIELDS = [
  { key: 'fbs', label: 'قند ناشتا' },
  { key: 'hba1c', label: 'HbA1c' },
  { key: 'chol', label: 'کلسترول' },
  { key: 'ldl', label: 'LDL' },
  { key: 'hdl', label: 'HDL' },
  { key: 'tg', label: 'تری‌گلیسرید' },
  { key: 'hb', label: 'هموگلوبین' },
  { key: 'vitd', label: 'ویتامین D' },
  { key: 'b12', label: 'ویتامین B12' },
  { key: 'ferritin', label: 'فریتین' },
  { key: 'tsh', label: 'TSH' },
];

const WATCH = ['vitd', 'b12', 'ferritin', 'tsh'];
let fileChecked = false;

function labNumber(value) {
  let text = String(value || '').trim();
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  for (let i = 0; i < 10; i += 1) text = text.replaceAll(persian[i], String(i));
  text = text.replace(/[^\d.]/g, '');
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function judge(key, value) {
  if (key === 'fbs') {
    if (value < 100) return ['طبیعی', 'ok'];
    if (value < 126) return ['مرزی', 'mid'];
    return ['بالا', 'high'];
  }
  if (key === 'hba1c') {
    if (value < 5.7) return ['طبیعی', 'ok'];
    if (value < 6.5) return ['مرزی', 'mid'];
    return ['بالا', 'high'];
  }
  if (key === 'chol') {
    if (value < 200) return ['طبیعی', 'ok'];
    if (value < 240) return ['مرزی', 'mid'];
    return ['بالا', 'high'];
  }
  if (key === 'ldl') {
    if (value < 130) return ['طبیعی', 'ok'];
    if (value < 160) return ['مرزی', 'mid'];
    return ['بالا', 'high'];
  }
  if (key === 'hdl') {
    if (value < 40) return ['پایین', 'low'];
    if (value >= 60) return ['خوب', 'ok'];
    return ['معمول', 'ok'];
  }
  if (key === 'tg') {
    if (value < 150) return ['طبیعی', 'ok'];
    if (value < 200) return ['مرزی', 'mid'];
    return ['بالا', 'high'];
  }
  if (key === 'vitd') {
    if (value < 20) return ['پایین', 'low'];
    if (value < 30) return ['مرزی', 'mid'];
    if (value <= 100) return ['طبیعی', 'ok'];
    return ['بالا', 'high'];
  }
  if (key === 'b12') {
    if (value < 200) return ['پایین', 'low'];
    if (value < 300) return ['مرزی', 'mid'];
    if (value <= 900) return ['طبیعی', 'ok'];
    return ['بالا', 'high'];
  }
  if (key === 'ferritin') {
    if (value < 30) return ['پایین', 'low'];
    if (value < 50) return ['مرزی', 'mid'];
    if (value <= 200) return ['طبیعی', 'ok'];
    return ['بالا', 'high'];
  }
  if (key === 'tsh') {
    if (value < 0.4) return ['پایین', 'low'];
    if (value <= 4.5) return ['طبیعی', 'ok'];
    if (value <= 10) return ['مرزی', 'mid'];
    return ['بالا', 'high'];
  }
  if (value < 12) return ['پایین', 'low'];
  if (value <= 16) return ['طبیعی', 'ok'];
  return ['بالا', 'high'];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readForm() {
  const values = {};
  FIELDS.forEach((field) => {
    const n = labNumber(document.getElementById(`lab-${field.key}`).value);
    if (n != null) values[field.key] = n;
  });
  return values;
}

function fillForm(items) {
  items.forEach((item) => {
    const input = document.getElementById(`lab-${item.key}`);
    if (input) input.value = String(item.value);
  });
}

function toneOf(key, value) {
  return judge(key, value)[1];
}

function briefHtml(values) {
  const high = [];
  const mid = [];
  const low = [];
  FIELDS.forEach((field) => {
    const value = values[field.key];
    if (value == null) return;
    const tone = toneOf(field.key, value);
    if (tone === 'mid') mid.push(field.label);
    else if (tone === 'ok') low.push(field.label);
    else high.push(field.label);
  });
  const sugar = ['fbs', 'hba1c'].some((key) => values[key] != null && toneOf(key, values[key]) !== 'ok');
  const fat = ['chol', 'ldl', 'tg', 'hdl'].some((key) => values[key] != null && toneOf(key, values[key]) !== 'ok');
  const hbTone = values.hb == null ? '' : toneOf('hb', values.hb);
  const vitdTone = values.vitd == null ? '' : toneOf('vitd', values.vitd);
  const b12Tone = values.b12 == null ? '' : toneOf('b12', values.b12);
  const ferritinTone = values.ferritin == null ? '' : toneOf('ferritin', values.ferritin);
  const tshTone = values.tsh == null ? '' : toneOf('tsh', values.tsh);
  const food = [];
  if (sugar) food.push('برای قند، شیرینی و نوشابه و نان سفید را کم کن و سبزی، حبوبات و غلات کامل را بیشتر بگذار');
  if (fat) food.push('برای چربی خون، سرخ‌کردنی و فست‌فود و چربی حیوانی را کم کن و ماهی، سبزی و روغن زیتون را بیشتر کن');
  if (hbTone === 'low' || ferritinTone === 'low' || ferritinTone === 'mid') food.push('برای آهن و هموگلوبین، عدس، حبوبات و گوشت را در غذا بگذار و مکمل آهن را فقط با نظر پزشک بخور');
  else if (hbTone === 'high' || ferritinTone === 'high') food.push('آهن بالاست؛ مکمل آهن را خودسر شروع نکن');
  if (vitdTone === 'low' || vitdTone === 'mid') food.push('ویتامین D پایین یا لب‌مرز است: ماهی چرب، زرده تخم‌مرغ و لبنیات را بیشتر کن و قرص را با دوز بالا خودسر شروع نکن');
  else if (vitdTone === 'high') food.push('ویتامین D بالاست؛ مکمل را بدون پزشک ادامه نده');
  if (b12Tone === 'low' || b12Tone === 'mid') food.push('برای B12، گوشت، تخم‌مرغ و لبنیات را بیشتر کن');
  if (tshTone && tshTone !== 'ok') food.push('وضعیت تیروئید را با غذا درمان نکن');
  if (!food.length) food.push('این عددها در محدودهٔ ریسک پایین‌اند؛ غذای کم‌نمک با سبزی را ادامه بده');
  const doctors = [];
  const gland = sugar || (vitdTone && vitdTone !== 'ok') || (b12Tone && b12Tone !== 'ok') || (tshTone && tshTone !== 'ok');
  if (sugar && fat) doctors.push('داخلی، و یک‌بار غدد یا قلب');
  else if (gland && fat) doctors.push('داخلی یا غدد، و یک‌بار قلب');
  else if (gland) doctors.push('داخلی یا غدد');
  else if (fat) doctors.push('داخلی یا قلب');
  if (hbTone === 'low' || hbTone === 'high' || ferritinTone === 'low' || ferritinTone === 'high') doctors.push('خون');
  const doctor = doctors.length
    ? `برای همین موردها یک‌بار به ${doctors.join(' و ')} سر بزن.`
    : 'برای چک سالانه، پزشک خانواده کافی است.';
  const line = (title, names, empty) => `<p><b>${title}:</b> ${escapeHtml(names.length ? names.join('، ') : empty)}</p>`;
  return `${line('ریسک بالا', high, 'در این عددها نیست')}${line('لب‌مرز', mid, 'نیست')}${line('ریسک پایین', low, 'نیست')}<p>${escapeHtml(food.join('. '))}. آب حدود ۸ لیوان در روز باشد و نوشیدنی شیرین جای آب را نگیرد. ${escapeHtml(doctor)}</p><p class="auth-note">این تخمین آموزشی است، نه تشخیص پزشکی.</p>`;
}

function showStatus() {
  const values = readForm();
  const box = document.getElementById('lab-result');
  const keys = Object.keys(values);
  if (!keys.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const rows = FIELDS.filter((field) => values[field.key] != null).map((field) => {
    const [word, tone] = judge(field.key, values[field.key]);
    return `<div class="lab-row lab-${tone}"><b>${escapeHtml(field.label)}</b><span>${escapeHtml(String(values[field.key]))}</span><em>${word}</em></div>`;
  });
  const missed = fileChecked
    ? FIELDS.filter((field) => WATCH.includes(field.key) && values[field.key] == null).map((field) => field.label)
    : [];
  const missLine = missed.length
    ? `<p>این‌ها را در فایل ندیدم: ${escapeHtml(missed.join('، '))}. اگر روی برگه هست، عدد را در کادر بنویس.</p>`
    : '';
  box.hidden = false;
  box.innerHTML = `<div class="lab-row lab-head"><b>آزمایش</b><span>عدد</span><em>وضعیت</em></div>${rows.join('')}<div class="lab-brief">${briefHtml(values)}${missLine}</div>`;
}

function showError(text) {
  const el = document.getElementById('lab-error');
  el.hidden = !text;
  el.textContent = text || '';
}

document.getElementById('lab-pick').addEventListener('click', () => {
  document.getElementById('lab-file').click();
});

document.getElementById('lab-file').addEventListener('change', () => {
  const file = document.getElementById('lab-file').files[0];
  const name = document.getElementById('lab-file-name');
  name.hidden = !file;
  name.textContent = file ? file.name : '';
});

function formatWait(sec) {
  const n = Math.max(0, Math.round(sec));
  if (n < 60) return `${n} ثانیه`;
  return `${Math.max(1, Math.round(n / 60))} دقیقه`;
}

function paintProgress(step, total, note, started) {
  const bar = document.getElementById('lab-progress-bar');
  const track = document.getElementById('lab-progress');
  const label = document.getElementById('lab-progress-text');
  const known = total > 0;
  bar.dataset.step = String(step);
  bar.dataset.total = String(total);
  bar.dataset.note = note;
  if (known) {
    track.classList.remove('is-busy');
    bar.style.width = `${Math.max(0, Math.min(100, Math.round((step / total) * 100)))}%`;
  } else if (!track.classList.contains('is-busy')) {
    track.classList.add('is-busy');
    bar.style.width = '';
  }
  const elapsed = (Date.now() - started) / 1000;
  let text = `${note} · ${formatWait(elapsed)} گذشته`;
  if (known && step > 0 && step < total) {
    const left = (elapsed / step) * (total - step);
    text += ` · حدود ${formatWait(left)} مانده`;
  }
  label.textContent = text;
}

async function readProgress(res, started) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('ndjson')) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'خوانده نشد');
    return data;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let payload = null;
  const take = (line) => {
    if (!line.trim()) return;
    const msg = JSON.parse(line);
    if (msg.progress) paintProgress(msg.progress.step, msg.progress.total, msg.progress.text, started);
    if (msg.error) throw new Error(msg.error);
    if (msg.items) payload = msg;
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    lines.forEach(take);
  }
  if (buf.trim()) take(buf);
  if (!payload) throw new Error('خوانده نشد');
  return payload;
}

document.getElementById('lab-read').addEventListener('click', async () => {
  showError('');
  const file = document.getElementById('lab-file').files[0];
  if (file) {
    const body = new FormData();
    body.append('photo', file);
    const wait = document.getElementById('lab-wait');
    const started = Date.now();
    document.getElementById('lab-read').disabled = true;
    wait.hidden = false;
    paintProgress(0, 0, 'فایل را می‌فرستم', started);
    const clock = setInterval(() => paintProgress(
      Number(document.getElementById('lab-progress-bar').dataset.step || 0),
      Number(document.getElementById('lab-progress-bar').dataset.total || 0),
      document.getElementById('lab-progress-bar').dataset.note || 'فایل را می‌فرستم',
      started,
    ), 1000);
    try {
      const res = await fetch('/api/read-lab', { method: 'POST', body });
      const data = await readProgress(res, started);
      FIELDS.forEach((field) => {
        document.getElementById(`lab-${field.key}`).value = '';
      });
      fillForm(data.items || []);
      fileChecked = true;
    } catch (err) {
      showError(err.message || 'خوانده نشد');
    } finally {
      clearInterval(clock);
      wait.hidden = true;
      document.getElementById('lab-read').disabled = false;
    }
  }
  showStatus();
});

FIELDS.forEach((field) => {
  document.getElementById(`lab-${field.key}`).addEventListener('change', showStatus);
});
