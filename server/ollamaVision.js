const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'minicpm-v:8b';

function ollamaHost() {
  return String(process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/$/, '');
}

function ollamaModel() {
  return String(process.env.OLLAMA_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function friendlyOllamaError(err) {
  const msg = String(err?.message || err);
  if (/ECONNREFUSED|fetch failed|ENOTFOUND/i.test(msg)) {
    return 'مدل محلی خاموش است. برنامهٔ Ollama را باز کن و دوباره اسکن کن.';
  }
  if (/not found|404/i.test(msg)) {
    return `مدل ${ollamaModel()} روی سیستم نیست. یک‌بار دانلودش کن، یا اگر کند شده پاکش کن.`;
  }
  if (/timeout|timed out|aborted/i.test(msg)) {
    return 'مدل محلی دیر جواب داد. برنامه‌های دیگر را ببند و دوباره امتحان کن. اگر سیستم کند شد، مدل را پاک کن.';
  }
  if (/exceeds the available context size|num_ctx/i.test(msg)) {
    return 'عکس برای مدل محلی خیلی شلوغ بود. همان غذا را از فاصله نزدیک‌تر دوباره اسکن کن.';
  }
  return msg;
}

async function callOllamaVision(prompt, imageBuffer, mimeType) {
  const model = ollamaModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);
  try {
    const response = await fetch(`${ollamaHost()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [imageBuffer.toString('base64')],
          },
        ],
        options: {
          temperature: 0.2,
          num_ctx: Number(process.env.OLLAMA_NUM_CTX) || 6144,
          num_predict: 400,
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Ollama ${response.status}`);
    }
    const text = data.message?.content || '';
    if (!text.trim()) throw new Error('مدل محلی جواب خالی داد');
    return { text, modelUsed: model, source: 'ollama' };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(friendlyOllamaError(new Error('timeout')));
    throw new Error(friendlyOllamaError(err));
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callOllamaVision, ollamaModel, ollamaHost };
