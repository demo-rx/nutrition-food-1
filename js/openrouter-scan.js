(function () {
  const PROMPT = `Analyze only food visibly present in this image. Return only valid JSON, no markdown:
{"foodName":{"fa":"","en":"","ar":""},"calories":0,"protein":0,"fat":0,"saturatedFat":0,"carbs":0,"fiber":0,"sugar":0,"salt":0,"portionNote":{"fa":"","en":"","ar":""},"confidence":"low|medium|high","assumptions":[],"uncertainties":[],"components":[{"name":{"fa":"","en":"","ar":""},"grams":0,"calories":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"sugar":0,"salt":0}]}
Use natural Persian, simple English and natural Arabic. All numbers must be non-negative. Estimate only the visible portion and do not invent hidden ingredients.`;

  function endpoint() {
    const value = String(window.HNP_OPENROUTER?.workerUrl || '').trim().replace(/\/$/, '');
    if (!/^https:\/\//i.test(value)) throw new Error('آدرس Cloudflare Worker در js/config.js تنظیم نشده است.');
    return `${value}/v1/chat/completions`;
  }

  function dataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('خواندن عکس ممکن نشد.'));
      reader.readAsDataURL(blob);
    });
  }

  function json(text) {
    const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try { return JSON.parse(clean); } catch { /* extract an object below */ }
    const a = clean.indexOf('{');
    const z = clean.lastIndexOf('}');
    if (a >= 0 && z > a) return JSON.parse(clean.slice(a, z + 1));
    throw new Error('پاسخ مدل JSON معتبر نبود. دوباره تلاش کنید.');
  }

  function num(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`مقدار ${name} در پاسخ مدل معتبر نبود.`);
    return Math.round(n * 10) / 10;
  }

  function lang(value, fallback) {
    const item = value && typeof value === 'object' ? value : {};
    return {
      fa: String(item.fa || fallback || ''),
      en: String(item.en || fallback || ''),
      ar: String(item.ar || item.en || fallback || ''),
    };
  }

  function normalize(data, model, mode) {
    ['calories', 'protein', 'sugar', 'salt'].forEach((field) => {
      if (data?.[field] == null) throw new Error(`فیلد ${field} در پاسخ مدل نیست.`);
    });
    const components = Array.isArray(data.components) ? data.components.map((item) => ({
      name: lang(item?.name, 'جزء غذا'),
      grams: num(item?.grams || 0, 'grams'),
      calories: num(item?.calories || 0, 'calories'),
      protein: num(item?.protein || 0, 'protein'),
      fat: num(item?.fat || 0, 'fat'),
      carbs: num(item?.carbs || 0, 'carbs'),
      fiber: num(item?.fiber || 0, 'fiber'),
      sugar: num(item?.sugar || 0, 'sugar'),
      salt: num(item?.salt || 0, 'salt'),
    })).filter((item) => item.grams > 0) : [];
    return {
      foodName: lang(data.foodName, 'غذا'),
      calories: num(data.calories, 'calories'), protein: num(data.protein, 'protein'),
      fat: num(data.fat || 0, 'fat'), saturatedFat: num(data.saturatedFat || 0, 'saturatedFat'),
      carbs: num(data.carbs || 0, 'carbs'), fiber: num(data.fiber || 0, 'fiber'),
      sugar: num(data.sugar, 'sugar'), salt: num(data.salt, 'salt'),
      portionNote: lang(data.portionNote, 'مقادیر از روی تصویر تخمین زده شده‌اند.'),
      confidence: ['low', 'medium', 'high'].includes(data.confidence) ? data.confidence : 'medium',
      assumptions: Array.isArray(data.assumptions) ? data.assumptions.map(String).slice(0, 8) : [],
      uncertainties: Array.isArray(data.uncertainties) ? data.uncertainties.map(String).slice(0, 8) : [],
      components, source: 'openrouter', modelUsed: model, portionMode: mode, estimated: true,
    };
  }

  function apiError(status, data) {
    if (status === 401) {
      return 'کلید OpenRouter نامعتبر یا غیرفعال است.';
    }
    if (status === 402 || status === 429) return 'سهمیه OpenRouter اجازه تحلیل نمی‌دهد.';
    if (status === 404) return 'مدل OpenRouter در دسترس نیست.';
    return data?.error?.message || `خطای OpenRouter: ${status}`;
  }

  async function call(blob, prompt) {
    const image = await dataUrl(blob);
    const models = window.HNP_OPENROUTER?.models || [];
    let lastError = new Error('هیچ مدل OpenRouter تنظیم نشده است.');
    for (const model of models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        const response = await fetch(endpoint(), {
          method: 'POST', signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model, temperature: 0.2,
            messages: [{ role: 'user', content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } },
            ] }],
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          lastError = new Error(apiError(response.status, data));
          continue;
        }
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          lastError = new Error('مدل OpenRouter پاسخ خالی داد.');
          continue;
        }
        return { result: json(content), model: data.model || model };
      } catch (error) {
        lastError = error?.name === 'AbortError' ? new Error('پاسخ OpenRouter بیش از حد طول کشید.') : error;
      } finally { clearTimeout(timer); }
    }
    throw lastError;
  }

  async function analyze(blob, info = { mode: 'auto' }) {
    const manual = info.mode === 'manual';
    const extra = manual
      ? `\nUse only these confirmed items and weights:\n${JSON.stringify(info.items || [])}`
      : '\nEstimate weights from the visible serving.';
    const value = await call(blob, PROMPT + extra);
    return normalize(value.result, value.model, manual ? 'manual' : 'auto');
  }

  async function estimate(blob) {
    const value = await call(blob, `${PROMPT}\nList every visible component separately and estimate grams. Components cannot be empty.`);
    const result = normalize(value.result, value.model, 'manual');
    if (!result.components.length) throw new Error('مدل اجزای بشقاب را تشخیص نداد.');
    return {
      foodName: result.foodName, confidence: result.confidence,
      source: result.source, modelUsed: result.modelUsed,
      items: result.components.map((item, index) => ({
        id: `item-${index + 1}`, name: item.name,
        estimatedGrams: Math.max(1, Math.round(item.grams)),
      })),
    };
  }

  window.HNP_OPENROUTER_SCAN = Object.freeze({ analyze, estimate });
})();
