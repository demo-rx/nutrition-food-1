require('dotenv').config();

const express = require('express');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const path = require('path');
const { analyzeWithGemini } = require('./analyzeFood');
const { mockAnalyzeFood } = require('./mockAnalyze');
const { estimatePlate, mockEstimatePlate } = require('./estimatePlate');
const { parseMealPlan, mockParseMealPlan } = require('./parseMealPlan');
const { resolveAnalyzeMode, isValidGeminiApiKey } = require('./geminiVision');
const { ollamaHost, ollamaModel } = require('./ollamaVision');
const { readLabFile } = require('./readLab');
const { mountPlatform } = require('./platform');
const foodBank = require('./foodBank');
const market = require('./market');
const store = require('./appStore');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function sanitizeItems(items) {
  if (!Array.isArray(items)) return null;

  const sanitized = items
    .map((item, index) => {
      const grams = Number(item.grams);
      if (!grams || grams <= 0) return null;
      return {
        id: String(item.id || `item-${index + 1}`),
        name: {
          fa: String(item.name?.fa || `مورد ${index + 1}`),
          en: String(item.name?.en || `Item ${index + 1}`),
        },
        grams: Math.round(grams),
      };
    })
    .filter(Boolean);

  return sanitized.length ? sanitized : null;
}

function isPdfFile(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || name.endsWith('.pdf');
}

function isPlanTextFile(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  return mime.startsWith('text/') || name.endsWith('.txt');
}

function planFileMime(file) {
  if (isPdfFile(file)) return 'application/pdf';
  return file.mimetype || 'image/jpeg';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const uploadPlan = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || isPdfFile(file) || isPlanTextFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only image, PDF, or text plan files are allowed'));
    }
  },
});

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const allowed = String(process.env.ALLOWED_ORIGIN || '').trim();
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  const urlPath = req.path || '';
  if (urlPath === '/server' || urlPath.startsWith('/server/')) return res.status(404).end();
  next();
});
app.use(express.static(path.join(__dirname, '..')));
mountPlatform(app);

function userFromReq(req) {
  const header = String(req.headers.authorization || '');
  const raw = header.startsWith('Bearer ') ? header.slice(7) : String(req.body?.token || '');
  if (!raw) return null;
  const data = store.load();
  const session = data.sessions?.[raw];
  if (!session) return null;
  return data.users?.[session.email] || null;
}

function adminFromReq(req, res) {
  const user = userFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'وارد شو' });
    return null;
  }
  if (!store.isAdmin(user)) {
    res.status(403).json({ error: 'فقط ادمین' });
    return null;
  }
  return user;
}

app.get('/api/foods', (req, res) => {
  res.json({ foods: foodBank.search(String(req.query.q || '')) });
});

app.post('/api/foods', (req, res) => {
  if (!userFromReq(req)) return res.status(401).json({ error: 'برای بانک غذا وارد شو' });
  const result = foodBank.upsert(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true, food: result.food });
});

app.get('/api/admin/foods', (req, res) => {
  if (!adminFromReq(req, res)) return;
  res.json({ foods: foodBank.listAll() });
});

app.post('/api/admin/foods/:key/approve', (req, res) => {
  if (!adminFromReq(req, res)) return;
  const item = foodBank.setApproved(req.params.key, true);
  if (!item) return res.status(404).json({ error: 'غذا پیدا نشد' });
  res.json({ ok: true });
});

app.delete('/api/admin/foods/:key', (req, res) => {
  if (!adminFromReq(req, res)) return;
  if (!foodBank.remove(req.params.key)) return res.status(404).json({ error: 'غذا پیدا نشد' });
  res.json({ ok: true });
});

app.get('/api/market/:kind/:id', (req, res) => {
  const item = market.get(req.params.kind, req.params.id);
  if (!item) return res.status(404).json({ error: 'آگهی پیدا نشد' });
  res.json({ item });
});

app.get('/api/market/:kind', (req, res) => {
  const items = market.list(req.params.kind);
  if (!items) return res.status(404).json({ error: 'این بخش پیدا نشد' });
  res.json({ items });
});

app.post('/api/market/:kind/:id/reviews', (req, res) => {
  const user = market.userFromReq(req);
  if (!user) return res.status(401).json({ error: 'برای نظر دادن وارد حساب شو' });
  const result = market.addReview(req.params.kind, req.params.id, user, req.body || {});
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json({ ok: true, item: result.item });
});

app.post('/api/market/:kind', upload.single('photo'), (req, res) => {
  const user = market.userFromReq(req);
  if (!user) return res.status(401).json({ error: 'برای ثبت آگهی وارد حساب شو' });
  const kind = req.params.kind;
  if (kind !== 'recipes' && !market.isAdmin(user)) {
    return res.status(403).json({ error: 'فقط ادمین می‌تواند این بخش را ثبت کند' });
  }
  const body = { ...(req.body || {}) };
  const photo = market.savePhoto(req.file);
  if (photo) body.photo = photo;
  const result = market.add(kind, body, user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json({ ok: true, item: result.item });
});

app.get('/api/admin/market', (req, res) => {
  const user = market.userFromReq(req);
  if (!user || !market.isAdmin(user)) return res.status(403).json({ error: 'این حساب ادمین نیست' });
  res.json(market.listAll());
});

app.delete('/api/admin/market/:kind/:id', (req, res) => {
  const user = market.userFromReq(req);
  if (!user || !market.isAdmin(user)) return res.status(403).json({ error: 'این حساب ادمین نیست' });
  if (!market.remove(req.params.kind, req.params.id)) {
    return res.status(404).json({ error: 'آگهی پیدا نشد' });
  }
  res.json({ ok: true });
});

app.post('/api/ask', async (req, res) => {
  const question = String(req.body?.question || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (question.length < 2) return res.status(400).json({ error: 'سؤالت را بنویس' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${ollamaHost()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'تو راهنمای کوتاه برنامهٔ تغذیهٔ سالم هستی. فقط فارسی جواب بده، در دو سه جمله. دربارهٔ اسکن غذا، پلنر، BMI، مربی، پروفایل و گزارش خطا کمک کن. تشخیص پزشکی نده.',
          },
          { role: 'user', content: question },
        ],
        options: { temperature: 0.4 },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'مدل محلی جواب نداد');
    const answer = String(data.message?.content || '').trim();
    if (!answer) throw new Error('مدل محلی جواب خالی داد');
    res.json({ answer });
  } catch (err) {
    const raw = String(err.message || '');
    const msg = err.name === 'AbortError' || /timeout/i.test(raw)
      ? 'جواب طول کشید. دوباره بپرس.'
      : (/fetch failed|ECONNREFUSED/i.test(raw) ? 'مدل محلی خاموش است. Ollama را باز کن.' : (raw || 'جواب نیامد'));
    res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
});

app.get('/api/health', (_req, res) => {
  const mode = resolveAnalyzeMode();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  res.json({
    ok: true,
    analyzeMode: mode,
    geminiKeyValid: isValidGeminiApiKey(apiKey),
  });
});

// Manual mode: estimate all plate items with grams
app.post('/api/estimate-plate', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const mode = resolveAnalyzeMode();
    let result;

    if (mode === 'mock') {
      await new Promise((r) => setTimeout(r, 800));
      result = mockEstimatePlate();
    } else if (mode === 'gemini' || mode === 'ollama') {
      result = await estimatePlate(req.file.buffer, req.file.mimetype);
    } else if (mode === 'openrouter') {
      result = await estimatePlate(req.file.buffer, req.file.mimetype);
    } else {
      return res.status(500).json({ error: `Unknown ANALYZE_MODE: ${mode}` });
    }

    res.json(result);
  } catch (err) {
    console.error('Estimate plate error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to estimate plate' });
  }
});

app.post('/api/parse-meal-plan', uploadPlan.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const mode = resolveAnalyzeMode();
    let result;

    if (mode === 'gemini' || mode === 'ollama' || mode === 'openrouter') {
      result = await parseMealPlan(req.file.buffer, planFileMime(req.file), req.file.originalname);
    } else if (mode === 'mock') {
      result = await mockParseMealPlan(req.file.buffer, planFileMime(req.file), req.file.originalname);
    } else {
      return res.status(500).json({ error: `Unknown ANALYZE_MODE: ${mode}` });
    }

    res.json(result);
  } catch (err) {
    console.error('Parse meal plan error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to parse meal plan' });
  }
});

app.post('/api/read-lab', uploadPlan.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل آزمایش را بگذار' });
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
  const send = (payload) => res.write(`${JSON.stringify(payload)}\n`);
  try {
    const items = await readLabFile(req.file.buffer, req.file.mimetype, req.file.originalname, (progress) => {
      send({ progress });
    });
    if (!items.length) send({ error: 'عددی از آزمایش خوانده نشد. عددها را پایین بنویس.' });
    else send({ items });
    res.end();
  } catch (err) {
    console.error('Read lab error:', err.message);
    send({ error: err.message || 'آزمایش خوانده نشد' });
    res.end();
  }
});

app.post('/api/analyze-food', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const portionMode = req.body.portionMode === 'manual' ? 'manual' : 'auto';
    let items = null;
    let plateEstimate = null;

    if (req.body.items) {
      try {
        items = sanitizeItems(JSON.parse(req.body.items));
      } catch {
        return res.status(400).json({ error: 'Invalid items JSON' });
      }
    }

    if (req.body.plateEstimate) {
      try {
        plateEstimate = JSON.parse(req.body.plateEstimate);
      } catch {
        return res.status(400).json({ error: 'Invalid plateEstimate JSON' });
      }
    }

    if (portionMode === 'manual' && !items) {
      return res.status(400).json({ error: 'Manual mode requires confirmed items' });
    }

    const portionInfo = { mode: portionMode, items, plateEstimate };

    const mode = resolveAnalyzeMode();
    let result;

    if (mode === 'mock') {
      await new Promise((r) => setTimeout(r, 1200));
      result = mockAnalyzeFood(portionInfo);
    } else     if (mode === 'gemini' || mode === 'ollama' || mode === 'openrouter') {
      result = await analyzeWithGemini(req.file.buffer, req.file.mimetype, portionInfo);
    } else {
      return res.status(500).json({ error: `Unknown ANALYZE_MODE: ${mode}` });
    }

    res.json(result);
  } catch (err) {
    console.error('Analyze error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to analyze food' });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  const mode = resolveAnalyzeMode();
  const configured = (process.env.ANALYZE_MODE || '').trim().toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  console.log(`Healthy Nutrition Plan server → http://localhost:${PORT}`);
  console.log(`Food scan page   → http://localhost:${PORT}/scan.html`);
  console.log(`Analyze mode     → ${mode}`);

  if (mode === 'ollama') {
    console.log(`Local vision model → ${process.env.OLLAMA_MODEL || 'gemma3:4b'}`);
    if (configured === 'gemini' && apiKey && !isValidGeminiApiKey(apiKey)) {
      console.warn('⚠ GEMINI_API_KEY invalid. Food scan uses the local vision model.');
    }
  }
  if (mode === 'openrouter') {
    console.log(`OpenRouter vision model → ${process.env.OPENROUTER_MODEL || '(set OPENROUTER_MODEL)'}`);
  }
});

const pfxPath = path.join(__dirname, 'data', 'local.pfx');
if (fs.existsSync(pfxPath)) {
  https.createServer({
    pfx: fs.readFileSync(pfxPath),
    passphrase: 'hnp-local',
  }, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Camera page → https://localhost:${HTTPS_PORT}/scan.html`);
  });
}
