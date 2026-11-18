const BMI_STORAGE_KEY = 'hnp-bmi-profile';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toPersianDigits(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function parseLocalizedNumber(value) {
  if (value == null || value === '') return NaN;
  let s = String(value).trim();
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(PERSIAN_DIGITS[i], String(i));
    s = s.replaceAll(ARABIC_DIGITS[i], String(i));
  }
  s = s.replace(/[^\d.]/g, '');
  return s ? Number(s) : NaN;
}

function classifyBmi(bmi) {
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

function renderBmi(heightCm, weightKg) {
  const bmi = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
  const key = classifyBmi(bmi);
  const box = document.getElementById('bmi-result');
  const line = document.getElementById('bmi-result-line');
  const pin = document.getElementById('bmi-result-pin');
  box.hidden = false;
  box.className = `bmi-result is-${key}`;
  line.className = `bmi-line is-${key}`;
  pin.style.left = `${bmiPinPct(bmi)}%`;
  document.getElementById('bmi-result-num').textContent = String(bmi);
  document.getElementById('bmi-result-status').textContent = I18N.t(`bmi.${key}`);
  document.getElementById('bmi-result-advice').textContent = I18N.t(`bmi.${key}A`);
}

function showError(message) {
  const el = document.getElementById('bmi-error');
  el.hidden = !message;
  el.textContent = message || '';
}

function calculateBmi() {
  const heightCm = parseLocalizedNumber(document.getElementById('bmi-height').value);
  const weightKg = parseLocalizedNumber(document.getElementById('bmi-weight').value);
  if (!heightCm || heightCm < 80 || heightCm > 250) {
    showError(I18N.t('bmi.badHeight'));
    return;
  }
  if (!weightKg || weightKg < 20 || weightKg > 300) {
    showError(I18N.t('bmi.badWeight'));
    return;
  }
  showError('');
  localStorage.setItem(BMI_STORAGE_KEY, JSON.stringify({ heightCm, weightKg }));
  renderBmi(heightCm, weightKg);
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(BMI_STORAGE_KEY) || 'null');
    if (!saved) return;
    if (saved.heightCm) document.getElementById('bmi-height').value = toPersianDigits(saved.heightCm);
    if (saved.weightKg) document.getElementById('bmi-weight').value = toPersianDigits(saved.weightKg);
    if (saved.heightCm && saved.weightKg) renderBmi(saved.heightCm, saved.weightKg);
  } catch {
    /* ignore */
  }
}

const btnBmi = document.getElementById('btn-bmi');
if (btnBmi) {
  btnBmi.addEventListener('click', calculateBmi);
  document.addEventListener('i18n:change', () => {
    const saved = JSON.parse(localStorage.getItem(BMI_STORAGE_KEY) || 'null');
    if (saved?.heightCm && saved?.weightKg) renderBmi(saved.heightCm, saved.weightKg);
  });
  loadSaved();
}
