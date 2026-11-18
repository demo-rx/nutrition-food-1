const PHRASES = [
  [/french\s*fries|fries|tater\s*tots?/i, 'سیب‌زمینی سرخ‌کرده'],
  [/sweet\s*potato\s*sticks/i, 'خلال سیب‌زمینی شیرین'],
  [/sweet\s*potatoes?/i, 'سیب‌زمینی شیرین'],
  [/shredded\s*(?:purple|red)\s*cabbages?/i, 'خلال کلم بنفش'],
  [/(?:purple|red)\s*cabbages?/i, 'کلم بنفش'],
  [/micro\s*greens?/i, 'جوانه ریز'],
  [/chicken\s*breast/i, 'سینه مرغ'],
  [/cherry\s*tomatoes?/i, 'گوجه گیلاسی'],
  [/tomato\s*sauce|ketchup/i, 'سس گوجه'],
  [/olive\s*oil/i, 'روغن زیتون'],
  [/sour\s*cream/i, 'خامه ترش'],
  [/sesame\s*(bun|bread|seed)?s?/i, 'نان کنجدی'],
  [/hot\s*dogs?/i, 'هات‌داگ'],
  [/soft\s*drinks?|sodas?|cola/i, 'نوشابه'],
  [/beef\s*sandwich(?:es)?/i, 'ساندویچ گوشت گوساله'],
  [/sausage\s*sandwich(?:es)?/i, 'ساندویچ سوسیس'],
  [/meat\s*sandwich(?:es)?/i, 'ساندویچ گوشت'],
];

const FOODS = [
  [/sandwich(?:es)?/i, 'ساندویچ'],
  [/sausages?|bratwurst/i, 'سوسیس'],
  [/burgers?|hamburgers?/i, 'همبرگر'],
  [/buns?/i, 'نان'],
  [/mustard/i, 'خردل'],
  [/pickles?/i, 'خیارشور'],
  [/lettuce|khas/i, 'کاهو'],
  [/sesame/i, 'کنجد'],
  [/cheddar|cheese/i, 'پنیر'],
  [/brown\s*rice/i, 'برنج قهوه‌ای'],
  [/white\s*rice/i, 'برنج سفید'],
  [/green\s*beans?/i, 'لوبیا سبز'],
  [/bell\s*peppers?/i, 'فلفل دلمه‌ای'],
  [/salmon/i, 'سالمون'],
  [/tuna/i, 'تن ماهی'],
  [/fish/i, 'ماهی'],
  [/broccoli/i, 'بروکلی'],
  [/cauliflower/i, 'گل‌کلم'],
  [/cabbages?/i, 'کلم'],
  [/avocados?/i, 'آووکادو'],
  [/seeds?/i, 'هسته'],
  [/beetroots?|beets?/i, 'چغندر'],
  [/carrots?/i, 'هویج'],
  [/zucchinis?|courgettes?/i, 'کدو سبز'],
  [/potatoes?/i, 'سیب‌زمینی'],
  [/tomatoes?/i, 'گوجه'],
  [/cucumbers?/i, 'خیار'],
  [/spinach/i, 'اسفناج'],
  [/chicken/i, 'مرغ'],
  [/beef|steak/i, 'گوشت گوساله'],
  [/lamb/i, 'گوشت بره'],
  [/shrimp|prawns?/i, 'میگو'],
  [/rice/i, 'برنج'],
  [/bread/i, 'نان'],
  [/yogurt|yoghurt/i, 'ماست'],
  [/olives?/i, 'زیتون'],
  [/limes?/i, 'لیمو'],
  [/lemons?/i, 'لیموترش'],
  [/corn/i, 'ذرت'],
  [/onions?/i, 'پیاز'],
  [/garlic/i, 'سیر'],
  [/peppers?/i, 'فلفل'],
  [/mushrooms?/i, 'قارچ'],
  [/eggs?/i, 'تخم‌مرغ'],
  [/butter/i, 'کره'],
  [/sauces?/i, 'سس'],
  [/meats?/i, 'گوشت'],
];

const COOKS = [
  [/breaded|katsu|tempura/i, 'سوخاری'],
  [/roasted|roast/i, 'برشته'],
  [/grilled/i, 'گریل'],
  [/fried|sauteed|sautéed/i, 'سرخ‌شده'],
  [/steamed/i, 'بخارپز'],
  [/boiled|poached/i, 'آب‌پز'],
  [/smoked/i, 'دودی'],
  [/mashed/i, 'پوره'],
  [/cooked/i, 'پخته'],
  [/raw|fresh/i, 'تازه'],
];

const CUTS = [
  [/wedges?/i, 'قاچ'],
  [/sliced|slices?/i, 'ورقه'],
  [/shredded/i, 'خلال'],
  [/sticks?/i, 'خلال'],
  [/halves?|half/i, 'نصف'],
  [/chopped|diced|cubed/i, 'خردشده'],
];

const FA_FIXES = [
  [/سمسمی|سمسم/g, 'کنجدی'],
  [/(^|[^\u0600-\u06FF])خس(?=[^\u0600-\u06FF]|$)/g, '$1کاهو'],
  [/سیب‌زمینی تلی|سیب زمینی تلی|تلی/g, 'سیب‌زمینی سرخ‌کرده'],
  [/مردمک/g, 'خیارشور'],
  [/(^|[^\u0600-\u06FF])سوس(?=[^\u0600-\u06FF]|$)/g, '$1سس'],
  [/سلمنون|سالمونون/g, 'سالمون'],
  [/برکلی/g, 'بروکلی'],
  [/هیجول/g, 'هویج'],
  [/چقندر/g, 'چغندر'],
  [/اسلایس/g, 'ورقه'],
  [/سوخاری/g, 'برشته'],
  [/رسته/g, 'برشته'],
  [/موج\s*لیمو/g, 'قاچ لیمو'],
  [/\s*و\s*اکسیر/g, ''],
];

function pick(list, text) {
  const hit = list.find(([from]) => from.test(text));
  return hit ? hit[1] : '';
}

function translateChunk(chunk) {
  const phrase = pick(PHRASES, chunk);
  if (phrase) return phrase;
  const food = pick(FOODS, chunk);
  if (!food) return '';
  const cook = pick(COOKS, chunk);
  const cut = pick(CUTS, chunk);
  return [cut, food, cook].filter(Boolean).join(' ');
}

function faFromEnglish(en) {
  const raw = String(en || '').trim();
  if (!raw) return '';
  const whole = translateChunk(raw);
  const parts = raw.split(/\s*(?:,|\/|&|\band\b|\bwith\b|\bplus\b)\s*/i).filter(Boolean);
  if (parts.length <= 1) return whole;
  const translated = parts.map(translateChunk).filter(Boolean);
  if (!translated.length) return whole;
  if (translated.length === 1) return translated[0];
  return `${translated[0]} با ${translated.slice(1).join(' و ')}`;
}

function applyFaFixes(text) {
  let out = String(text || '').trim();
  FA_FIXES.forEach(([from, to]) => {
    out = out.replace(from, to);
  });
  return out.replace(/\s+/g, ' ').trim();
}

function looksEnglish(text) {
  const value = String(text || '');
  return /[a-z]/i.test(value) && !/[\u0600-\u06FF]/.test(value);
}

function polishFa(fa, en) {
  const fromEn = faFromEnglish(en);
  const fromFa = looksEnglish(fa) ? faFromEnglish(fa) : '';
  return applyFaFixes(fromEn || fromFa || fa);
}

function polishName(name) {
  const en = String(name?.en || '').trim();
  const fa = String(name?.fa || '').trim();
  const ar = String(name?.ar || en || '');
  return {
    fa: polishFa(fa, en) || fa,
    en: en || fa,
    ar,
  };
}

module.exports = { polishFa, polishName, faFromEnglish };
