const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./appStore');

const FILE = path.join(__dirname, 'data', 'market.json');
const KINDS = ['doctors', 'recipes', 'restaurants'];

const SEED = {
  doctors: [
    {
      id: 'doc-seed-1',
      name: 'دکتر لیلا رضایی',
      title: 'دکترای علوم تغذیه',
      city: 'تهران',
      phone: '09120000001',
      price: 'مشاوره آنلاین از ۴۵۰ هزار تومان',
      bio: 'برنامهٔ غذایی برای دیابت، کاهش وزن و بارداری. نوبت از طریق تماس.',
      photo: '/assets/market/doctor.jpg',
    },
  ],
  recipes: [
    {
      id: 'rec-seed-1',
      name: 'عدسی رژیمی با نان سنگک',
      title: 'آشپز خانگی',
      city: 'اصفهان',
      phone: '09120000002',
      price: 'دستور پخت کامل ۲۰ هزار تومان',
      bio: 'کم‌نمک، پر فیبر، مناسب کنترل قند. بعد از خرید فایل روش پخت فرستاده می‌شود.',
      photo: '/assets/market/dish.jpg',
    },
  ],
  restaurants: [
    {
      id: 'res-seed-1',
      name: 'کافه سلامت برگ',
      title: 'رستوران رژیم',
      city: 'شیراز',
      phone: '07130000000',
      price: 'بشقاب کالری‌شمار از ۱۸۰ هزار تومان',
      bio: 'غذای کم‌روغن، برچسب کالری روی منو، ارسال برای ورزشکار و رژیم‌گیر.',
      photo: '/assets/market/restaurant.jpg',
    },
  ],
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      let changed = false;
      for (const kind of KINDS) {
        if (!Array.isArray(raw[kind])) {
          raw[kind] = SEED[kind].slice();
          changed = true;
        }
        for (const seed of SEED[kind]) {
          const row = raw[kind].find((item) => item.id === seed.id);
          if (row && !row.photo && seed.photo) {
            row.photo = seed.photo;
            changed = true;
          }
        }
      }
      if (changed) save(raw);
      return raw;
    }
  } catch {
    /* seed */
  }
  const data = {
    doctors: SEED.doctors.slice(),
    recipes: SEED.recipes.slice(),
    restaurants: SEED.restaurants.slice(),
  };
  save(data);
  return data;
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function userFromReq(req) {
  const header = String(req.headers.authorization || '');
  const raw = header.startsWith('Bearer ') ? header.slice(7) : String(req.body?.token || '');
  if (!raw) return null;
  const data = store.load();
  const session = data.sessions?.[raw];
  if (!session) return null;
  return data.users?.[session.email] || null;
}

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function publicReviews(item) {
  return (Array.isArray(item?.reviews) ? item.reviews : []).map((row) => ({
    name: row.name || 'کاربر',
    stars: Number(row.stars) || 5,
    text: row.text || '',
    at: row.at || 0,
  }));
}

function publicItem(item) {
  const reviews = publicReviews(item);
  const rating = reviews.length
    ? Math.round((reviews.reduce((sum, row) => sum + row.stars, 0) / reviews.length) * 10) / 10
    : null;
  return {
    id: item.id,
    name: item.name,
    title: item.title || '',
    city: item.city || '',
    phone: item.phone || '',
    price: item.price || '',
    bio: item.bio || '',
    ownerName: item.ownerName || '',
    photo: item.photo || '',
    reviews,
    rating,
  };
}

function list(kind) {
  if (!KINDS.includes(kind)) return null;
  return load()[kind].slice().reverse().map(publicItem);
}

function get(kind, id) {
  if (!KINDS.includes(kind)) return null;
  const item = load()[kind].find((row) => row.id === id);
  return item ? publicItem(item) : null;
}

function addReview(kind, id, user, body) {
  if (!KINDS.includes(kind)) return { error: 'این بخش پیدا نشد', status: 404 };
  const data = load();
  const item = data[kind].find((row) => row.id === id);
  if (!item) return { error: 'آگهی پیدا نشد', status: 404 };
  const stars = Math.min(5, Math.max(1, Number(body.stars) || 5));
  const text = clip(body.text, 500);
  if (!Array.isArray(item.reviews)) item.reviews = [];
  const entry = {
    userId: user.id || user.email,
    name: clip(user.name || user.phone || 'کاربر', 40),
    stars,
    text,
    at: Date.now(),
  };
  const mine = item.reviews.find((row) => row.userId === entry.userId);
  if (mine) Object.assign(mine, entry);
  else item.reviews.push(entry);
  save(data);
  return { item: publicItem(item) };
}

function isAdmin(user) {
  return store.isAdmin(user);
}

function canPost(kind, user) {
  if (!user) return false;
  if (kind === 'recipes') return true;
  return store.isAdmin(user);
}

function listAll() {
  const data = load();
  return {
    doctors: data.doctors.map(publicItem),
    recipes: data.recipes.map(publicItem),
    restaurants: data.restaurants.map(publicItem),
  };
}

function remove(kind, id) {
  if (!KINDS.includes(kind)) return false;
  const data = load();
  const next = data[kind].filter((row) => row.id !== id);
  if (next.length === data[kind].length) return false;
  data[kind] = next;
  save(data);
  return true;
}

function add(kind, body, user) {
  if (!KINDS.includes(kind)) return { error: 'نوع آگهی اشتباه است', status: 400 };
  const name = clip(body.name, 80);
  if (name.length < 3) return { error: 'اسم را کامل‌تر بنویس', status: 400 };
  const item = {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    title: clip(body.title, 80),
    city: clip(body.city, 40),
    phone: clip(body.phone, 20),
    price: clip(body.price, 80),
    bio: clip(body.bio, 400),
    ownerEmail: user.email,
    ownerName: clip(user.name || user.phone || 'کاربر', 40),
    photo: clip(body.photo, 200),
    at: Date.now(),
  };
  const data = load();
  data[kind].push(item);
  save(data);
  return { item: publicItem(item) };
}

function savePhoto(file) {
  if (!file?.buffer) return '';
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
  const dir = path.join(__dirname, '..', 'assets', 'market');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return `/assets/market/${name}`;
}

module.exports = {
  KINDS,
  list,
  listAll,
  get,
  add,
  addReview,
  remove,
  canPost,
  isAdmin,
  userFromReq,
  savePhoto,
};
