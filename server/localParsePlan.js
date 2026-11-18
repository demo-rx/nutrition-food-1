function tidy(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sliceSection(text, startRe, endReList) {
  const start = text.search(startRe);
  if (start < 0) return '';
  const after = text.slice(start).replace(startRe, '');
  let end = after.length;
  endReList.forEach((re) => {
    const copy = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    const found = copy.exec(after);
    if (found && found.index > 8 && found.index < end) end = found.index;
  });
  return tidy(after.slice(0, end));
}

function splitChoices(block) {
  const cleaned = tidy(block)
    .replace(/^یکی از موارد زیر\s*/i, '')
    .replace(/^:\s*/, '');
  if (!cleaned) return [];
  return cleaned
    .split(/^\s*یا\s*$/m)
    .map((item) => tidy(item.replace(/^[:=]\s*/, '')))
    .filter((item) => item.length > 3 && !/^این موارد/.test(item));
}

function emptyNut() {
  return { calories: 0, protein: 0, fat: 0, sugar: 0, carbs: 0 };
}

function splitFruit(block) {
  const choices = splitChoices(block);
  if (choices.length > 1) return choices;
  const text = choices[0] || tidy(block);
  return text
    .replace(/^از لیست زیر مصرف کنید[:：]?\s*/i, '')
    .split(/\s*=\s*|\s+یا\s+/)
    .map((item) => tidy(item))
    .filter((item) => item.length > 3);
}

function slotForDay(choices, dayIndex, phase) {
  if (!choices.length) return null;
  const name = choices[(dayIndex + phase) % choices.length];
  const alts = choices.filter((item) => item !== name).slice(0, 12);
  return { name, alts, ...emptyNut() };
}

function parseChoiceListPlan(rawText) {
  const text = tidy(rawText);
  if (!text) return null;

  const breakfast = splitChoices(
    sliceSection(text, /صبحانه\s*[:：]/, [/ناهار\s*[:：]/, /میان\s*وعده\s*[1۱]/, /شام\s*[:：]/])
  );
  const lunch = splitChoices(
    sliceSection(text, /ناهار\s*[:：]/, [/شام\s*[:：]/, /میان\s*وعده/, /قبل از ناهار/])
  );
  const dinner = splitChoices(
    sliceSection(text, /شام\s*[:：]/, [/قبل از ناهار/, /میان\s*وعده/, /متفورمین/, /مصرف انواع/])
  );
  const snackAm = splitChoices(
    sliceSection(text, /میان\s*وعده\s*[1۱]\s*[:：]/, [/میان\s*وعده\s*[2۲]/, /این موارد/, /متفورمین/])
  );
  const snackPm = splitChoices(
    sliceSection(text, /میان\s*وعده\s*[2۲]\s*[:：]?/, [/این موارد/, /متفورمین/, /مصرف انواع/])
  );
  const fruit = splitFruit(
    sliceSection(text, /در طول\s*روز\s*2\s*واحد میوه[\s\S]*?[:：]?/, [/میان\s*وعده/, /متفورمین/, /مصرف انواع/])
  );

  if ([breakfast, lunch, dinner, snackAm, snackPm].every((list) => !list.length)) return null;

  const days = [];
  for (let offset = 0; offset < 7; offset++) {
    const slots = {};
    const b = slotForDay(breakfast, offset, 0);
    const sa = slotForDay(snackAm, offset, 1);
    const l = slotForDay(lunch, offset, 2);
    const sp = slotForDay(snackPm, offset, 3);
    const d = slotForDay(dinner, offset, 4);
    const sn = slotForDay(fruit.length ? fruit : ['۲ واحد میوه از لیست برنامه'], offset, 5);
    if (b) slots.breakfast = b;
    if (sa) slots.snackAm = sa;
    if (l) slots.lunch = l;
    if (sp) slots.snackPm = sp;
    if (d) slots.dinner = d;
    if (sn) slots.snackNight = sn;
    days.push({ offset, slots });
  }

  return {
    kind: 'weekly',
    source: 'upload',
    days,
  };
}

module.exports = { parseChoiceListPlan };
