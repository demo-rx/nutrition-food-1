const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'foods.json');

const SEED = [
  { name: 'برنج', calories: 450, protein: 12, fat: 8, sugar: 4, carbs: 78, fiber: 4, salt: 0.6, saturatedFat: 2, grams: 300 },
  { name: 'زرشک پلو', calories: 480, protein: 14, fat: 10, sugar: 8, carbs: 82, fiber: 4, salt: 0.7, saturatedFat: 2, grams: 300, aliases: ['زرشکپلو', 'پلو زرشک'] },
  { name: 'عدس پلو', calories: 520, protein: 28, fat: 12, sugar: 5, carbs: 70, fiber: 10, salt: 1, saturatedFat: 3, grams: 300 },
  { name: 'لوبیا پلو', calories: 520, protein: 28, fat: 12, sugar: 5, carbs: 70, fiber: 10, salt: 1, saturatedFat: 3, grams: 300 },
  { name: 'باقالی پلو', calories: 500, protein: 18, fat: 10, sugar: 4, carbs: 74, fiber: 8, salt: 0.8, saturatedFat: 2, grams: 300 },
  { name: 'آلبالو پلو', calories: 490, protein: 14, fat: 10, sugar: 12, carbs: 80, fiber: 4, salt: 0.6, saturatedFat: 2, grams: 300 },
  { name: 'میگو پلو', calories: 430, protein: 28, fat: 8, sugar: 3, carbs: 62, fiber: 2, salt: 1.1, saturatedFat: 2, grams: 300, aliases: ['میگوپلو', 'پلو میگو'] },
  { name: 'سنگک', calories: 300, protein: 12, fat: 12, sugar: 3, carbs: 34, fiber: 3, salt: 0.7, saturatedFat: 4, grams: 80 },
  { name: 'کباب کوبیده', calories: 520, protein: 32, fat: 16, sugar: 5, carbs: 52, fiber: 5, salt: 1, saturatedFat: 5, grams: 300 },
  { name: 'قورمه سبزی', calories: 520, protein: 32, fat: 16, sugar: 5, carbs: 52, fiber: 5, salt: 1, saturatedFat: 5, grams: 300 },
  { name: 'جوجه کباب', calories: 480, protein: 38, fat: 10, sugar: 3, carbs: 48, fiber: 2, salt: 0.8, saturatedFat: 2, grams: 300 },
  { name: 'عدسی', calories: 380, protein: 16, fat: 5, sugar: 4, carbs: 62, fiber: 11, salt: 0.8, saturatedFat: 1, grams: 300 },
  { name: 'ماست', calories: 100, protein: 6, fat: 3, sugar: 10, carbs: 12, fiber: 0, salt: 0.3, saturatedFat: 2, grams: 200 },
  { name: 'پنیر', calories: 300, protein: 12, fat: 12, sugar: 3, carbs: 34, fiber: 3, salt: 0.7, saturatedFat: 4, grams: 80 },
  { name: 'خرما', calories: 23, protein: 0, fat: 0, sugar: 5, carbs: 6, fiber: 1, salt: 0, saturatedFat: 0, grams: 20 },
];

function canon(name) {
  return String(name || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function seedItem(item) {
  return {
    ...item,
    aliases: item.aliases || [],
    key: canon(item.name),
    count: item.count || 1,
    at: item.at || Date.now(),
    approved: true,
  };
}

function cleanName(raw) {
  const name = String(raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>{}[\]\\]/g, '')
    .replace(/[`'"]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  if (name.length < 2) return '';
  if (!/^[\u0600-\u06FFa-zA-Z0-9\s\u200c\-]+$/.test(name)) return '';
  return name;
}

function clamp(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n * 10) / 10);
}

function isSeedKey(key) {
  return SEED.some((row) => canon(row.name) === key);
}

function isPublic(item) {
  if (item.rejected) return false;
  if (item.approved === true) return true;
  if (isSeedKey(item.key)) return true;
  return Number(item.count || 0) >= 2;
}

function load() {
  let data = { items: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(raw?.items)) data = raw;
  } catch {
    /* seed */
  }
  let changed = false;
  for (const seed of SEED) {
    const key = canon(seed.name);
    if (!data.items.some((row) => row.key === key)) {
      data.items.push(seedItem(seed));
      changed = true;
    }
  }
  if (!data.items.length) {
    data.items = SEED.map(seedItem);
    changed = true;
  }
  for (const row of data.items) {
    if (row.approved == null) {
      row.approved = isPublic(row);
      changed = true;
    }
  }
  if (changed) save(data);
  return data;
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function publicItem(item) {
  return {
    name: item.name,
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    fat: Number(item.fat) || 0,
    sugar: Number(item.sugar) || 0,
    carbs: Number(item.carbs) || 0,
    fiber: Number(item.fiber) || 0,
    salt: Number(item.salt) || 0,
    saturatedFat: Number(item.saturatedFat) || 0,
    grams: Number(item.grams) || 100,
    count: Number(item.count) || 1,
  };
}

function haystack(item) {
  const extra = Array.isArray(item.aliases) ? item.aliases.join(' ') : '';
  return canon(`${item.name} ${item.key || ''} ${extra}`);
}

function tokens(text) {
  return canon(text)
    .split(/[\s،,+\-_]+/)
    .filter((part) => part.length >= 2);
}

function tokenHit(blob, token) {
  const parts = tokens(blob);
  return blob.includes(token) || parts.some((part) => part.includes(token) || token.includes(part));
}

function scoreItem(item, q, qTokens) {
  const blob = haystack(item);
  if (!q) return 1;
  if (item.key === q || blob === q) return 100;
  if (item.key.startsWith(q) || blob.startsWith(q)) return 90;
  if (blob.includes(q) || item.key.includes(q)) return 80;
  let hits = 0;
  for (const token of qTokens) {
    if (tokenHit(blob, token)) hits += 1;
  }
  if (qTokens.length > 1 && hits < qTokens.length) return 0;
  if (hits) return 40 + hits * 15;
  return 0;
}

function search(query) {
  const q = canon(query);
  const qTokens = tokens(query);
  return load()
    .items.filter(isPublic)
    .map((item) => ({ item, score: scoreItem(item, q, qTokens) }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.item.count || 0) - (a.item.count || 0) ||
        String(a.item.name).localeCompare(b.item.name, 'fa')
    )
    .slice(0, 20)
    .map((row) => publicItem(row.item));
}

function upsert(input) {
  const name = cleanName(input.name);
  const key = canon(name);
  if (!name || key.length < 2) return { error: 'اسم غذا نامعتبر است' };
  const data = load();
  let item = data.items.find((row) => row.key === key);
  const count = (item?.count || 0) + 1;
  const approved = item?.approved === true || isSeedKey(key) || count >= 2;
  const next = {
    name: item?.name || name,
    key,
    calories: clamp(input.calories ?? item?.calories, 3000),
    protein: clamp(input.protein ?? item?.protein, 300),
    fat: clamp(input.fat ?? item?.fat, 300),
    sugar: clamp(input.sugar ?? item?.sugar, 300),
    carbs: clamp(input.carbs ?? item?.carbs, 400),
    fiber: clamp(input.fiber ?? item?.fiber, 80),
    salt: clamp(input.salt ?? item?.salt, 30),
    saturatedFat: clamp(input.saturatedFat ?? item?.saturatedFat, 100),
    grams: clamp(input.grams ?? item?.grams ?? 100, 2000) || 100,
    count,
    at: Date.now(),
    approved,
    rejected: false,
  };
  if (item) {
    next.aliases = item.aliases || [];
    Object.assign(item, next);
  } else data.items.push(next);
  save(data);
  return { food: publicItem(next) };
}

function listAll() {
  return load().items.map((item) => ({
    ...publicItem(item),
    key: item.key,
    approved: Boolean(isPublic(item)),
    count: Number(item.count) || 1,
  }));
}

function setApproved(key, approved) {
  const data = load();
  const item = data.items.find((row) => row.key === canon(key));
  if (!item) return null;
  item.approved = Boolean(approved);
  item.rejected = !approved;
  save(data);
  return item;
}

function remove(key) {
  const data = load();
  const want = canon(key);
  const before = data.items.length;
  data.items = data.items.filter((row) => row.key !== want);
  if (data.items.length === before) return false;
  save(data);
  return true;
}

module.exports = { search, upsert, listAll, setApproved, remove };
