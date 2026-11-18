function meal(name, alts, n) {
  const extras = Array.isArray(alts) ? alts : [];
  const nut = n && typeof n === 'object' ? n : {};
  return {
    name,
    alts: extras,
    calories: nut.cal || 0,
    protein: nut.p || 0,
    fat: nut.f || 0,
    sugar: nut.s || 0,
    carbs: nut.c || 0,
    fiber: nut.fi || 0,
    salt: nut.na || 0,
    saturatedFat: nut.sat || 0,
  };
}

/** Sample Iranian coach week (Sat–Fri) with rough nutrition estimates. */
const DEFAULT_WEEK_PLAN = {
  kind: 'weekly',
  source: 'default',
  days: [
    {
      offset: 0,
      slots: {
        breakfast: meal('تخم‌مرغ ۱ آب‌پز + نصف نان سنگک + خیار و گوجه + چای بدون قند', [], { cal: 280, p: 14, f: 10, s: 4, c: 28, fi: 4, na: 0.6, sat: 3 }),
        snackAm: meal('سیب ۱ + ۵ بادام', [], { cal: 155, p: 3, f: 7, s: 15, c: 22, fi: 4, na: 0, sat: 0.5 }),
        lunch: meal('عدسی ۱ لیوان + نصف نان سنگک + سبزی', [], { cal: 390, p: 18, f: 4, s: 4, c: 68, fi: 12, na: 0.8, sat: 0.6 }),
        snackPm: meal('لیوان ۱ دوغ', ['۱ خرما'], { cal: 90, p: 4, f: 2, s: 8, c: 12, fi: 0, na: 0.7, sat: 1 }),
        dinner: meal('سالاد شیرازی + نصف تن ماهی بدون روغن + کاهو و لیمو', [], { cal: 220, p: 22, f: 6, s: 5, c: 10, fi: 3, na: 0.9, sat: 1 }),
        snackNight: meal('نصف لیوان شیر', [], { cal: 60, p: 4, f: 2, s: 6, c: 6, fi: 0, na: 0.1, sat: 1 }),
      },
    },
    {
      offset: 1,
      slots: {
        breakfast: meal('پنیر کم‌چرب + ۱ گردو + نان تافتون + سبزی', [], { cal: 310, p: 14, f: 12, s: 3, c: 32, fi: 3, na: 0.8, sat: 4 }),
        snackAm: meal('پرتقال ۱', [], { cal: 70, p: 1, f: 0, s: 12, c: 16, fi: 3, na: 0, sat: 0 }),
        lunch: meal('نصف لیوان برنج + خورش قیمه کم‌چرب + سالاد', [], { cal: 430, p: 16, f: 12, s: 5, c: 60, fi: 6, na: 1.1, sat: 3 }),
        snackPm: meal('چای + ۲ خرما', [], { cal: 50, p: 0, f: 0, s: 12, c: 13, fi: 1, na: 0, sat: 0 }),
        dinner: meal('تخم‌مرغ ۲ نیمرو کم‌روغن + سبزی + نان', [], { cal: 340, p: 16, f: 16, s: 2, c: 24, fi: 2, na: 0.6, sat: 5 }),
        snackNight: meal('خیار', ['کاهو'], { cal: 16, p: 1, f: 0, s: 2, c: 4, fi: 1, na: 0, sat: 0 }),
      },
    },
    {
      offset: 2,
      slots: {
        breakfast: meal('جو دوسر با شیر کم‌چرب + ۱ خرما', ['نصف موز'], { cal: 280, p: 10, f: 6, s: 14, c: 44, fi: 5, na: 0.2, sat: 2 }),
        snackAm: meal('کیوی', ['۱ خیار'], { cal: 50, p: 1, f: 0, s: 7, c: 12, fi: 2, na: 0, sat: 0 }),
        lunch: meal('ران مرغ ۱ بدون پوست + سبزیجات بخارپز + کمی برنج', ['نان'], { cal: 420, p: 32, f: 10, s: 4, c: 38, fi: 4, na: 0.7, sat: 2.5 }),
        snackPm: meal('سیب ۱', [], { cal: 80, p: 0, f: 0, s: 16, c: 21, fi: 3, na: 0, sat: 0 }),
        dinner: meal('سوپ جو سبک + ۱ قاشق ماست', [], { cal: 180, p: 7, f: 4, s: 4, c: 28, fi: 3, na: 0.8, sat: 1.5 }),
        snackNight: meal('خرما ۱', [], { cal: 23, p: 0, f: 0, s: 5, c: 6, fi: 1, na: 0, sat: 0 }),
      },
    },
    {
      offset: 3,
      slots: {
        breakfast: meal('نیم‌پرس عدسی + نان سبوس‌دار', [], { cal: 300, p: 14, f: 3, s: 3, c: 52, fi: 10, na: 0.6, sat: 0.5 }),
        snackAm: meal('بادام + ۵ چای سبز', [], { cal: 70, p: 2, f: 6, s: 1, c: 3, fi: 1, na: 0, sat: 0.5 }),
        lunch: meal('خوراک لوبیا چیتی ۱ لیوان + سالاد + نان', [], { cal: 410, p: 16, f: 6, s: 5, c: 70, fi: 12, na: 0.9, sat: 1 }),
        snackPm: meal('موز ۱ کوچک', [], { cal: 90, p: 1, f: 0, s: 12, c: 23, fi: 3, na: 0, sat: 0 }),
        dinner: meal('تخم‌مرغ ۱ + سفیده + خیار و گوجه', [], { cal: 130, p: 12, f: 7, s: 3, c: 5, fi: 1, na: 0.3, sat: 2 }),
        snackNight: meal('شیر ولرم', [], { cal: 120, p: 8, f: 5, s: 12, c: 12, fi: 0, na: 0.2, sat: 3 }),
      },
    },
    {
      offset: 4,
      slots: {
        breakfast: meal('پنیر + گردو + نان کامل + سبزی', [], { cal: 330, p: 14, f: 14, s: 3, c: 34, fi: 4, na: 0.8, sat: 4 }),
        snackAm: meal('میوه ۱ فصلی', [], { cal: 70, p: 1, f: 0, s: 13, c: 18, fi: 2, na: 0, sat: 0 }),
        lunch: meal('نصف لیوان برنج + خوراک کدو با گوشت چرخ‌کرده + سالاد', [], { cal: 450, p: 20, f: 14, s: 5, c: 52, fi: 5, na: 1, sat: 4 }),
        snackPm: meal('چای + ۱ خرما', [], { cal: 25, p: 0, f: 0, s: 6, c: 7, fi: 1, na: 0, sat: 0 }),
        dinner: meal('سوپ سبزیجات + ماست کم‌چرب', [], { cal: 160, p: 8, f: 3, s: 6, c: 22, fi: 4, na: 0.8, sat: 1 }),
        snackNight: meal('خیار ۱', [], { cal: 16, p: 1, f: 0, s: 2, c: 4, fi: 1, na: 0, sat: 0 }),
      },
    },
    {
      offset: 5,
      slots: {
        breakfast: meal('املت گوجه + ۲ تخم‌مرغ + سبزی', [], { cal: 260, p: 16, f: 16, s: 4, c: 8, fi: 2, na: 0.5, sat: 5 }),
        snackAm: meal('سیب ۱ + ۵ بادام', [], { cal: 155, p: 3, f: 7, s: 15, c: 22, fi: 4, na: 0, sat: 0.5 }),
        lunch: meal('ماهی گریل‌شده + سبزیجات + نان', [], { cal: 400, p: 34, f: 10, s: 3, c: 30, fi: 4, na: 0.8, sat: 2 }),
        snackPm: meal('لیوان ۱ دوغ', [], { cal: 80, p: 4, f: 2, s: 7, c: 10, fi: 0, na: 0.7, sat: 1 }),
        dinner: meal('سالاد + ۱ تخم‌مرغ آب‌پز', [], { cal: 140, p: 8, f: 6, s: 4, c: 8, fi: 2, na: 0.3, sat: 2 }),
        snackNight: meal('چای بدون قند', [], { cal: 2, p: 0, f: 0, s: 0, c: 0, fi: 0, na: 0, sat: 0 }),
      },
    },
    {
      offset: 6,
      slots: {
        breakfast: meal('نان سنگک + پنیر + ۱ گردو + چای', [], { cal: 320, p: 13, f: 13, s: 3, c: 36, fi: 3, na: 0.8, sat: 4 }),
        snackAm: meal('موز ۱ کوچک', [], { cal: 90, p: 1, f: 0, s: 12, c: 23, fi: 3, na: 0, sat: 0 }),
        lunch: meal('لوبیاپلو کم‌روغن + سالاد', [], { cal: 480, p: 16, f: 10, s: 5, c: 78, fi: 10, na: 0.9, sat: 2 }),
        snackPm: meal('پرتقال ۱', [], { cal: 70, p: 1, f: 0, s: 12, c: 16, fi: 3, na: 0, sat: 0 }),
        dinner: meal('تخم‌مرغ ۲ آب‌پز + خیار و گوجه', [], { cal: 180, p: 13, f: 10, s: 3, c: 6, fi: 1, na: 0.4, sat: 3 }),
        snackNight: meal('شیر کم‌چرب', [], { cal: 100, p: 8, f: 2, s: 12, c: 12, fi: 0, na: 0.2, sat: 1.5 }),
      },
    },
  ],
};

module.exports = { DEFAULT_WEEK_PLAN };
