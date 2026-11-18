const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

function normalizeApiKey(key) {
  return String(key || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

function isValidGeminiApiKey(key) {
  const value = normalizeApiKey(key);
  return value.startsWith('AIza') && value.length > 20;
}

function toFriendlyGeminiError(err) {
  const msg = String(err?.message || err);
  const cause = String(err?.cause?.message || err?.cause || '');

  if (/403|Forbidden|API key not valid|PERMISSION_DENIED/i.test(msg + cause)) {
    return (
      'کلید Gemini نامعتبر است. از https://aistudio.google.com/apikey یک کلید جدید (AIza...) بگیرید.\n' +
      'Invalid Gemini API key. Get a new key (starts with AIza...) from Google AI Studio.'
    );
  }

  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(msg + cause)) {
    return (
      'اتصال به سرویس Gemini برقرار نشد. اینترنت، VPN یا فایروال را بررسی کنید.\n' +
      'Could not reach Gemini. Check your internet, VPN, or firewall.'
    );
  }

  return msg;
}

const MAX_RETRIES_PER_MODEL = 2;
const RETRY_DELAY_MS = 1500;

function getModelList() {
  const primary = process.env.GEMINI_MODEL?.trim();
  const fallbacks = (process.env.GEMINI_MODEL_FALLBACKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const ordered = primary
    ? [primary, ...fallbacks, ...DEFAULT_MODELS]
    : [...fallbacks, ...DEFAULT_MODELS];

  return [...new Set(ordered)];
}

function isModelUnavailableError(err) {
  const msg = String(err?.message || err);
  return /404|no longer available|not found|not supported/i.test(msg);
}

function isRetryableError(err) {
  const msg = String(err?.message || err);
  return /503|429|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|try again later/i.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function callGeminiVision(prompt, imageBuffer, mimeType) {
  const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY تنظیم نشده است.\nGEMINI_API_KEY is not set.'
    );
  }
  if (!isValidGeminiApiKey(apiKey)) {
    throw new Error(
      'فرمت کلید Gemini اشتباه است (باید با AIza شروع شود).\n' +
      'Invalid Gemini API key format (must start with AIza).'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = getModelList();

  for (const modelName of models) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType || 'image/jpeg',
            },
          },
        ]);
        return { text: result.response.text(), modelUsed: modelName };
      } catch (err) {
        console.warn(`Model ${modelName} attempt ${attempt + 1} failed:`, err.message);

        if (isModelUnavailableError(err)) {
          break;
        }

        if (!isRetryableError(err)) {
          throw new Error(toFriendlyGeminiError(err));
        }

        if (attempt < MAX_RETRIES_PER_MODEL) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }
  }

  throw new Error(
    'سرویس AI موقتاً در دسترس نیست. لطفاً یک دقیقه دیگر دوباره تلاش کنید.\n' +
    'AI service is temporarily unavailable. Please try again in a minute.'
  );
}

async function callVision(prompt, imageBuffer, mimeType) {
  const mode = resolveAnalyzeMode();
  if (mode === 'openrouter') {
    const { callOpenRouterVision } = require('./openRouterVision');
    return callOpenRouterVision(prompt, imageBuffer, mimeType);
  }
  if (mode === 'ollama') {
    const { callOllamaVision } = require('./ollamaVision');
    return callOllamaVision(prompt, imageBuffer, mimeType);
  }
  const result = await callGeminiVision(prompt, imageBuffer, mimeType);
  return { ...result, source: 'gemini' };
}

module.exports = {
  callGeminiVision,
  callVision,
  parseJsonResponse,
  isValidGeminiApiKey,
  resolveAnalyzeMode,
};

function resolveAnalyzeMode() {
  const configured = (process.env.ANALYZE_MODE || '').trim().toLowerCase();
  if (configured === 'mock') return 'mock';
  if (configured === 'openrouter') return 'openrouter';
  const apiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  if (configured !== 'ollama' && isValidGeminiApiKey(apiKey)) return 'gemini';
  if (configured === 'gemini' && !isValidGeminiApiKey(apiKey)) return 'ollama';
  if (configured === 'ollama' || !isValidGeminiApiKey(apiKey)) return 'ollama';
  return 'mock';
}
