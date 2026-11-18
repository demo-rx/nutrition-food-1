const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'data', 'app.json');

const SEED = {
  users: {},
  sessions: {},
  ads: [
    { slot: 'home-top', title: 'تمرین با مربی', href: 'coaches.html', image: '/assets/ad-home-top.jpg', text: 'برنامه ورزشی و تغذیه کنار هم' },
    { slot: 'home-banner', title: 'مربی ورزش و تغذیه', href: 'coaches.html', image: '/assets/ad-home-coach.jpg', text: 'برنامه تمرینی و رژیم شخصی از مربی‌های اپ' },
    {
      slot: 'plan-banner',
      title: 'مکمل و رستوران سالم',
      href: '#',
      image: '/assets/ad-plan-protein.jpg',
      text: 'اسلایدر تبلیغ پلنر',
      slides: [
        { title: 'پروتئین گیاهی', href: '#', image: '/assets/ad-plan-protein.jpg', text: 'مکمل بازیابی بعد از تمرین' },
        { title: 'ویتامین روزانه', href: '#', image: '/assets/ad-plan-vitamins.jpg', text: 'مکمل طبیعی برای انرژی' },
        { title: 'پوکه‌بول سالم', href: '#', image: '/assets/ad-plan-bowl.jpg', text: 'رستوران غذاهای هلثی' },
        { title: 'سالاد گریل', href: '#', image: '/assets/ad-plan-salad.jpg', text: 'غذای سالم بیرون از خانه' },
      ],
    },
    { slot: 'coach-banner', title: 'جایگاه تبلیغ مربی', href: '#', image: '', text: 'اسپانسر صفحه مربی' },
  ],
  coaches: [
    {
      id: 'coach-nima',
      name: 'نیما رضایی',
      title: 'مربی بدنسازی و تغذیه',
      photo: '/assets/coach-nima.jpg',
      rating: 4.8,
      specialty: 'بدنسازی و تغذیه ورزشی',
      style: 'پروتئین بالا، وعده‌های منظم و بازیابی بعد از تمرین',
      audience: 'مناسب کسی که تمرین قدرتی دارد و می‌خواهد بدون رژیم خیلی سخت عضله بسازد',
      bio: 'برنامه غذایی ورزشی با تمرکز روی پروتئین و بازیابی.',
      planFile: '/assets/plans/nima-plan.txt',
      planName: 'رژیم پروتئین نیما',
      videos: [
        { title: 'گرم‌کردن قبل تمرین', url: 'https://www.youtube.com/embed/2eA2KoM9NhU' },
        { title: 'حرکات قدرتی مبتدی', url: 'https://www.youtube.com/embed/IODxDxX7oi4' },
      ],
    },
    {
      id: 'coach-sara',
      name: 'سارا محمدی',
      title: 'مربی فیتنس',
      photo: '/assets/coach-sara.jpg',
      rating: 4.6,
      specialty: 'کاهش چربی و تناسب اندام',
      style: 'رژیم متعادل، حجم غذای کافی و بدون حذف کامل کربوهیدرات',
      audience: 'مناسب کسی که می‌خواهد چربی کم کند و وسط روز بی‌انرژی نشود',
      bio: 'رژیم متعادل برای کاهش چربی بدون افت انرژی.',
      planFile: '/assets/plans/sara-plan.txt',
      planName: 'رژیم تعادل سارا',
      videos: [{ title: 'تمرین هوازی در خانه', url: 'https://www.youtube.com/embed/ml6cT4AZdqI' }],
    },
  ],
};

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function checkPassword(password, salt, hash) {
  return hashPassword(password, salt).hash === hash;
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    const seed = JSON.parse(JSON.stringify(SEED));
    save(seed);
    return seed;
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function isAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(adminEmail) && String(user.email || '').trim().toLowerCase() === adminEmail;
}

function coachDeskId(user) {
  if (!user) return null;
  if (isAdmin(user)) return 'admin';
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;
  const data = load();
  const match = (data.coaches || []).find(
    (coach) => String(coach.accountEmail || '').trim().toLowerCase() === email
  );
  return match?.id || null;
}

function publicUser(user) {
  if (!user) return null;
  const profile = user.profile && typeof user.profile === 'object' ? user.profile : {};
  const name = [profile.firstName || user.name, profile.lastName].filter(Boolean).join(' ').trim() || user.name || '';
  return {
    id: user.id,
    email: user.email,
    phone: user.phone || '',
    name,
    role: user.role,
    admin: isAdmin(user),
    coachDeskId: coachDeskId(user),
    coachId: user.coachId || null,
    subscriptionUntil: user.subscriptionUntil || null,
    subscribed: Boolean(user.subscriptionUntil && user.subscriptionUntil > Date.now()),
    profile,
  };
}

function athleteCount(data, coachId) {
  return Object.values(data.users).filter(
    (user) => user.role !== 'coach' && user.coachId === coachId && user.planTaken
  ).length;
}

module.exports = {
  load,
  save,
  hashPassword,
  checkPassword,
  publicUser,
  isAdmin,
  athleteCount,
  SEED,
};
