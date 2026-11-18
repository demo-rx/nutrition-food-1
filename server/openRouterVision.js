const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function openRouterModel() {
  return String(process.env.OPENROUTER_MODEL || '').trim();
}

function openRouterModelList() {
  const primary = openRouterModel();
  const extras = String(process.env.OPENROUTER_MODEL_FALLBACKS || 'nvidia/nemotron-3.5-super-vl:free,google/gemma-4-26b-a4b-it:free')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([primary, ...extras].filter(Boolean))];
}

function openRouterKey() {
  return String(process.env.OPENROUTER_API_KEY || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function friendlyOpenRouterError(status, bodyText) {
  const text = String(bodyText || '');
  if (status === 401 || /invalid.*api key|unauthorized/i.test(text)) {
    return 'کلید OpenRouter نامعتبر است. از openrouter.ai یک کلید بساز و در سرور بگذار.';
  }
  if (status === 402 || /credits|quota|payment/i.test(text)) {
    return 'سهمیه OpenRouter تمام شده. مدل رایگان همیشه در دسترس نیست.';
  }
  if (status === 404 || /not a valid model|no endpoints/i.test(text)) {
    return 'این مدل روی OpenRouter نیست یا تصویر قبول نمی‌کند. OPENROUTER_MODEL را عوض کن.';
  }
  if (/image|vision|multimodal|content type/i.test(text) && /not support|unsupported/i.test(text)) {
    return 'مدل انتخاب‌شده تصویر نمی‌پذیرد. یک مدل vision در OPENROUTER_MODEL بگذار.';
  }
  return 'سرویس تحلیل غذا الان جواب نداد. کمی بعد دوباره اسکن کن.';
}

async function callOpenRouterVision(prompt, imageBuffer, mimeType) {
  const key = openRouterKey();
  const models = openRouterModelList();
  if (!key) {
    throw new Error('کلید OpenRouter تنظیم نشده. OPENROUTER_API_KEY را در server/.env بگذار.');
  }
  if (!models.length) {
    throw new Error('مدل OpenRouter تنظیم نشده. OPENROUTER_MODEL را با یک مدل vision بگذار.');
  }

  const mime = String(mimeType || 'image/jpeg').split(';')[0];
  const dataUrl = `data:${mime};base64,${imageBuffer.toString('base64')}`;
  let lastError = null;

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE || 'http://localhost:3000',
          'X-Title': 'Healthy Nutrition Plan',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      const raw = await response.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {};
      }

      if (!response.ok) {
        lastError = new Error(friendlyOpenRouterError(response.status, raw || data.error?.message));
        if (response.status === 404 || /no endpoints|not a valid model/i.test(raw)) continue;
        throw lastError;
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text || !String(text).trim()) {
        lastError = new Error('مدل جواب خالی داد. مدل vision دیگری در OPENROUTER_MODEL امتحان کن.');
        continue;
      }
      return { text: String(text), modelUsed: data.model || model, source: 'openrouter' };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('اتصال به OpenRouter طول کشید. اینترنت را چک کن و دوباره اسکن کن.');
      }
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('سرویس تحلیل غذا الان جواب نداد. کمی بعد دوباره اسکن کن.');
}

module.exports = { callOpenRouterVision, openRouterModel, openRouterKey };
