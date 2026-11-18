const SLOT_FA = {
  breakfast: 'صبحانه',
  snackAm: 'میان‌وعده صبح',
  lunch: 'ناهار',
  snackPm: 'میان‌وعده عصر',
  dinner: 'شام',
  snackNight: 'قبل خواب',
};
const SEEN_KEY = 'hnp-notice-seen';

function readSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

function markSeen(ids) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)]));
}

function faNum(n) {
  return Number(n || 0).toLocaleString('fa-IR');
}

function buildNotices() {
  const items = [];
  const user = typeof HNP !== 'undefined' ? HNP.currentUser() : null;
  if (!user) {
    items.push({
      id: 'guest-login',
      title: 'خوش آمدی',
      text: 'وارد شو تا برنامه و اعلان شخصی برایت بیاید.',
      href: 'login.html',
    });
  } else {
    const today = HNP.dateKey(new Date());
    const pending = (HNP.SLOT_ORDER || []).filter((slot) => {
      const st = HNP.slotStatus(today, slot);
      return st.status === 'missed';
    });
    if (pending.length) {
      items.push({
        id: `meals-${today}`,
        title: 'وعدهٔ امروز',
        text: `${faNum(pending.length)} وعده هنوز ثبت نشده: ${pending.map((s) => SLOT_FA[s] || s).join('، ')}`,
        href: 'plan.html',
      });
    } else {
      items.push({
        id: `done-${today}`,
        title: 'آفرین',
        text: 'وعده‌های برنامه‌ریزی‌شده امروز ثبت شده‌اند.',
        href: 'plan.html',
      });
    }
    const vitals = (() => {
      try {
        return JSON.parse(localStorage.getItem('hnp-vitals') || '{}');
      } catch {
        return {};
      }
    })();
    const steps = Number(vitals.days?.[today]?.steps) || 0;
    if (steps < 8000) {
      items.push({
        id: `steps-${today}`,
        title: 'قدم‌شمار',
        text: `تا حالا ${faNum(steps)} قدم. هدف امروز ۸۰۰۰ قدم است.`,
        href: 'goals.html',
      });
    }
    if (!user.premium && !user.subscriptionUntil) {
      items.push({
        id: 'sub',
        title: 'اشتراک',
        text: 'با اشتراک، رژیم مربی و امکانات کامل باز می‌شود.',
        href: 'subscribe.html',
      });
    }
  }
  items.push(
    {
      id: 'water',
      title: 'آب',
      text: 'بین وعده‌ها یک لیوان آب بنوش.',
      href: 'goals.html',
    },
    {
      id: 'scan',
      title: 'اسکن هوشمند',
      text: 'غذایت را اسکن کن تا کالری و قند را سریع ببینی.',
      href: 'scan.html',
    }
  );
  return items;
}

function paintNotices() {
  const items = buildNotices();
  const list = document.getElementById('notice-list');
  const dot = document.getElementById('notice-dot');
  const seen = readSeen();
  const unread = items.filter((item) => !seen.includes(item.id)).length;
  if (dot) dot.hidden = unread === 0;
  if (list) {
    list.innerHTML = items
      .map(
        (item) =>
          `<a class="notice-item" href="${item.href}"><strong>${item.title}</strong><span>${item.text}</span></a>`
      )
      .join('');
  }
}

document.getElementById('btn-notices')?.addEventListener('click', () => {
  const panel = document.getElementById('notice-panel');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  document.getElementById('btn-notices')?.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
  if (!panel.hidden) markSeen(buildNotices().map((item) => item.id));
  const dot = document.getElementById('notice-dot');
  if (dot && !panel.hidden) dot.hidden = true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', paintNotices);
} else {
  paintNotices();
}
