const STEPS = ['start', 'camera', 'preview', 'portion', 'loading', 'results'];

const elements = {
  steps: Object.fromEntries(STEPS.map((id) => [id, document.getElementById(`step-${id}`)])),
  modeCards: document.querySelectorAll('.mode-card'),
  btnOpenCamera: document.getElementById('btn-open-camera'),
  fileInput: document.getElementById('file-input'),
  video: document.getElementById('camera-video'),
  canvas: document.getElementById('capture-canvas'),
  btnCapture: document.getElementById('btn-capture'),
  previewImage: document.getElementById('preview-image'),
  portionPreviewImage: document.getElementById('portion-preview-image'),
  btnRetake: document.getElementById('btn-retake'),
  btnAnalyze: document.getElementById('btn-analyze'),
  btnPortionBack: document.getElementById('btn-portion-back'),
  btnConfirmManual: document.getElementById('btn-confirm-manual'),
  btnAddItem: document.getElementById('btn-add-item'),
  portionDishName: document.getElementById('portion-dish-name'),
  portionDishNameEn: document.getElementById('portion-dish-name-en'),
  plateItemsList: document.getElementById('plate-items-list'),
  plateTotalGrams: document.getElementById('plate-total-grams'),
  scanMain: document.querySelector('.scan-main'),
  loadingTexts: document.querySelector('#step-loading .loading-card'),
  btnScanAgain: document.getElementById('btn-scan-again'),
  errorMessage: document.getElementById('error-message'),
  foodNameFa: document.getElementById('food-name-fa'),
  foodNameEn: document.getElementById('food-name-en'),
  confidenceBadge: document.getElementById('confidence-badge'),
  portionNote: document.getElementById('portion-note'),
  componentBreakdown: document.getElementById('component-breakdown'),
  scanNotes: document.getElementById('scan-notes'),
  btnAddScanItem: document.getElementById('btn-add-scan-item'),
  resultImage: document.getElementById('result-image'),
  valCalories: document.getElementById('val-calories'),
  valProtein: document.getElementById('val-protein'),
  valSugar: document.getElementById('val-sugar'),
  valSalt: document.getElementById('val-salt'),
  factsServing: document.getElementById('facts-serving'),
  factsCalories: document.getElementById('facts-calories'),
  factsFat: document.getElementById('facts-fat'),
  factsSatFat: document.getElementById('facts-sat-fat'),
  factsCarbs: document.getElementById('facts-carbs'),
  factsFiber: document.getElementById('facts-fiber'),
  factsSugar: document.getElementById('facts-sugar'),
  factsProtein: document.getElementById('facts-protein'),
  factsSalt: document.getElementById('facts-salt'),
  factsSodium: document.getElementById('facts-sodium'),
  btnSaveMeal: document.getElementById('btn-save-meal'),
  saveStatus: document.getElementById('save-status'),
  linkPlanner: document.getElementById('link-planner'),
  slotPicks: document.querySelectorAll('.slot-pick'),
};

let cameraStream = null;
let capturedBlob = null;
let portionMode = 'auto';
let plateEstimate = null;
let lastResult = null;
let selectedMealSlot = 'lunch';
let selectedSlotPick = 'now';
let lastSaved = null;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function apiUrl(path) {
  const base = String(window.HNP_API || '').replace(/\/$/, '');
  return `${base}${path}`;
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

function toPersianDigits(num) {
  return String(num).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function isManualEntry() {
  return new URLSearchParams(location.search).get('mode') === 'manual';
}

function showStep(stepId) {
  STEPS.forEach((id) => {
    const el = elements.steps[id];
    if (el) el.classList.toggle('active', id === stepId);
  });
  elements.scanMain?.scrollTo(0, 0);
  hideError();
  if (stepId === 'loading') startScanProgress();
  else stopScanProgress();
}

function setLoadingMessage(key) {
  const faEl = elements.loadingTexts.querySelector('.fa-text');
  if (faEl) faEl.textContent = I18N.t(key);
}

let progressTimer = 0;
let progressStarted = 0;

function progressNumber(value) {
  return I18N.getLang() === 'fa' ? toPersianDigits(value) : String(value);
}

function paintScanProgress(shown) {
  const done = Math.max(1, Math.min(100, Math.round(shown)));
  const bar = document.getElementById('load-bar');
  const pct = document.getElementById('load-pct');
  const leftEl = document.getElementById('load-left');
  const wrap = document.getElementById('load-progress');
  const mark = I18N.getLang() === 'en' ? '%' : '٪';
  if (bar) bar.style.width = `${done}%`;
  if (pct) pct.textContent = `${progressNumber(done)}${mark}`;
  if (leftEl) leftEl.textContent = I18N.t('load.done');
  if (wrap) wrap.setAttribute('aria-valuenow', String(done));
  if (done >= 100) setLoadingMessage('load.stageCalc');
  else if (done < 18) setLoadingMessage('load.stageSend');
  else if (done < 62) setLoadingMessage('load.stageSee');
  else setLoadingMessage('load.stageCalc');
}

function startScanProgress() {
  stopScanProgress();
  progressStarted = Date.now();
  paintScanProgress(1);
  progressTimer = setInterval(() => {
    const elapsed = (Date.now() - progressStarted) / 1000;
    const done = Math.min(94, 94 * (1 - Math.exp(-elapsed / 32)));
    paintScanProgress(Math.max(1, done));
  }, 400);
}

function stopScanProgress() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = 0;
}

function finishScanProgress() {
  stopScanProgress();
  paintScanProgress(100);
  return new Promise((resolve) => setTimeout(resolve, 320));
}

function mapScanError(message) {
  const text = String(message || '');
  if (/file too large|LIMIT_FILE_SIZE|payload too large|entity too large/i.test(text)) {
    return I18N.t('err.fileSize');
  }
  return text;
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
}

function hideError() {
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = '';
}

function updatePreviewButtonLabel() {
  const fa = elements.btnAnalyze.querySelector('.fa-text');
  if (!fa) return;
  fa.dataset.i18n = portionMode === 'manual' ? 'preview.continue' : 'preview.analyze';
  fa.textContent = I18N.t(fa.dataset.i18n);
}

function selectMode(mode, advance = false) {
  portionMode = mode;
  elements.modeCards.forEach((card) => {
    card.classList.toggle('selected', card.dataset.mode === mode);
  });
  updatePreviewButtonLabel();
  const title = document.querySelector('.header-title .fa-text');
  if (title) {
    title.dataset.i18n = portionMode === 'manual' ? 'home.f1' : 'scan.title';
    title.textContent = I18N.t(title.dataset.i18n);
  }
  if (advance) {
    showStep('start');
  }
}

function syncPreviewImages(src) {
  elements.previewImage.src = src;
  elements.portionPreviewImage.src = src;
  elements.resultImage.src = src;
}

function updateTotalGrams() {
  const inputs = elements.plateItemsList.querySelectorAll('.item-grams-input');
  let total = 0;
  inputs.forEach((input) => {
    const val = parseLocalizedNumber(input.value);
    if (val > 0) total += val;
  });
  elements.plateTotalGrams.textContent =
    total > 0 ? I18N.t('total.grams', { n: toPersianDigits(total) }) : '';
}

function buildPlateItemRow(item) {
  const row = document.createElement('div');
  row.className = 'plate-item-row';
  row.dataset.itemId = item.id;
  const gramsValue = item.estimatedGrams ? toPersianDigits(item.estimatedGrams) : '';
  row.innerHTML = `
    <div class="plate-item-header">
      <span class="plate-item-index fa-text" data-i18n="portion.part">${I18N.t('portion.part')}</span>
      <button type="button" class="btn-remove-item" data-i18n-aria="portion.remove" aria-label="${I18N.t('portion.remove')}">×</button>
    </div>
    <div class="plate-item-names">
      <input type="text" class="item-name-fa" value="${escapeAttr(item.name.fa || '')}" aria-label="${I18N.t('portion.nameFa')}" placeholder="${I18N.t('portion.nameFa')}">
      <input type="text" class="item-name-en en-sub" value="${escapeAttr(item.name.en || '')}" aria-label="${I18N.t('portion.nameEn')}" placeholder="${I18N.t('portion.nameEn')}">
    </div>
    <div class="plate-item-grams">
      <input type="text" class="portion-input item-grams-input" value="${gramsValue}"
        inputmode="numeric" autocomplete="off" aria-label="${I18N.t('portion.grams')}" placeholder="150">
      <span class="grams-label fa-text" data-i18n="portion.grams">${I18N.t('portion.grams')}</span>
      <span class="grams-label en-sub">g</span>
    </div>
  `;
  row.querySelector('.item-grams-input').addEventListener('input', updateTotalGrams);
  row.querySelector('.btn-remove-item').addEventListener('click', () => {
    row.remove();
    updateTotalGrams();
  });
  return row;
}

function addPlateItem() {
  const id = `item-${Date.now()}`;
  elements.plateItemsList.appendChild(
    buildPlateItemRow({
      id,
      name: { fa: '', en: '' },
      estimatedGrams: null,
    })
  );
  updateTotalGrams();
  elements.plateItemsList.lastElementChild?.querySelector('.item-name-fa')?.focus();
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function renderPlateEditForm(estimate) {
  plateEstimate = estimate;

  elements.portionDishName.textContent = I18N.nameOf(estimate.foodName) || I18N.t('portion.items');
  if (elements.portionDishNameEn) {
    elements.portionDishNameEn.textContent = estimate.foodName?.en || I18N.t('portion.items');
  }

  elements.plateItemsList.innerHTML = '';
  estimate.items.forEach((item) => {
    elements.plateItemsList.appendChild(buildPlateItemRow(item));
  });

  updateTotalGrams();
}

function getConfirmedItems() {
  const rows = elements.plateItemsList.querySelectorAll('.plate-item-row');
  const items = [];

  rows.forEach((row, index) => {
    const grams = parseLocalizedNumber(row.querySelector('.item-grams-input').value);
    const fa = row.querySelector('.item-name-fa').value.trim();
    const en = row.querySelector('.item-name-en').value.trim();

    if (Number.isNaN(grams) || grams <= 0) {
      throw new Error(I18N.t('err.weight'));
    }

    items.push({
      id: row.dataset.itemId || `item-${index + 1}`,
      name: { fa: fa || `مورد ${index + 1}`, en: en || `Item ${index + 1}` },
      grams: Math.round(grams),
    });
  });

  if (!items.length) {
    throw new Error(I18N.t('err.minItem'));
  }

  return items;
}

function appendPortionToFormData(formData) {
  formData.append('portionMode', portionMode);

  if (portionMode === 'manual') {
    const items = getConfirmedItems();
    formData.append('items', JSON.stringify(items));
    formData.append('plateEstimate', JSON.stringify(plateEstimate));
  }
}

function cameraNeedsHttps() {
  return location.protocol !== 'https:'
    && location.hostname !== 'localhost'
    && location.hostname !== '127.0.0.1';
}

async function startCamera() {
  if (cameraNeedsHttps()) {
    location.href = `https://${location.hostname}:3443/scan.html#open-camera`;
    return;
  }
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    elements.video.srcObject = cameraStream;
    showStep('camera');
  } catch {
    showError(I18N.t('err.camera'));
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  elements.video.srcObject = null;
}

async function estimateAndShowEditForm() {
  if (!capturedBlob) return;

  showStep('loading');
  setLoadingMessage('load.estimate');

  try {
    const data = await HNP_OPENROUTER_SCAN.estimate(capturedBlob);

    renderPlateEditForm(data);
    await finishScanProgress();
    showStep('portion');
  } catch (err) {
    showStep('preview');
    showError(`${I18N.t('err.estimate')}: ${mapScanError(err.message)}`);
  }
}

async function goToPreview() {
  if (portionMode === 'manual') {
    await estimateAndShowEditForm();
  } else {
    await analyzeFood();
  }
}

const SCAN_MAX_EDGE = 1024;
const SCAN_JPEG_QUALITY = 0.82;

function fitScanSize(width, height) {
  const scale = Math.min(1, SCAN_MAX_EDGE / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToJpeg(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', SCAN_JPEG_QUALITY);
  });
}

async function compressPhoto(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  try {
    const size = fitScanSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, size.width, size.height);
    return (await canvasToJpeg(canvas)) || file;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}

function capturePhoto() {
  const video = elements.video;
  const canvas = elements.canvas;
  const size = fitScanSize(video.videoWidth, video.videoHeight);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, size.width, size.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    capturedBlob = blob;
    syncPreviewImages(URL.createObjectURL(blob));
    stopCamera();
    showStep('preview');
  }, 'image/jpeg', SCAN_JPEG_QUALITY);
}

async function handleFileSelect(file) {
  if (!file) return;
  const type = String(file.type || '').toLowerCase();
  if (type && !type.startsWith('image/')) return;
  try {
    capturedBlob = await compressPhoto(file);
    syncPreviewImages(URL.createObjectURL(capturedBlob));
    stopCamera();
    showStep('preview');
  } catch {
    showError(I18N.t('err.fileSize'));
  }
}

async function analyzeFood() {
  if (!capturedBlob) return;

  try {
    if (portionMode === 'manual') {
      getConfirmedItems();
    }
  } catch (err) {
    showError(err.message);
    return;
  }

  showStep('loading');
  setLoadingMessage('load.calc');
  elements.btnAnalyze.disabled = true;
  elements.btnConfirmManual.disabled = true;

  try {
    const data = await HNP_OPENROUTER_SCAN.analyze(capturedBlob, {
      mode: portionMode,
      items: portionMode === 'manual' ? getConfirmedItems() : null,
    });

    renderResults(data);
    highlightMealSlot('now');
    resetSaveUi();
    await finishScanProgress();
    showStep('results');
  } catch (err) {
    showStep(portionMode === 'manual' ? 'portion' : 'preview');
    showError(`${I18N.t('err.analyze')}: ${mapScanError(err.message)}`);
  } finally {
    elements.btnAnalyze.disabled = false;
    elements.btnConfirmManual.disabled = false;
  }
}

function gramsLabel(value) {
  const n = formatNumber(value);
  return n === '—' ? '—' : `${n} g`;
}

function renderNutritionFacts(data) {
  const totalGrams = data.components?.length
    ? data.components.reduce((sum, item) => sum + (Number(item.grams) || 0), 0)
    : null;
  const n = totalGrams ? Math.round(totalGrams) : null;
  elements.factsServing.textContent = n
    ? I18N.t('facts.servingGrams', { n })
    : I18N.t('facts.servingPlate');

  const salt = Number(data.salt);
  const sodiumMg = Number.isFinite(salt) ? Math.round(salt * 400) : null;

  elements.factsCalories.textContent = formatNumber(data.calories);
  elements.factsFat.textContent = gramsLabel(data.fat);
  elements.factsSatFat.textContent = gramsLabel(data.saturatedFat);
  elements.factsCarbs.textContent = gramsLabel(data.carbs);
  elements.factsFiber.textContent = gramsLabel(data.fiber);
  elements.factsSugar.textContent = gramsLabel(data.sugar);
  elements.factsProtein.textContent = gramsLabel(data.protein);
  elements.factsSalt.textContent = gramsLabel(data.salt);
  elements.factsSodium.textContent = sodiumMg == null ? '—' : `${sodiumMg} mg`;
}

function renderResults(data) {
  lastResult = data;
  elements.foodNameFa.textContent = I18N.nameOf(data.foodName) || I18N.t('food.unknown');
  if (elements.foodNameEn) {
    elements.foodNameEn.textContent = data.foodName?.en || '';
  }

  const confKey = ['high', 'medium', 'low'].includes(data.confidence)
    ? `conf.${data.confidence}`
    : 'conf.medium';
  elements.confidenceBadge.textContent = I18N.t(confKey);

  elements.portionNote.textContent = I18N.nameOf(data.portionNote) || '';

  elements.valCalories.textContent = formatNumber(data.calories);
  elements.valProtein.textContent = formatNumber(data.protein);
  elements.valSugar.textContent = formatNumber(data.sugar);
  elements.valSalt.textContent = formatNumber(data.salt);

  renderNutritionFacts(data);
  setFactsOpen(false);
  renderScanNotes(data);
  renderComponentEditors(data);
}

function scaleMacro(base, baseGrams, grams) {
  if (!baseGrams) return 0;
  return Math.round((Number(base) || 0) * (grams / baseGrams) * 10) / 10;
}

function attachScanBases(data) {
  (data.components || []).forEach((item) => {
    if (item._baseGrams) return;
    item._baseGrams = Number(item.grams) || 0;
    item._baseCalories = Number(item.calories) || 0;
    item._baseProtein = Number(item.protein) || 0;
    item._baseFat = Number(item.fat) || 0;
    item._baseCarbs = Number(item.carbs) || 0;
    item._baseFiber = Number(item.fiber) || 0;
    item._baseSugar = Number(item.sugar) || 0;
    item._baseSalt = Number(item.salt) || 0;
  });
}

function applyComponentScales(data) {
  attachScanBases(data);
  (data.components || []).forEach((item) => {
    const grams = Number(item.grams) || 0;
    item.calories = scaleMacro(item._baseCalories, item._baseGrams, grams);
    item.protein = scaleMacro(item._baseProtein, item._baseGrams, grams);
    item.fat = scaleMacro(item._baseFat, item._baseGrams, grams);
    item.carbs = scaleMacro(item._baseCarbs, item._baseGrams, grams);
    item.fiber = scaleMacro(item._baseFiber, item._baseGrams, grams);
    item.sugar = scaleMacro(item._baseSugar, item._baseGrams, grams);
    item.salt = scaleMacro(item._baseSalt, item._baseGrams, grams);
  });
  const rows = data.components || [];
  if (!rows.length) return;
  data.calories = rows.reduce((sum, row) => sum + (Number(row.calories) || 0), 0);
  data.sugar = rows.reduce((sum, row) => sum + (Number(row.sugar) || 0), 0);
  if (rows.some((row) => row._baseProtein > 0)) {
    data.protein = rows.reduce((sum, row) => sum + (Number(row.protein) || 0), 0);
  }
  if (rows.some((row) => row._baseFat > 0)) {
    data.fat = rows.reduce((sum, row) => sum + (Number(row.fat) || 0), 0);
  }
  if (rows.some((row) => row._baseCarbs > 0)) {
    data.carbs = rows.reduce((sum, row) => sum + (Number(row.carbs) || 0), 0);
  }
  if (rows.some((row) => row._baseFiber > 0)) {
    data.fiber = rows.reduce((sum, row) => sum + (Number(row.fiber) || 0), 0);
  }
  if (rows.some((row) => row._baseSalt > 0)) {
    data.salt = rows.reduce((sum, row) => sum + (Number(row.salt) || 0), 0);
  }
}

function renderScanNotes(data) {
  const el = elements.scanNotes;
  if (!el) return;
  const lines = [I18N.t('scan.estOnly')]
    .concat(data.assumptions || [])
    .concat(data.uncertainties || []);
  el.hidden = false;
  el.replaceChildren();
  lines.forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    el.appendChild(p);
  });
}

function renderComponentEditors(data) {
  const list = elements.componentBreakdown;
  const addBtn = elements.btnAddScanItem;
  if (!list) return;
  attachScanBases(data);
  const rows = data.components || [];
  if (!rows.length) {
    list.hidden = true;
    list.replaceChildren();
    if (addBtn) addBtn.hidden = false;
    return;
  }
  list.hidden = false;
  if (addBtn) addBtn.hidden = false;
  list.replaceChildren();
  rows.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'breakdown-row edit';
    const name = document.createElement('input');
    name.className = 'item-name-fa';
    name.value = I18N.nameOf(item.name) || item.name?.fa || '';
    name.addEventListener('input', () => {
      const value = name.value.trim();
      item.name = item.name || {};
      item.name.fa = value;
      if (I18N.getLang() === 'en') item.name.en = value;
      if (I18N.getLang() === 'ar') item.name.ar = value;
    });
    const grams = document.createElement('input');
    grams.className = 'item-grams';
    grams.type = 'number';
    grams.min = '1';
    grams.step = '1';
    grams.value = String(Math.round(Number(item.grams) || 0));
    grams.setAttribute('aria-label', I18N.t('scan.grams'));
    grams.addEventListener('change', () => {
      const next = parseLocalizedNumber(grams.value);
      if (!Number.isFinite(next) || next <= 0) {
        grams.value = String(Math.round(Number(item.grams) || 1));
        return;
      }
      item.grams = Math.round(next);
      applyComponentScales(data);
      renderResults(data);
    });
    const meta = document.createElement('span');
    meta.className = 'breakdown-meta';
    const sugar = formatNumber(item.sugar);
    const sugarPart = sugar === '—' ? '' : ` · ${I18N.t('sugar.short')} ${sugar}g`;
    meta.textContent = `${item.grams}g · ${formatNumber(item.calories)} kcal${sugarPart}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-remove-item';
    remove.textContent = I18N.t('scan.removeItem');
    remove.addEventListener('click', () => {
      data.components.splice(index, 1);
      applyComponentScales(data);
      renderResults(data);
    });
    row.append(name, grams, meta, remove);
    list.appendChild(row);
  });
}

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Math.round(Number(value) * 10) / 10;
}

function resetPortionForm() {
  plateEstimate = null;
  elements.plateItemsList.innerHTML = '';
  elements.plateTotalGrams.textContent = '';
  elements.componentBreakdown.hidden = true;
  elements.componentBreakdown.innerHTML = '';
}

function setFactsOpen(open) {
  const panel = document.getElementById('facts-panel');
  const btn = document.getElementById('btn-facts');
  if (panel) panel.hidden = !open;
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function resetSaveUi() {
  if (elements.saveStatus) {
    elements.saveStatus.hidden = true;
    elements.saveStatus.textContent = '';
  }
  if (elements.linkPlanner) elements.linkPlanner.hidden = true;
}

function highlightMealSlot(pick) {
  selectedSlotPick = pick;
  selectedMealSlot = pick === 'now' ? HNP.guessSlot() : pick;
  elements.slotPicks.forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.slot === pick);
  });
}

function saveMealToPlanner({ openPlan = false } = {}) {
  if (!lastResult) {
    showError(I18N.t('photo.fail'));
    return;
  }
  const slot = selectedMealSlot === 'now' ? HNP.guessSlot() : selectedMealSlot || HNP.guessSlot();
  const date = HNP.dateKey(new Date());
  try {
    if (lastSaved) {
      HNP.SLOT_ORDER.forEach((prev) => HNP.removeMeal(lastSaved.date, prev, lastSaved.id));
    }
    const meal = HNP.mealFromScan(lastResult, slot, date);
    if (lastSaved?.id) meal.id = lastSaved.id;
    HNP.saveLastScan(lastResult);
    HNP.addMeal(meal);
    lastSaved = { date, slot, id: meal.id };
    const check = HNP.slotStatus(date, slot);
    let msg = I18N.t('saved.as', { slot: I18N.t(`slot.${slot}`) });
    if (check.status !== 'none') msg += ' — ' + I18N.t(`alert.${check.status}`);
    elements.saveStatus.hidden = false;
    elements.saveStatus.textContent = msg;
    const planHref = `plan.html?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slot)}`;
    if (elements.linkPlanner) {
      elements.linkPlanner.hidden = false;
      elements.linkPlanner.href = planHref;
    }
    if (openPlan) location.assign(planHref);
  } catch (err) {
    showError(err.message || I18N.t('photo.fail'));
  }
}

function resetScan() {
  capturedBlob = null;
  lastSaved = null;
  selectMode(isManualEntry() ? 'manual' : 'auto');
  resetPortionForm();
  stopCamera();
  showStep('start');
}

elements.btnOpenCamera.addEventListener('click', startCamera);
elements.btnCapture.addEventListener('click', capturePhoto);
elements.fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
elements.btnRetake.addEventListener('click', startCamera);
elements.btnAnalyze.addEventListener('click', goToPreview);
elements.btnPortionBack.addEventListener('click', () => showStep('preview'));
elements.btnConfirmManual.addEventListener('click', analyzeFood);
elements.btnAddItem.addEventListener('click', addPlateItem);
elements.btnScanAgain.addEventListener('click', resetScan);
if (elements.btnAddScanItem) {
  elements.btnAddScanItem.addEventListener('click', () => {
    if (!lastResult) return;
    lastResult.components = lastResult.components || [];
    lastResult.components.push({
      name: { fa: '', en: '', ar: '' },
      grams: 50,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      salt: 0,
      _baseGrams: 50,
      _baseCalories: 0,
      _baseProtein: 0,
      _baseFat: 0,
      _baseCarbs: 0,
      _baseFiber: 0,
      _baseSugar: 0,
      _baseSalt: 0,
    });
    renderResults(lastResult);
  });
}
elements.slotPicks.forEach((btn) => {
  btn.addEventListener('click', () => highlightMealSlot(btn.dataset.slot));
});
if (elements.btnSaveMeal) {
  elements.btnSaveMeal.addEventListener('click', () => saveMealToPlanner({ openPlan: true }));
}
document.getElementById('btn-facts')?.addEventListener('click', () => {
  const panel = document.getElementById('facts-panel');
  setFactsOpen(Boolean(panel?.hidden));
});
window.addEventListener('pagehide', stopCamera);
document.addEventListener('i18n:change', () => {
  updatePreviewButtonLabel();
  selectMode(portionMode);
  if (lastResult) renderResults(lastResult);
});
selectMode(isManualEntry() ? 'manual' : 'auto');
if (location.hash === '#open-camera' && !cameraNeedsHttps()) startCamera();
