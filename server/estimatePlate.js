const { callVision, parseJsonResponse } = require('./geminiVision');
const { polishName } = require('./persianFoodNames');

const ESTIMATE_PLATE_PROMPT = `Analyze this food plate image carefully. List EVERY separate visible food item.
Put SIMPLE English in every "en" field. Leave "fa" and "ar" empty. The server translates to Persian.

Return ONLY valid JSON (no markdown):
{
  "foodName": { "fa": "Persian dish name", "en": "English dish name", "ar": "Arabic dish name" },
  "items": [
    {
      "id": "item-1",
      "name": { "fa": "Persian item name", "en": "English item name", "ar": "Arabic item name" },
      "estimatedGrams": number
    }
  ],
  "estimatedTotalGrams": number
}

CRITICAL RULES:
- List EACH food separately. NEVER merge different foods into one item.
- Do NOT use generic names like "vegetables", "salad", or "side dishes" when distinct items are visible.
- If you see chicken, rice, broccoli, carrot, corn, potato, zucchini, tomato, olive, lime — list EACH as its own item.
- Include proteins, grains, each vegetable, fruits, sauces, bread, pickles, yogurt, olives, lime/lemon wedges separately.
- Small garnishes count too if visible.
- For a full plate with many items, return 6-15 items — not just 2-3.
- estimatedGrams: realistic weight for that item only (not the whole plate).
- estimatedTotalGrams: sum of all item grams.
- Use unique ids: item-1, item-2, item-3, ...
- LANGUAGE: "en" must be short English food names. Leave fa/ar empty.`;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function parseGramValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }
  let s = String(value).trim();
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(PERSIAN_DIGITS[i], String(i));
    s = s.replaceAll(ARABIC_DIGITS[i], String(i));
  }
  s = s.replace(/[^\d.]/g, '');
  const num = Number(s);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

function validatePlateEstimate(data) {
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items = rawItems
    .map((item, index) => {
      const grams = parseGramValue(item.estimatedGrams);
      if (!grams) return null;
      return {
        id: String(item.id || `item-${index + 1}`),
        name: polishName({
          fa: String(item.name?.fa || `مورد ${index + 1}`),
          en: String(item.name?.en || `Item ${index + 1}`),
          ar: String(item.name?.ar || item.name?.en || `عنصر ${index + 1}`),
        }),
        estimatedGrams: grams,
      };
    })
    .filter(Boolean);

  if (!items.length) {
    throw new Error('No food items detected on plate');
  }

  const estimatedTotalGrams =
    parseGramValue(data.estimatedTotalGrams) ||
    items.reduce((sum, item) => sum + item.estimatedGrams, 0);

  return {
    foodName: polishName({
      fa: String(data.foodName?.fa || 'غذا'),
      en: String(data.foodName?.en || 'Food'),
      ar: String(data.foodName?.ar || data.foodName?.en || 'طعام'),
    }),
    items,
    estimatedTotalGrams,
  };
}

async function estimatePlate(imageBuffer, mimeType) {
  const { text } = await callVision(ESTIMATE_PLATE_PROMPT, imageBuffer, mimeType);
  return validatePlateEstimate(parseJsonResponse(text));
}

function mockEstimatePlate() {
  return {
    foodName: { fa: 'بشقاب مرغ و سبزیجات', en: 'Chicken and vegetables plate', ar: 'طبق دجاج وخضار' },
    items: [
      { id: 'item-1', name: { fa: 'سینه مرغ گریل', en: 'Grilled chicken breast', ar: 'صدر دجاج مشوي' }, estimatedGrams: 150 },
      { id: 'item-2', name: { fa: 'کاهو', en: 'Lettuce', ar: 'خس' }, estimatedGrams: 40 },
      { id: 'item-3', name: { fa: 'بروکلی', en: 'Broccoli', ar: 'بروكلي' }, estimatedGrams: 35 },
      { id: 'item-4', name: { fa: 'هویج', en: 'Carrot', ar: 'جزر' }, estimatedGrams: 30 },
      { id: 'item-5', name: { fa: 'ذرت', en: 'Corn', ar: 'ذرة' }, estimatedGrams: 30 },
      { id: 'item-6', name: { fa: 'سیب‌زمینی گریل', en: 'Grilled potato', ar: 'بطاطس مشوية' }, estimatedGrams: 70 },
      { id: 'item-7', name: { fa: 'کدو گریل', en: 'Grilled zucchini', ar: 'كوسا مشوي' }, estimatedGrams: 30 },
      { id: 'item-8', name: { fa: 'گوجه گیلاسی', en: 'Cherry tomato', ar: 'طماطم كرزية' }, estimatedGrams: 40 },
      { id: 'item-9', name: { fa: 'زیتون', en: 'Olives', ar: 'زيتون' }, estimatedGrams: 25 },
      { id: 'item-10', name: { fa: 'لیمو', en: 'Lime', ar: 'ليمون' }, estimatedGrams: 25 },
    ],
    estimatedTotalGrams: 475,
  };
}

module.exports = { estimatePlate, mockEstimatePlate };
