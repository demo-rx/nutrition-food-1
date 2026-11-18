(function () {
  if (document.getElementById('hnp-feedback')) return;

  const style = document.createElement('style');
  style.textContent = `
    .hnp-fb { position: fixed; z-index: 40; left: 0.55rem; bottom: calc(4.4rem + env(safe-area-inset-bottom, 0px)); width: max-content; max-width: calc(100vw - 1.2rem); display: flex; flex-direction: column; align-items: flex-start; gap: 0.28rem; }
    .hnp-fb-item { border-radius: 10px; overflow: hidden; }
    .hnp-fb-item.is-bug { background: #fef2f2; border: 1px solid #fca5a5; }
    .hnp-fb-item.is-rate { background: #fefce8; border: 1px solid #facc15; }
    .hnp-fb-item.is-ask { background: #eff6ff; border: 1px solid #93c5fd; }
    .hnp-fb-head { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; padding: 0; background: transparent; border: 0; cursor: pointer; }
    .hnp-fb-head svg { width: 18px; height: 18px; display: block; }
    .hnp-fb-item.is-bug .hnp-fb-head { color: #b91c1c; }
    .hnp-fb-item.is-rate .hnp-fb-head { color: #a16207; }
    .hnp-fb-item.is-ask .hnp-fb-head { color: #1d4ed8; }
    .hnp-fb-body { display: flex; flex-direction: column; gap: 0.4rem; padding: 0 0.45rem 0.45rem; min-width: 210px; }
    .hnp-fb-body textarea { width: 100%; box-sizing: border-box; }
    .hnp-fb-body[hidden] { display: none; }
    .hnp-fb-body textarea { min-height: 88px; border: 2px solid #bbf7d0; border-radius: 12px; padding: 0.6rem 0.75rem; font-family: inherit; font-size: 1rem; }
    .hnp-fb-stars { display: flex; gap: 0.35rem; direction: ltr; }
    .hnp-fb-stars button { width: 44px; min-height: 52px; border-radius: 10px; border: 1px solid #bbf7d0; background: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1rem; padding: 0.2rem 0; }
    .hnp-fb-stars button b { font-size: 1.15rem; font-weight: 700; line-height: 1; }
    .hnp-fb-stars button small { font-size: 0.72rem; font-weight: 800; color: #78716c; line-height: 1; }
    .hnp-fb-stars button.on { background: #fef3c7; border-color: #f59e0b; }
    .hnp-fb-scale { display: flex; justify-content: space-between; direction: ltr; margin: 0; font-size: 0.75rem; font-weight: 800; color: #78716c; }
    .hnp-fb-send { min-height: 44px; border: 0; border-radius: 12px; background: #16a34a; color: #fff; font-family: inherit; font-weight: 700; cursor: pointer; }
    .hnp-fb-msg { margin: 0; color: #15803d; font-size: 0.9rem; }
    .hnp-fb-msg.bad { color: #b91c1c; }
    .hnp-chat { width: 280px; max-width: calc(100vw - 1.5rem); display: flex; flex-direction: column; gap: 0.45rem; padding: 0.55rem; }
    .hnp-chat-log { display: flex; flex-direction: column; gap: 0.4rem; max-height: 220px; overflow-y: auto; padding: 0.15rem; }
    .hnp-chat-bubble { max-width: 88%; padding: 0.45rem 0.6rem; border-radius: 12px; font-size: 0.8rem; line-height: 1.55; white-space: pre-wrap; }
    .hnp-chat-bubble.bot { align-self: flex-start; background: #fff; color: #1e3a8a; border: 1px solid #dbeafe; }
    .hnp-chat-bubble.user { align-self: flex-end; background: #16a34a; color: #fff; }
    .hnp-chat-bubble.wait { color: #6b7280; }
    .hnp-chat-row { display: flex; gap: 0.35rem; }
    .hnp-chat-row input { flex: 1; min-width: 0; min-height: 36px; border: 1px solid #93c5fd; border-radius: 10px; padding: 0.35rem 0.55rem; font-family: inherit; font-size: 0.82rem; }
    .hnp-chat-row button { border: 0; border-radius: 10px; background: #1d4ed8; color: #fff; font-family: inherit; font-weight: 700; font-size: 0.78rem; padding: 0 0.7rem; cursor: pointer; }
    .hnp-chat-row button:disabled { opacity: 0.6; cursor: default; }
  `;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.id = 'hnp-feedback';
  root.className = 'hnp-fb';
  root.innerHTML = `
    <article class="hnp-fb-item is-bug">
      <button type="button" class="hnp-fb-head" data-kind="bug" aria-expanded="false" aria-label="گزارش خطا">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/><path d="M12 3.5l9 16H3l9-16z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
      <form class="hnp-fb-body" data-kind="bug" hidden>
        <textarea maxlength="800" placeholder="کجا گیر کردی و چه دیدی؟"></textarea>
        <p class="hnp-fb-msg" hidden></p>
        <button type="submit" class="hnp-fb-send">ثبت گزارش</button>
      </form>
    </article>
    <article class="hnp-fb-item is-rate">
      <button type="button" class="hnp-fb-head" data-kind="rate" aria-expanded="false" aria-label="امتیاز برنامه">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.2l2.4 5.1 5.6.7-4.1 3.8 1.1 5.5L12 15.8 7 18.3l1.1-5.5L4 9l5.6-.7L12 3.2z"/></svg>
      </button>
      <form class="hnp-fb-body" data-kind="rate" hidden>
        <div class="hnp-fb-stars">
          <button type="button" data-star="1" aria-label="امتیاز ۱، کم"><b>★</b><small>۱</small></button>
          <button type="button" data-star="2" aria-label="امتیاز ۲"><b>★</b><small>۲</small></button>
          <button type="button" data-star="3" aria-label="امتیاز ۳"><b>★</b><small>۳</small></button>
          <button type="button" data-star="4" aria-label="امتیاز ۴"><b>★</b><small>۴</small></button>
          <button type="button" data-star="5" class="on" aria-label="امتیاز ۵، عالی"><b>★</b><small>۵</small></button>
        </div>
        <p class="hnp-fb-scale"><span>۱ کم</span><span>۵ عالی</span></p>
        <textarea maxlength="800" placeholder="نظرت دربارهٔ برنامه را بنویس"></textarea>
        <p class="hnp-fb-msg" hidden></p>
        <button type="submit" class="hnp-fb-send">ثبت امتیاز</button>
      </form>
    </article>
    <article class="hnp-fb-item is-ask">
      <button type="button" class="hnp-fb-head" data-kind="ask" aria-expanded="false" aria-label="چطور می‌توانم کمکت کنم؟">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 16.5V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v5A2.5 2.5 0 0 1 15.5 15H9l-3 2.5v-1z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
      <form class="hnp-fb-body hnp-chat" data-kind="ask" hidden>
        <div class="hnp-chat-log">
          <p class="hnp-chat-bubble bot">چطور می‌توانم کمکت کنم؟</p>
        </div>
        <div class="hnp-chat-row">
          <input type="text" maxlength="500" placeholder="سؤالت را بنویس" autocomplete="off">
          <button type="submit">بفرست</button>
        </div>
      </form>
    </article>
  `;

  document.body.appendChild(root);

  let stars = 5;

  function starMarks(avg) {
    const full = Math.max(0, Math.min(5, Math.round(Number(avg) || 0)));
    return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;
  }

  function faNum(n) {
    return Number(n).toLocaleString('fa-IR', { maximumFractionDigits: 1 });
  }

  function paintHomeRate(summary) {
    const el = document.getElementById('home-rate');
    if (!el || !summary) return;
    el.textContent = summary.count
      ? `${starMarks(summary.avg)} ${faNum(summary.avg)} از ۵`
      : '☆☆☆☆☆';
    el.title = '';
  }

  fetch('/api/ratings')
    .then((res) => res.json())
    .then(paintHomeRate)
    .catch(() => {});

  function paintStars() {
    root.querySelectorAll('.hnp-fb-stars button').forEach((btn) => {
      btn.classList.toggle('on', Number(btn.dataset.star) <= stars);
    });
  }

  root.addEventListener('click', (event) => {
    const star = event.target.closest('[data-star]');
    if (star && root.contains(star)) {
      stars = Number(star.dataset.star);
      paintStars();
      return;
    }
    const head = event.target.closest('.hnp-fb-head');
    if (!head || !root.contains(head)) return;
    const body = head.nextElementSibling;
    const willOpen = body.hidden;
    root.querySelectorAll('.hnp-fb-body').forEach((panel) => { panel.hidden = true; });
    root.querySelectorAll('.hnp-fb-head').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
    if (willOpen) {
      body.hidden = false;
      head.setAttribute('aria-expanded', 'true');
      const field = body.querySelector('textarea, input');
      if (field) field.focus();
    }
  });

  async function onFeedbackSubmit(event) {
    const form = event.target;
    if (!form.classList.contains('hnp-fb-body')) return;
    event.preventDefault();
    const kind = form.dataset.kind;
    if (kind === 'ask') {
      const input = form.querySelector('input');
      const log = form.querySelector('.hnp-chat-log');
      const send = form.querySelector('button');
      const question = input.value.trim();
      if (question.length < 2) return;
      const mine = document.createElement('p');
      mine.className = 'hnp-chat-bubble user';
      mine.textContent = question;
      const wait = document.createElement('p');
      wait.className = 'hnp-chat-bubble bot wait';
      wait.textContent = 'در حال نوشتن…';
      log.append(mine, wait);
      log.scrollTop = log.scrollHeight;
      input.value = '';
      send.disabled = true;
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'جواب نیامد');
        wait.classList.remove('wait');
        wait.textContent = data.answer || 'جوابی نیامد.';
      } catch (err) {
        wait.classList.remove('wait');
        wait.textContent = err.message || 'جواب نیامد';
      } finally {
        send.disabled = false;
        log.scrollTop = log.scrollHeight;
        input.focus();
      }
      return;
    }
    const msg = form.querySelector('.hnp-fb-msg');
    const account = typeof HNP !== 'undefined' ? HNP : null;
    const user = account?.currentUser?.() || null;
    if (kind === 'rate' && !user?.email) {
      msg.className = 'hnp-fb-msg bad';
      msg.textContent = 'برای ثبت امتیاز اول وارد حساب شو.';
      msg.hidden = false;
      return;
    }
    msg.hidden = true;
    const headers = { 'Content-Type': 'application/json' };
    if (user?.token) headers.Authorization = 'Bearer ' + user.token;
    const text = form.querySelector('textarea').value;
    try {
      const res = await fetch(kind === 'ask' ? '/api/ask' : '/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify(kind === 'ask'
          ? { question: text }
          : { kind, stars, text, email: user?.email || '', page: location.pathname + location.search }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ثبت نشد');
      msg.className = 'hnp-fb-msg';
      msg.textContent = kind === 'ask'
        ? data.answer
        : (kind === 'rate' ? 'امتیاز ثبت شد. نظرت در بخش نظرات است.' : 'گزارش خطا ثبت شد.');
      msg.hidden = false;
      if (kind === 'rate') paintHomeRate(data);
      if (kind !== 'ask') form.querySelector('textarea').value = '';
    } catch (err) {
      msg.className = 'hnp-fb-msg bad';
      msg.textContent = err.message || 'ثبت نشد';
      msg.hidden = false;
    }
  }

  root.addEventListener('submit', onFeedbackSubmit);
})();
