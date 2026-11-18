const { callVision, parseJsonResponse } = require('./geminiVision');
const { DEFAULT_WEEK_PLAN } = require('./defaultWeekPlan');
const { extractPlanText } = require('./extractPlanText');
const { parseChoiceListPlan } = require('./localParsePlan');

const SLOTS = ['breakfast', 'snackAm', 'lunch', 'snackPm', 'dinner', 'snackNight'];

const PARSE_PROMPT = `This file is a coach MEAL PROGRAM (photo or PDF), not a plate of food.

Read ALL visible text (Persian, English, or Arabic) and build a DEFAULT WEEK PLAN.

Return ONLY valid JSON (no markdown):
{
  "kind": "weekly",
  "days": [
    {
      "offset": 0,
      "slots": {
        "breakfast": { "name": "food as written", "alts": [], "calories": 0, "protein": 0, "fat": 0, "sugar": 0, "carbs": 0 },
        "snackAm": { "name": "...", "alts": [] },
        "lunch": { "name": "...", "alts": [] },
        "snackPm": { "name": "...", "alts": [] },
        "dinner": { "name": "...", "alts": [] },
        "snackNight": { "name": "...", "alts": [] }
      }
    }
  ]
}

Rules:
- ALWAYS return exactly 7 days with offset 0..6.
- offset 0 = Saturday / شنبه, then Sunday, Monday, Tuesday, Wednesday, Thursday, Friday.
- If the photo lists weekdays, put each day's meals on the matching offset. Missing weekdays copy the nearest listed day.
- If weekdays are NOT listed (only «یکی از موارد زیر»), DO NOT copy the same meal to every day. Arrange a varied week: rotate options across Saturday–Friday (offset 0–6). Use a different breakfast/lunch/dinner combo each day, still only from the listed options. Remaining options go in alts.
- The photo is often a TABLE: rows = weekdays (شنبه…جمعه), columns = صبحانه، میان‌وعده ۱، ناهار، میان‌وعده ۲، شام، قبل خواب.
- Copy EACH cell text into the matching day and slot. Keep amounts (۱، نصف، ۵ بادام).
- Slot keys MUST be exactly: breakfast, snackAm, lunch, snackPm, dinner, snackNight
- Map: صبحانه/فطور=breakfast; میان‌وعده/میان‌وعده ۱/میان‌وعده صبح=snackAm; ناهار=lunch; میان‌وعده ۲/میان‌وعده عصر=snackPm; شام=dinner; قبل خواب/میان‌وعده شب=snackNight
- If a slot is missing, omit it.
- If the text says یا / or / أو, put extras in alts.
- Some PDFs are NOT a weekday table. They list each meal as «یکی از موارد زیر» then several options separated by یا. Rotate those options across the 7 days instead of repeating day 1.
- Map میان‌وعده ۱ to snackAm, میان‌وعده ۲ to snackPm, ۲ واحد میوه to snackNight.
- name: short food phrase as written, keep original language.
- Estimate calories, protein, fat, sugar, carbs in grams for the written portion (typical Iranian serving).
- Do not invent meals that are not in the photo or PDF.`;

function slotFromUnknown(raw) {
  if (SLOTS.includes(raw)) return raw;
  const key = String(raw || '')
    .toLowerCase()
    .replace(/[\s_\-]/g, '');
  if (/صبحانه|breakfast|فطور|فطار/.test(key)) return 'breakfast';
  if (/قبلخواب|snacknight|میانوعدهشب/.test(key)) return 'snackNight';
  if (/میانوعده[2۲]|میانوعدهعصر|snackpm/.test(key)) return 'snackPm';
  if (/میانوعده[1۱]|میانوعدهصبح|snackam|میانوعده/.test(key)) return 'snackAm';
  if (/ناهار|lunch|غداء/.test(key)) return 'lunch';
  if (/شام|dinner|عشاء/.test(key)) return 'dinner';
  return null;
}

function numNut(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
}

function cleanSlot(value) {
  if (!value || typeof value !== 'object') return null;
  const name = String(value.name || value.food || value.title || '').trim();
  if (!name) return null;
  const alts = Array.isArray(value.alts) ? value.alts : String(value.alts || '').split(/[,،]/);
  return {
    name,
    alts: alts.map((item) => String(item).trim()).filter(Boolean),
    calories: numNut(value.calories),
    protein: numNut(value.protein),
    fat: numNut(value.fat),
    sugar: numNut(value.sugar),
    carbs: numNut(value.carbs),
    fiber: numNut(value.fiber),
    salt: numNut(value.salt),
    saturatedFat: numNut(value.saturatedFat),
  };
}

function cleanSlots(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([key, value]) => {
    const slot = SLOTS.includes(key) ? key : slotFromUnknown(key);
    const item = cleanSlot(value);
    if (slot && item) out[slot] = item;
  });
  return out;
}

const WEEKDAY_OFFSET = {
  saturday: 0,
  sat: 0,
  شنبه: 0,
  sunday: 1,
  sun: 1,
  یکشنبه: 1,
  monday: 2,
  mon: 2,
  دوشنبه: 2,
  tuesday: 3,
  tue: 3,
  سهشنبه: 3,
  'سه‌شنبه': 3,
  wednesday: 4,
  wed: 4,
  چهارشنبه: 4,
  thursday: 5,
  thu: 5,
  پنجشنبه: 5,
  'پنج‌شنبه': 5,
  friday: 6,
  fri: 6,
  جمعه: 6,
};

function weekdayOffset(day, index) {
  const n = Number(day?.offset);
  if (Number.isFinite(n)) return Math.max(0, Math.min(6, Math.round(n)));
  const label = String(day?.weekday || day?.day || day?.label || '')
    .trim()
    .replace(/\s/g, '');
  if (WEEKDAY_OFFSET[label] != null) return WEEKDAY_OFFSET[label];
  return index % 7;
}

function validateParsedPlan(data) {
  const daysIn = Array.isArray(data.days) ? data.days : [];
  const days = daysIn
    .map((day, index) => {
      const slots = cleanSlots(day?.slots || day?.meals || day);
      if (!Object.keys(slots).length) return null;
      return {
        offset: weekdayOffset(day, index),
        slots,
      };
    })
    .filter(Boolean);

  if (!days.length) {
    throw new Error('No meals found in the program photo');
  }

  const kind = data.kind === 'weekly' || days.length > 1 ? 'weekly' : 'daily';
  return expandToWeek({ kind, days });
}

function expandToWeek(parsed) {
  const byOffset = new Map();
  parsed.days.forEach((day) => byOffset.set(day.offset, day.slots));
  const fallback = parsed.days[0]?.slots || {};
  let last = fallback;
  const days = [];
  for (let offset = 0; offset < 7; offset++) {
    if (byOffset.has(offset)) last = byOffset.get(offset);
    days.push({ offset, slots: JSON.parse(JSON.stringify(last || fallback)) });
  }
  return { kind: 'weekly', days };
}

async function parseFromUpload(buffer, mimeType, filename) {
  const text = await extractPlanText(buffer, mimeType, filename);
  const drafted = parseChoiceListPlan(text);
  if (!drafted) return null;
  const parsed = validateParsedPlan(drafted);
  parsed.source = 'upload';
  return parsed;
}

async function parseMealPlan(imageBuffer, mimeType, filename) {
  const fromFile = await parseFromUpload(imageBuffer, mimeType, filename);
  if (fromFile) return fromFile;
  try {
    const { text, modelUsed } = await callVision(PARSE_PROMPT, imageBuffer, mimeType);
    const data = parseJsonResponse(text);
    const parsed = validateParsedPlan(data);
    parsed.source = String(modelUsed).includes(':') ? 'ollama' : 'gemini';
    parsed.modelUsed = modelUsed;
    return parsed;
  } catch (err) {
    const fallback = await parseFromUpload(imageBuffer, mimeType, filename);
    if (fallback) return fallback;
    throw err;
  }
}

async function mockParseMealPlan(buffer, mimeType, filename) {
  const fromFile = buffer ? await parseFromUpload(buffer, mimeType, filename) : null;
  return fromFile || JSON.parse(JSON.stringify(DEFAULT_WEEK_PLAN));
}

module.exports = { parseMealPlan, mockParseMealPlan, parseFromUpload, validateParsedPlan };
