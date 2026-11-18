const VITAL_KEY = 'hnp-vitals';

function vitalStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(VITAL_KEY) || '{}');
    return {
      days: raw.days && typeof raw.days === 'object' ? raw.days : {},
      pulseHistory: Array.isArray(raw.pulseHistory) ? raw.pulseHistory : null,
    };
  } catch {
    return { days: {}, pulseHistory: null };
  }
}

function saveVitals(store) {
  localStorage.setItem(VITAL_KEY, JSON.stringify(store));
}

function todayKey() {
  return HNP.dateKey(new Date());
}

function todayVitals() {
  return vitalStore().days[todayKey()] || {};
}

function writeToday(patch) {
  const store = vitalStore();
  store.days[todayKey()] = { ...todayVitals(), ...patch };
  saveVitals(store);
}

function escapeHistory(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function historyWhen(at) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return at;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function pulseRows(store) {
  if (Array.isArray(store.pulseHistory)) return store.pulseHistory.slice(0, 2);
  return Object.keys(store.days)
    .sort()
    .reverse()
    .map((key) => {
      const day = store.days[key] || {};
      if (!day.heart && !day.spo2) return null;
      return { at: key, heart: day.heart || '', spo2: day.spo2 || '' };
    })
    .filter(Boolean)
    .slice(0, 2);
}

function renderPulseHistory(rows) {
  const list = document.getElementById('pulse-history');
  const kept = (rows || []).slice(0, 2);
  list.hidden = !kept.length;
  list.innerHTML = kept.map((row) => (
    `<li><b>${escapeHistory(historyWhen(row.at))}</b><span>ضربان ${escapeHistory(row.heart || '—')}</span><span>اکسیژن ${escapeHistory(row.spo2 || '—')}</span></li>`
  )).join('');
}

function loadPulseHistory() {
  const store = vitalStore();
  const rows = pulseRows(store).slice(0, 2);
  if (!Array.isArray(store.pulseHistory) || store.pulseHistory.length !== rows.length) {
    store.pulseHistory = rows;
    saveVitals(store);
  }
  return rows;
}

function rememberPulse(heart, spo2) {
  const store = vitalStore();
  const row = {
    at: new Date().toISOString(),
    heart: String(heart),
    spo2: spo2 ? String(spo2) : '',
  };
  const prev = Array.isArray(store.pulseHistory) ? store.pulseHistory : pulseRows(store);
  store.pulseHistory = [row, ...prev].slice(0, 2);
  store.days[todayKey()] = {
    ...(store.days[todayKey()] || {}),
    heart: row.heart,
    ...(row.spo2 ? { spo2: row.spo2 } : {}),
  };
  saveVitals(store);
  renderPulseHistory(store.pulseHistory);
}

const traceValues = [];
const TRACE_MAX = 220;

function showBpm(value) {
  document.getElementById('pulse-num').textContent = value ? String(value) : '—';
}

function showO2(value) {
  const el = document.getElementById('pulse-o2');
  el.textContent = value ? String(value) : '—';
  el.classList.toggle('is-low', Boolean(value) && Number(value) < 95);
}

function drawTrace() {
  const canvas = document.getElementById('pulse-trace');
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(280, Math.floor((canvas.clientWidth || 320) * ratio));
  const height = Math.max(80, Math.floor(116 * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.16)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 28 * ratio) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 28 * ratio) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.lineWidth = Math.max(2, 2.2 * ratio);
  ctx.strokeStyle = '#fb7185';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (traceValues.length < 2) {
    const mid = height * 0.62;
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
    return;
  }
  const win = 8;
  const wave = traceValues.map((value, index) => {
    const start = Math.max(0, index - win);
    const end = Math.min(traceValues.length, index + win + 1);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += traceValues[i];
    return value - sum / (end - start);
  });
  let min = Infinity;
  let max = -Infinity;
  wave.forEach((value) => {
    if (value < min) min = value;
    if (value > max) max = value;
  });
  const span = Math.max(5, max - min);
  const step = width / (TRACE_MAX - 1);
  wave.forEach((value, index) => {
    const x = width - (wave.length - 1 - index) * step;
    const y = height * 0.78 - ((value - min) / span) * (height * 0.56);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function pushTrace(value) {
  traceValues.push(value);
  if (traceValues.length > TRACE_MAX) traceValues.shift();
  drawTrace();
}

function clearTrace() {
  traceValues.length = 0;
  drawTrace();
}

function fillGoals() {
  const day = todayVitals();
  showBpm('');
  showO2('');
  renderPulseHistory(loadPulseHistory());
  document.getElementById('vital-sys').value = day.sys || '';
  document.getElementById('vital-dia').value = day.dia || '';
  document.getElementById('vital-sugar').value = day.sugar || '';
  paintSteps();
}

const STEP_GOAL = 8000;
let stepWatching = false;
let lastMag = 0;
let lastStepAt = 0;

function faStep(n) {
  return Number(n || 0).toLocaleString('fa-IR');
}

function todaySteps() {
  return Number(todayVitals().steps) || 0;
}

function paintSteps() {
  const n = todaySteps();
  const count = document.getElementById('step-count');
  const bar = document.getElementById('step-bar');
  const label = document.getElementById('step-goal-label');
  const toggle = document.getElementById('step-toggle');
  if (count) count.textContent = faStep(n);
  if (label) label.textContent = `از ${faStep(STEP_GOAL)} قدم امروز`;
  if (bar) bar.style.width = `${Math.min(100, Math.round((n / STEP_GOAL) * 100))}%`;
  if (toggle) toggle.textContent = stepWatching ? 'توقف شمارش' : 'شروع شمارش';
}

function onStepMotion(event) {
  const acc = event.accelerationIncludingGravity || event.acceleration;
  if (!acc) return;
  const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
  const delta = mag - lastMag;
  lastMag = mag;
  if (delta > 1.35 && Date.now() - lastStepAt > 320) {
    lastStepAt = Date.now();
    writeToday({ steps: todaySteps() + 1 });
    paintSteps();
  }
}

async function startSteps() {
  const msg = document.getElementById('step-msg');
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const ok = await DeviceMotionEvent.requestPermission();
      if (ok !== 'granted') throw new Error('اجازهٔ حرکت گوشی داده نشد');
    }
    window.addEventListener('devicemotion', onStepMotion);
    stepWatching = true;
    if (msg) msg.hidden = true;
    paintSteps();
  } catch (err) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = err.message || 'قدم‌شمار روی این دستگاه فعال نشد';
    }
  }
}

function stopSteps() {
  window.removeEventListener('devicemotion', onStepMotion);
  stepWatching = false;
  paintSteps();
}

document.getElementById('step-toggle')?.addEventListener('click', () => {
  if (stepWatching) stopSteps();
  else startSteps();
});

document.querySelectorAll('.goal-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.goal-tabs .tab').forEach((el) => el.classList.toggle('active', el === btn));
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== btn.dataset.tab;
    });
  });
});

document.getElementById('save-pressure').addEventListener('click', () => {
  writeToday({
    sys: document.getElementById('vital-sys').value.trim(),
    dia: document.getElementById('vital-dia').value.trim(),
  });
  const msg = document.getElementById('pressure-msg');
  msg.hidden = false;
  msg.textContent = 'فشار امروز ثبت شد';
});

document.getElementById('save-sugar').addEventListener('click', () => {
  writeToday({ sugar: document.getElementById('vital-sugar').value.trim() });
  const msg = document.getElementById('sugar-msg');
  msg.hidden = false;
  msg.textContent = 'قند امروز ثبت شد';
});

let pulseStream = null;
let pulseTimer = 0;
let pulseSamples = [];
let pulseCoveredSince = 0;
const pulseCanvas = document.createElement('canvas');
pulseCanvas.width = 32;
pulseCanvas.height = 32;
const pulseCtx = pulseCanvas.getContext('2d', { willReadFrequently: true });

function pulseStatus(text) {
  document.getElementById('pulse-status').textContent = text;
}

function torchStatus(text) {
  const el = document.getElementById('pulse-torch');
  if (el) el.textContent = text || '';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setTorch(track, on) {
  if (!track || track.readyState !== 'live') return false;
  const caps = track.getCapabilities?.() || {};
  if (caps.torch === false) return false;
  const attempts = [{ advanced: [{ torch: on }] }, { torch: on }];
  for (let round = 0; round < 4; round += 1) {
    for (const constraints of attempts) {
      try {
        await track.applyConstraints(constraints);
      } catch { /* این شکل از دستور چراغ را قبول نکرد */ }
      if (track.getSettings?.().torch === on) return true;
    }
    if (!pulseStream) return false;
    await wait(250);
  }
  return track.getSettings?.().torch === on;
}

function stopPulse(keepTrace) {
  if (pulseTimer) cancelAnimationFrame(pulseTimer);
  pulseTimer = 0;
  pulseSamples = [];
  pulseCoveredSince = 0;
  if (!keepTrace) clearTrace();
  if (pulseStream) {
    pulseStream.getTracks().forEach((track) => {
      const off = track.applyConstraints?.({ advanced: [{ torch: false }] });
      if (off && typeof off.then === 'function') off.catch(() => {});
      track.stop();
    });
    pulseStream = null;
  }
  const video = document.getElementById('pulse-video');
  video.srcObject = null;
  document.getElementById('pulse-box').hidden = true;
  document.getElementById('pulse-start').hidden = false;
  torchStatus('');
}

function fingerOnLens(data) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let open = 0;
  let allRed = 0;
  let allGreen = 0;
  let allBlue = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    allRed += r;
    allGreen += g;
    allBlue += b;
    if (r >= 250) continue;
    red += r;
    green += g;
    blue += b;
    open += 1;
  }
  const meanRed = allRed / pixels;
  const meanGreen = allGreen / pixels;
  const covered = meanRed > 70 && meanRed > meanGreen * 1.15;
  if (open >= pixels * 0.15) {
    return { red: red / open, green: green / open, blue: blue / open, covered };
  }
  return { red: meanRed, green: meanGreen, blue: allBlue / pixels, covered };
}

function bpmFromSamples(samples) {
  if (samples.length < 40) return null;
  const values = samples.map((sample) => sample.v);
  const win = 12;
  const wave = values.map((value, index) => {
    const start = Math.max(0, index - win);
    const end = Math.min(values.length, index + win + 1);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += values[i];
    return value - sum / (end - start);
  });
  let sum = 0;
  let sumSq = 0;
  wave.forEach((value) => {
    sum += value;
    sumSq += value * value;
  });
  const mean = sum / wave.length;
  const deviation = Math.sqrt(Math.max(0, sumSq / wave.length - mean * mean));
  const threshold = mean + deviation * 0.45;
  const beats = [];
  let last = -Infinity;
  for (let i = 1; i < wave.length - 1; i += 1) {
    if (wave[i] <= wave[i - 1] || wave[i] < wave[i + 1] || wave[i] < threshold) continue;
    const time = samples[i].t;
    if (time - last < 330) continue;
    beats.push(time);
    last = time;
  }
  if (beats.length < 4) return null;
  const gaps = [];
  for (let i = 1; i < beats.length; i += 1) gaps.push(beats[i] - beats[i - 1]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const kept = gaps.filter((gap) => gap > 330 && gap < 1500 && Math.abs(gap - mid) < mid * 0.4);
  if (kept.length < 3) return null;
  const average = kept.reduce((total, gap) => total + gap, 0) / kept.length;
  const bpm = Math.round(60000 / average);
  return bpm >= 40 && bpm <= 180 ? bpm : null;
}

function channelPulse(samples, key) {
  const values = samples.map((sample) => sample[key]).filter((value) => Number.isFinite(value));
  if (values.length < 40) return null;
  const dc = values.reduce((total, value) => total + value, 0) / values.length;
  const win = 12;
  let sumSq = 0;
  values.forEach((value, index) => {
    const start = Math.max(0, index - win);
    const end = Math.min(values.length, index + win + 1);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += values[i];
    const ac = value - sum / (end - start);
    sumSq += ac * ac;
  });
  const ac = Math.sqrt(sumSq / values.length);
  if (dc < 1 || ac < 0.02) return null;
  return ac / dc;
}

function spo2FromSamples(samples) {
  const red = channelPulse(samples, 'v');
  const green = channelPulse(samples, 'g');
  const blue = channelPulse(samples, 'b');
  const other = green || blue;
  let ratio = null;
  if (red && other) ratio = red / other;
  else if (green && blue) ratio = green / blue;
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0 || ratio > 3) return null;
  const spo2 = Math.round(110 - 25 * ratio);
  if (!Number.isFinite(spo2)) return null;
  if (spo2 >= 100) return 99;
  if (spo2 <= 85) return 85;
  return spo2;
}

function readPulseFrame(video) {
  if (!pulseStream) return;
  const now = performance.now();
  const last = pulseSamples[pulseSamples.length - 1];
  if (!last || now - last.t >= 33) {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w && h) {
      const size = Math.max(8, Math.floor(Math.min(w, h) * 0.35));
      pulseCtx.drawImage(video, (w - size) / 2, (h - size) / 2, size, size, 0, 0, 32, 32);
      const frame = fingerOnLens(pulseCtx.getImageData(0, 0, 32, 32).data);
      if (!frame.covered) {
        pulseSamples = [];
        pulseCoveredSince = 0;
        clearTrace();
        pulseStatus('انگشت را کامل روی لنز دوربین عقب بگذار تا صفحه قرمز شود.');
      } else {
        if (!pulseCoveredSince) pulseCoveredSince = now;
        pulseSamples.push({ t: now, v: frame.red, g: frame.green, b: frame.blue });
        pushTrace(frame.red);
        const elapsed = Math.round((now - pulseCoveredSince) / 1000);
        const live = elapsed >= 8 ? bpmFromSamples(pulseSamples) : null;
        const liveO2 = elapsed >= 8 ? spo2FromSamples(pulseSamples) : null;
        if (live) showBpm(live);
        if (liveO2) showO2(liveO2);
        const bits = [`انگشت را نگه دار. ${Math.min(elapsed, 15)} ثانیه`];
        if (live) bits[0] = `ضربان حدود ${live}`;
        if (liveO2) bits.push(`اکسیژن حدود ${liveO2}`);
        pulseStatus(bits.join(' · '));
        if (elapsed >= 15) {
          const bpm = bpmFromSamples(pulseSamples);
          const spo2 = spo2FromSamples(pulseSamples);
          if (bpm) {
            rememberPulse(bpm, spo2);
            showBpm(bpm);
            if (spo2) showO2(spo2);
            stopPulse(true);
            return;
          }
          if (elapsed >= 20) {
            pulseStatus('ضربان خوانده نشد. انگشت را آرام‌تر و کامل‌تر روی لنز بگذار و دوباره بزن.');
            stopPulse();
            document.getElementById('pulse-box').hidden = false;
            document.getElementById('pulse-start').hidden = true;
            return;
          }
        }
      }
    }
  }
  pulseTimer = requestAnimationFrame(() => readPulseFrame(video));
}

async function startPulse() {
  stopPulse();
  document.getElementById('pulse-box').hidden = false;
  document.getElementById('pulse-start').hidden = true;
  pulseStatus('دوربین عقب روشن می‌شود. انگشت را روی لنز بگذار.');
  torchStatus('دارم چراغ را روشن می‌کنم.');
  const attempts = [
    { video: { facingMode: { exact: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
  ];
  let stream = null;
  let lastError = null;
  for (const constraints of attempts) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!stream) {
    document.getElementById('pulse-start').hidden = false;
    pulseStatus(lastError && lastError.name === 'NotAllowedError'
      ? 'اجازه دوربین داده نشد.'
      : 'دوربین عقب باز نشد.');
    return;
  }
  pulseStream = stream;
  const video = document.getElementById('pulse-video');
  video.srcObject = stream;
  await video.play().catch(() => {});
  const track = stream.getVideoTracks()[0];
  track.addEventListener('unmute', () => {
    setTorch(track, true).catch(() => {});
  });
  const torchOn = await setTorch(track, true);
  if (!pulseStream) return;
  torchStatus(torchOn ? 'چراغ روشن است.' : 'این مرورگر فلاش را روشن نمی‌کند.');
  pulseSamples = [];
  pulseCoveredSince = 0;
  pulseTimer = requestAnimationFrame(() => readPulseFrame(video));
}

const pulseStart = document.getElementById('pulse-start');
const needsSecurePage = location.protocol !== 'https:'
  && location.hostname !== 'localhost'
  && location.hostname !== '127.0.0.1';
if (needsSecurePage) {
  pulseStart.href = `https://${location.hostname}:3443/goals.html`;
} else {
  pulseStart.addEventListener('click', (event) => {
    event.preventDefault();
    startPulse().catch(() => pulseStatus('دوربین باز نشد. اجازه دوربین را بده.'));
  });
}
document.getElementById('pulse-stop').addEventListener('click', () => stopPulse(false));
window.addEventListener('pagehide', stopPulse);

fillGoals();
drawTrace();
window.addEventListener('resize', drawTrace);
