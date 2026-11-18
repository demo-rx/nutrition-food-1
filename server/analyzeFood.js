const { callVision, parseJsonResponse } = require('./geminiVision');
const { polishName } = require('./persianFoodNames');

const BASE_PROMPT = `You are a nutrition assistant. Analyze the food in this image.
Put SIMPLE everyday English in every "en" field (example: roasted salmon, sliced carrot, lime wedge, beef sandwich with lettuce).
Leave "fa" and "ar" empty. Do not write Persian; the server translates.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "foodName": { "fa": "Persian name", "en": "English name", "ar": "Arabic name" },
  "calories": number,
  "protein": number,
  "fat": number,
  "saturatedFat": number,
  "carbs": number,
  "fiber": number,
  "sugar": number,
  "salt": number,
  "portionNote": { "fa": "Persian portion description", "en": "English portion description", "ar": "Arabic portion description" },
  "confidence": "low" | "medium" | "high",
  "components": [
    { "name": { "fa": "...", "en": "...", "ar": "..." }, "grams": number, "calories": number, "sugar": number }
  ]
}

Rules:
- calories in kcal; protein/fat/saturatedFat/carbs/fiber/sugar/salt in grams for the TOTAL plate
- Weights are ESTIMATES from a photo, never exact. Say so in portionNote.
- Only list foods that are visibly on the plate. Do not invent hidden oils, sauces, or sides.
- If sauce, oil, or topping is visible, include it as its own component.
- If the photo is unclear, lower confidence and mention why.
- LANGUAGE: "en" must be short English food names. Leave fa/ar empty.
- All numbers must be non-negative numbers, not strings
- Optional extra keys: "assumptions": string[], "uncertainties": string[]`;

function buildPrompt(portionInfo = { mode: 'auto' }) {
  if (portionInfo.mode !== 'manual') {
    return `${BASE_PROMPT}
- Estimate for the visible portion on the plate
- components can be empty array []
- If unsure, use lower confidence`;
  }

  const items = portionInfo.items || [];
  const lines = [
    '- The user confirmed these exact item weights — use ONLY these amounts:',
    ...items.map(
      (item) =>
        `- ${item.name.en} (${item.name.fa}): ${item.grams} grams`
    ),
    '- Total nutrition = sum of these items only',
    '- Fill components array with each item, its grams, calories, and sugar grams',
    '- Set confidence to "high"',
    '- portionNote should list confirmed user weights',
  ];

  return `${BASE_PROMPT}\n${lines.join('\n')}`;
}

function optionalGrams(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
}

function requireFinite(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid nutrition number: ${field}`);
  }
  return Math.round(n * 10) / 10;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
}

function sumField(rows, field) {
  return Math.round(rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) * 10) / 10;
}

function validateResult(data, modelUsed, portionInfo) {
  const required = ['foodName', 'calories', 'protein', 'sugar', 'salt', 'portionNote', 'confidence'];
  for (const key of required) {
    if (data[key] == null) {
      throw new Error(`Missing field: ${key}`);
    }
  }

  const result = {
    foodName: polishName({
      fa: String(data.foodName.fa),
      en: String(data.foodName.en),
      ar: String(data.foodName.ar || data.foodName.en || ''),
    }),
    calories: requireFinite(data.calories, 'calories'),
    protein: requireFinite(data.protein, 'protein'),
    fat: optionalGrams(data.fat),
    saturatedFat: optionalGrams(data.saturatedFat),
    carbs: optionalGrams(data.carbs),
    fiber: optionalGrams(data.fiber),
    sugar: requireFinite(data.sugar, 'sugar'),
    salt: requireFinite(data.salt, 'salt'),
    portionNote: polishName({
      fa: String(data.portionNote.fa),
      en: String(data.portionNote.en),
      ar: String(data.portionNote.ar || data.portionNote.en || ''),
    }),
    confidence: ['low', 'medium', 'high'].includes(data.confidence) ? data.confidence : 'medium',
    estimated: true,
    assumptions: stringList(data.assumptions),
    uncertainties: stringList(data.uncertainties),
    source: String(modelUsed || '').includes('/')
      ? 'openrouter'
      : (String(modelUsed || '').includes(':') ? 'ollama' : 'gemini'),
    modelUsed,
    portionMode: portionInfo.mode,
  };

  if (Array.isArray(data.components) && data.components.length > 0) {
    result.components = data.components.map((c) => {
      const grams = requireFinite(c.grams, 'grams');
      if (grams <= 0) throw new Error('Invalid nutrition number: grams');
      return {
        name: polishName({
          fa: String(c.name?.fa || ''),
          en: String(c.name?.en || ''),
          ar: String(c.name?.ar || c.name?.en || ''),
        }),
        grams,
        calories: requireFinite(c.calories, 'calories'),
        protein: optionalGrams(c.protein),
        fat: optionalGrams(c.fat),
        carbs: optionalGrams(c.carbs),
        fiber: optionalGrams(c.fiber),
        sugar: optionalGrams(c.sugar),
        salt: optionalGrams(c.salt),
      };
    });
    result.calories = sumField(result.components, 'calories');
    result.sugar = sumField(result.components, 'sugar');
    const proteinSum = sumField(result.components, 'protein');
    const fatSum = sumField(result.components, 'fat');
    const carbsSum = sumField(result.components, 'carbs');
    const fiberSum = sumField(result.components, 'fiber');
    const saltSum = sumField(result.components, 'salt');
    if (proteinSum > 0) result.protein = proteinSum;
    if (fatSum > 0) result.fat = fatSum;
    if (carbsSum > 0) result.carbs = carbsSum;
    if (fiberSum > 0) result.fiber = fiberSum;
    if (saltSum > 0) result.salt = saltSum;
  }

  return result;
}

async function analyzeWithGemini(imageBuffer, mimeType, portionInfo = { mode: 'auto' }) {
  const prompt = buildPrompt(portionInfo);
  const { text, modelUsed } = await callVision(prompt, imageBuffer, mimeType);
  const parsed = parseJsonResponse(text);
  return validateResult(parsed, modelUsed, portionInfo);
}

module.exports = { analyzeWithGemini, buildPrompt };
