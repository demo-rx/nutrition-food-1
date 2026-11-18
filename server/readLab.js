const zlib = require('zlib');
const { callOllamaVision, ollamaHost, ollamaModel } = require('./ollamaVision');
const { extractPlanText } = require('./extractPlanText');

const LAB_PROMPT = `This is a blood test report in Persian or English.
Read every allowed marker you can actually see. Do not stop after the first number. Do not guess.
Use the patient result, not the reference range printed beside it.
Return ONLY JSON. The sample below shows the shape, not the patient's numbers:
{"items":[{"key":"fbs","value":95,"unit":"mg/dL"},{"key":"chol","value":210,"unit":"mg/dL"},{"key":"hdl","value":55,"unit":"mg/dL"}]}
Allowed keys:
fbs = fasting glucose / قند ناشتا / FBS / Glucose
hba1c = HbA1c
chol = total cholesterol / کلسترول تام / Cholesterol
ldl = LDL
hdl = HDL
tg = triglyceride / تری گلیسرید
hb = hemoglobin / هموگلوبین (not HbA1c)
vitd = 25-OH vitamin D / Vitamin D3 / ویتامین D (ng/mL)
b12 = vitamin B12 / ویتامین B12
ferritin = ferritin / فریتین
tsh = TSH
Do not skip vitamin D, B12, ferritin, or TSH when they are printed. Include every marker visible in the image. Skip a marker that is not there. value must be a number.`;

function parseLabJson(text) {
  const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('عدد آزمایش پیدا نشد');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const LAB_KEY_COUNT = 11;

function canonKey(raw) {
  const s = String(raw || '').toLowerCase();
  if (/vitd|vitamin\s*d|vit\s*d|25\s*[- ]?oh|\bd3\b|ویتامین\s*د|ویتامین\s*دی/.test(s)) return 'vitd';
  if (/b\s*12|b12|کوبالامین/.test(s)) return 'b12';
  if (/ferritin|فریتین/.test(s)) return 'ferritin';
  if (/\btsh\b|تیروئید/.test(s)) return 'tsh';
  if (/hba1c|a1c|هموگلوبین\s*a/.test(s)) return 'hba1c';
  if (/hdl/.test(s)) return 'hdl';
  if (/ldl/.test(s)) return 'ldl';
  if (/trig|تری|tg\b/.test(s)) return 'tg';
  if (/chol|کلسترول/.test(s)) return 'chol';
  if (/fbs|glucose|قند|glu\b|sugar/.test(s)) return 'fbs';
  if (/hemoglobin|^hb$|هموگلوبین/.test(s)) return 'hb';
  return '';
}

function normalizeItems(payload) {
  const list = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const items = [];
  list.forEach((item) => {
    const key = canonKey(item.key || item.name || item.label);
    let value = Number(String(item.value ?? '').replace(',', '.'));
    let unit = String(item.unit || '').slice(0, 20);
    if (key === 'vitd' && /nmol/i.test(unit)) {
      value /= 2.5;
      unit = 'ng/mL';
    }
    if (!key || seen.has(key) || !Number.isFinite(value) || value <= 0 || value > 2000) return;
    seen.add(key);
    items.push({
      key,
      value: Math.round(value * 100) / 100,
      unit,
    });
  });
  return items;
}

function isPdf(buffer, mimeType, filename) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(filename || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf') || buffer.slice(0, 5).toString() === '%PDF-';
}

function extractJpegs(buffer) {
  const images = [];
  let from = 0;
  while (from < buffer.length) {
    const start = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]), from);
    if (start < 0) break;
    const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
    if (end < 0) break;
    const jpeg = buffer.slice(start, end + 2);
    if (jpeg.length > 8000) images.push(jpeg);
    from = end + 2;
  }
  return images;
}

function inflateMaybe(raw) {
  try { return zlib.inflateSync(raw); } catch { /* header نیست */ }
  try { return zlib.inflateRawSync(raw); } catch { /* جریان خراب است */ }
  return null;
}

function collectPdfImages(buffer) {
  const images = extractJpegs(buffer);
  const marker = Buffer.from('stream');
  let from = 0;
  while (from < buffer.length) {
    const at = buffer.indexOf(marker, from);
    if (at < 0) break;
    let dataStart = at + marker.length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf(Buffer.from('endstream'), dataStart);
    if (end < 0) break;
    let dataEnd = end;
    if (buffer[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (buffer[dataEnd - 1] === 0x0d) dataEnd -= 1;
    const dict = buffer.slice(Math.max(0, at - 400), at).toString('latin1');
    const raw = buffer.slice(dataStart, dataEnd);
    from = end + 9;
    let bytes = raw;
    if (/FlateDecode/.test(dict)) bytes = inflateMaybe(raw);
    if (!bytes) continue;
    if (/DCTDecode|FlateDecode|Image/.test(dict)) images.push(...extractJpegs(bytes));
  }
  images.sort((a, b) => b.length - a.length);
  const unique = [];
  const seen = new Set();
  images.forEach((image) => {
    const id = `${image.length}:${image.slice(0, 8).toString('hex')}`;
    if (seen.has(id)) return;
    seen.add(id);
    unique.push(image);
  });
  return unique.slice(0, 3);
}

function toEnglishDigits(text) {
  return String(text || '').replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function labNumbers(text) {
  const re = /(\d{1,4}(?:[.,]\d{1,2})?)/g;
  const found = [];
  let match;
  while ((match = re.exec(text))) {
    const start = match.index;
    const raw = match[1];
    const end = start + raw.length;
    const before = text.slice(Math.max(0, start - 1), start);
    const after = text.slice(end, end + 3);
    if (/[-–]/.test(before) || /^\s*[-–]/.test(after)) continue;
    const value = Number(raw.replace(',', '.'));
    if (!(value > 0 && value < 2000)) continue;
    if (Number.isInteger(value) && value >= 1300 && value <= 2100) continue;
    found.push({ value, index: start });
  }
  return found;
}

function localParse(text) {
  const src = toEnglishDigits(text);
  const numbers = labNumbers(src);
  const used = new Set();
  const rules = [
    ['hba1c', /Hb\s*A\s*1\s*c|HBA1C|Glycated|\bA1C\b/i],
    ['hdl', /HDL(?:\s*[- ]?\s*C(?:holesterol)?)?/i],
    ['ldl', /LDL(?:\s*[- ]?\s*C(?:holesterol)?)?/i],
    ['tg', /Triglyceride|تری\s*گلیسرید|تریگلیسرید|\bTG\b/i],
    ['chol', /Total\s*Cholesterol|\bCholesterol\b|کلسترول/i],
    ['vitd', /25\s*[-(]?\s*OH|Vitamin\s*D|Vit\.?\s*D|ویتامین\s*دی|ویتامین\s*D|\bD3\b/i],
    ['b12', /Vitamin\s*B\s*12|\bB\s*12\b/i],
    ['ferritin', /Ferritin|فریتین/i],
    ['tsh', /\bTSH\b/i],
    ['fbs', /F\s*\.?\s*B\s*\.?\s*S|Fasting\s*(?:Blood)?\s*Sugar|Glucose|قند\s*ناشتا|قندناشتا|قند\s*خون/i],
    ['hb', /Hemoglobin|(?<![A-Za-z])Hb(?!\s*A\s*1)|هموگلوبین/i],
  ];
  const items = [];
  const seen = new Set();
  rules.forEach(([key, pattern]) => {
    if (seen.has(key)) return;
    const found = pattern.exec(src);
    if (!found) return;
    const from = found.index + found[0].length;
    const hit = numbers.find((item, index) => !used.has(index) && item.index >= from && item.index <= from + 220);
    if (!hit) return;
    used.add(numbers.indexOf(hit));
    seen.add(key);
    items.push({ key, value: hit.value, unit: '' });
  });
  return items;
}

let mupdfModule;

function loadMupdf() {
  if (!mupdfModule) mupdfModule = import('mupdf');
  return mupdfModule;
}

async function withPdf(buffer, fn) {
  const mupdf = await loadMupdf();
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
  try {
    return await fn(mupdf, doc);
  } finally {
    if (typeof doc.destroy === 'function') doc.destroy();
  }
}

async function pdfPlainText(buffer) {
  return withPdf(buffer, (mupdf, doc) => {
    const pages = Math.min(doc.countPages(), 8);
    const chunks = [];
    for (let i = 0; i < pages; i += 1) {
      const page = doc.loadPage(i);
      try {
        chunks.push(page.toStructuredText('preserve-whitespace').asText());
      } catch {
        chunks.push('');
      }
    }
    return chunks.join('\n');
  });
}

function jpegBand(mupdf, pixmap, y0, y1) {
  const width = pixmap.getWidth();
  const height = pixmap.getHeight();
  const stride = pixmap.getStride();
  const src = pixmap.getPixels();
  const top = Math.max(0, Math.min(height - 1, y0 | 0));
  const bottom = Math.max(top + 1, Math.min(height, y1 | 0));
  const cropH = bottom - top;
  const dest = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, width, cropH], false);
  const out = dest.getPixels();
  const destStride = dest.getStride();
  const rowBytes = Math.min(stride, destStride, width * pixmap.getNumberOfComponents());
  for (let y = 0; y < cropH; y += 1) {
    out.set(src.subarray((top + y) * stride, (top + y) * stride + rowBytes), y * destStride);
  }
  return Buffer.from(dest.asJPEG(86));
}

function regionBlank(pixmap, y0, y1) {
  const width = pixmap.getWidth();
  const height = pixmap.getHeight();
  const stride = pixmap.getStride();
  const comps = pixmap.getNumberOfComponents();
  const src = pixmap.getPixels();
  const top = Math.max(0, y0 | 0);
  const bottom = Math.min(height, y1 | 0);
  let white = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 24) {
    for (let x = 0; x < width; x += 24) {
      const i = y * stride + x * comps;
      samples += 1;
      if (src[i] > 242 && src[i + 1] > 242 && src[i + 2] > 242) white += 1;
    }
  }
  return samples > 0 && white / samples > 0.92;
}

async function pdfBands(buffer) {
  return withPdf(buffer, (mupdf, doc) => {
    const count = doc.countPages();
    const limit = Math.min(count, 8);
    const bands = [];
    for (let i = 0; i < limit; i += 1) {
      const page = doc.loadPage(i);
      const bounds = page.getBounds();
      const width = Math.max(1, bounds[2] - bounds[0]);
      const height = Math.max(1, bounds[3] - bounds[1]);
      const scale = Math.min(1500 / width, 2100 / height, 2.4);
      const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
      const h = pixmap.getHeight();
      const mid = Math.round(h * 0.5);
      const overlap = Math.round(h * 0.08);
      [[0, mid + overlap], [mid - overlap, h]].forEach(([from, to]) => {
        if (regionBlank(pixmap, from, to)) return;
        bands.push(jpegBand(mupdf, pixmap, from, to));
      });
    }
    return { count, bands };
  });
}

async function readLabImage(buffer, mimeType) {
  const result = await callOllamaVision(LAB_PROMPT, buffer, mimeType || 'image/jpeg');
  return normalizeItems(parseLabJson(result.text));
}

async function readLabText(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${ollamaHost()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel(),
        stream: false,
        format: 'json',
        messages: [{ role: 'user', content: `${LAB_PROMPT}\n\nREPORT:\n${text.slice(0, 8000)}` }],
        options: { temperature: 0.1 },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'مدل محلی جواب نداد');
    return normalizeItems(parseLabJson(data.message?.content || ''));
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('خواندن آزمایش طول کشید. دوباره بزن.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const PAGE_PROMPT = `${LAB_PROMPT}
This image is one part of a multi-page lab report. Read every allowed marker in this part.`;

function mergeItems(into, extra) {
  const seen = new Set(into.map((item) => item.key));
  extra.forEach((item) => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    into.push(item);
  });
  return into;
}

async function readLabFile(buffer, mimeType, filename, onProgress) {
  const report = (step, total, text) => {
    if (typeof onProgress === 'function') onProgress({ step, total, text });
  };
  if (!isPdf(buffer, mimeType, filename)) {
    report(0, 1, 'عکس را می‌خوانم');
    const items = await readLabImage(buffer, mimeType);
    report(1, 1, 'عکس خوانده شد');
    return items;
  }
  report(0, 0, 'صفحه‌ها را آماده می‌کنم');

  const chunks = [];
  try {
    const drawn = await pdfPlainText(buffer);
    if (drawn.trim()) chunks.push(drawn);
  } catch (err) {
    console.error('Lab PDF draw text:', err.message);
  }
  try {
    const parsed = await extractPlanText(buffer, mimeType, filename);
    if (parsed.trim()) chunks.push(parsed);
  } catch {
    /* متن فونت به‌هم‌ریخته است */
  }

  const text = chunks.join('\n');
  console.log(`Lab PDF text ${text.trim().length} chars`);
  const found = localParse(text);
  const hasLabel = /fbs|glucose|cholesterol|ldl|hdl|triglyceride|hba1c|vitamin\s*d|ferritin|\btsh\b|b\s*12|هموگلوب|قند|کلسترول|گلیسر|ویتامین|فریتین/i.test(text);
  if (hasLabel && text.trim().length >= 20 && !found.some((item) => item.key === 'vitd')) {
    try {
      mergeItems(found, await readLabText(text));
    } catch (err) {
      console.error('Lab PDF text model:', err.message);
    }
  }
  if (found.some((item) => item.key === 'vitd') && found.length >= 4) {
    report(1, 1, 'عددها از متن خوانده شد');
    return found;
  }

  let visionError = null;
  let rendered = null;
  try {
    rendered = await pdfBands(buffer);
  } catch (err) {
    console.error('Lab PDF render:', err.message);
  }
  const bands = rendered?.bands || [];
  console.log(`Lab PDF pages ${rendered?.count || 0}, parts ${bands.length}`);
  report(0, bands.length, bands.length ? `بخش ۱ از ${bands.length}` : 'صفحه‌ای برای خواندن نبود');
  for (let i = 0; i < bands.length; i += 1) {
    const jpeg = bands[i];
    if (!jpeg || jpeg.length < 1000) continue;
    report(i, bands.length, `بخش ${i + 1} از ${bands.length} را می‌خوانم`);
    console.log(`Lab PDF part ${i + 1} image ${jpeg.length} bytes`);
    try {
      const result = await callOllamaVision(PAGE_PROMPT, jpeg, 'image/jpeg');
      const items = normalizeItems(parseLabJson(result.text));
      console.log(`Lab PDF part ${i + 1} items ${items.length}`);
      mergeItems(found, items);
      report(i + 1, bands.length, `بخش ${i + 1} از ${bands.length} تمام شد`);
      if (found.length >= LAB_KEY_COUNT) break;
    } catch (err) {
      visionError = err;
      console.error('Lab PDF vision:', err.message);
    }
  }
  if (found.length) return found;

  const images = collectPdfImages(buffer);
  for (const image of images) {
    try {
      const items = await readLabImage(image, 'image/jpeg');
      if (items.length) return items;
    } catch (err) {
      visionError = err;
      console.error('Lab PDF embedded:', err.message);
    }
  }
  if (visionError && /خاموش|نیست|دیر جواب/.test(visionError.message)) throw visionError;
  throw new Error('از این PDF عددی خوانده نشد. عکس واضح برگه را بگذار، یا عددها را دستی بنویس.');
}

module.exports = { readLabFile };
