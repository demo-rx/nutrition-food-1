let period = 'week';

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function bucketDays(days, kind) {
  if (kind === 'week' || kind === 'month') {
    return days.map((day) => ({
      label: day.key.slice(5),
      calories: day.calories,
      sugar: day.sugar,
      fat: day.fat,
    }));
  }
  const buckets = new Map();
  days.forEach((day) => {
    const weekKey = day.key.slice(0, 7);
    const prev = buckets.get(weekKey) || { label: weekKey, calories: 0, sugar: 0, fat: 0, n: 0 };
    prev.calories += day.calories;
    prev.sugar += day.sugar;
    prev.fat += day.fat;
    prev.n += 1;
    buckets.set(weekKey, prev);
  });
  return [...buckets.values()].map((item) => ({
    label: item.label,
    calories: item.calories,
    sugar: item.sugar,
    fat: item.fat,
  }));
}

function faDay(label) {
  return String(label || '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function drawBurndown(canvas, burn) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f0fdf4';
  ctx.fillRect(0, 0, w, h);
  const points = burn.points || [];
  if (!points.length) return;
  const pad = 30;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const values = points.flatMap((p) => [p.ideal, p.remaining].filter((n) => n != null));
  const max = Math.max(...values, 1);
  const xOf = (i) => pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yOf = (v) => h - pad - (Number(v) / max) * innerH;

  ctx.strokeStyle = '#dcfce7';
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  if (burn.mode === 'days') {
    ctx.fillStyle = '#bbf7d0';
    ctx.globalAlpha = 0.35;
    points.forEach((p, i) => {
      if (p.week !== 1 && p.week !== 3) return;
      const x1 = xOf(i);
      const x2 = xOf(Math.min(i + 6, points.length - 1));
      if (i % 7 !== 0) return;
      ctx.fillRect(x1, pad, Math.max(2, x2 - x1), innerH);
    });
    ctx.globalAlpha = 1;
  }

  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xOf(i);
    const y = yOf(p.ideal);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#4e8f63';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  let started = false;
  points.forEach((p, i) => {
    if (p.remaining == null) return;
    const x = xOf(i);
    const y = yOf(p.remaining);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#3e7a52';
  points.forEach((p, i) => {
    if (p.remaining == null) return;
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(p.remaining), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '10px Vazirmatn, sans-serif';
  ctx.textAlign = 'center';
  const tickEvery = points.length > 20 ? 7 : points.length > 10 ? 4 : 1;
  points.forEach((p, i) => {
    if (i !== 0 && i !== points.length - 1 && i % tickEvery !== 0) return;
    ctx.fillText(faDay(p.label), xOf(i), h - 8);
  });
}

function drawChart(canvas, points, color, key) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f0fdf4';
  ctx.fillRect(0, 0, w, h);
  if (!points.length) return;
  const values = points.map((p) => p[key]);
  const max = Math.max(...values, 1);
  const pad = 28;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  ctx.strokeStyle = '#dcfce7';
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, i) => {
    const x = pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = h - pad - (point[key] / max) * innerH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = color;
  points.forEach((point, i) => {
    const x = pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = h - pad - (point[key] / max) * innerH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function pct(partKcal, totalKcal) {
  if (!totalKcal) return 0;
  return Math.round((partKcal / totalKcal) * 1000) / 10;
}

function healthLevel(report, compliance) {
  const loggedDays = report.days.filter((d) => d.count).length;
  if (!loggedDays) return { level: 'empty', score: 0, lines: [] };

  const kcal = report.totals.calories;
  const sugarPct = pct(report.totals.sugar * 4, kcal);
  const fatPct = pct(report.totals.fat * 9, kcal);
  const proteinPct = pct(report.totals.protein * 4, kcal);
  const avgCal = Math.round(kcal / loggedDays);
  const target = report.dailyTarget;
  const calDiff = target ? Math.abs(avgCal - target) / target : 1;
  const bmi = HNP.getBmiProfile();

  let score = 0;
  const lines = [];

  if (bmi) {
    if (bmi.cat === 'normal') score += 25;
    else if (bmi.cat === 'over' || bmi.cat === 'under') score += 12;
    else score += 6;
    lines.push(I18N.t('health.bmi', { bmi: String(bmi.bmi), cat: I18N.t(`bmi.${bmi.cat}`) }));
  } else {
    score += 10;
    lines.push(I18N.t('health.noBmi'));
  }

  if (calDiff < 0.1) score += 20;
  else if (calDiff < 0.2) score += 12;
  else score += 6;
  lines.push(
    I18N.t(calDiff < 0.15 ? 'health.energyOk' : 'health.energyOff', {
      avg: String(avgCal),
      target: String(target),
    })
  );

  if (sugarPct < 5) score += 20;
  else if (sugarPct < 10) score += 14;
  else if (sugarPct < 15) score += 8;
  else score += 4;
  lines.push(I18N.t('health.sugar', { n: String(sugarPct) }));

  if (fatPct >= 15 && fatPct <= 35) score += 15;
  else score += 7;
  lines.push(I18N.t('health.fat', { n: String(fatPct) }));

  if (proteinPct >= 10 && proteinPct <= 35) score += 10;
  else score += 5;
  lines.push(I18N.t('health.protein', { n: String(proteinPct) }));

  if (compliance.counts.planned) {
    score += Math.round(compliance.rate / 10);
    lines.push(I18N.t('health.comp', { n: String(compliance.rate) }));
  }

  score += Math.round((loggedDays / Math.max(report.dayCount, 1)) * 10);
  lines.push(I18N.t('health.log', { n: String(loggedDays), d: String(report.dayCount) }));

  score = Math.max(0, Math.min(100, score));
  let level = 'low';
  if (score >= 80) level = 'high';
  else if (score >= 60) level = 'good';
  else if (score >= 40) level = 'fair';
  return { level, score, lines };
}

function coachText(report, compliance) {
  const health = healthLevel(report, compliance);
  const kgAbs = Math.abs(round1(report.kg));
  const trend = report.kg >= 0 ? I18N.t('rep.shouldLose', { kg: kgAbs }) : I18N.t('rep.shouldGain', { kg: kgAbs });
  const meals = report.days
    .filter((d) => d.count)
    .map((d) => {
      const names = d.meals.map((m) => I18N.nameOf({ fa: m.nameFa, en: m.nameEn, ar: m.nameAr }) || m.nameFa).join('، ');
      return `${d.key}: ${round1(d.calories)} kcal / ${I18N.t('sugar.short')} ${round1(d.sugar)}g / ${I18N.t('facts.fat')} ${round1(d.fat)}g — ${names}`;
    })
    .join('\n');
  return [
    I18N.t('rep.coachHead'),
    `${I18N.t('rep.range')}: ${HNP.dateKey(report.start)} → ${HNP.dateKey(report.end)}`,
    `${I18N.t('card.cal')}: ${round1(report.totals.calories)}`,
    `${I18N.t('facts.sugar')}: ${round1(report.totals.sugar)} g`,
    `${I18N.t('facts.protein')}: ${round1(report.totals.protein)} g`,
    `${I18N.t('facts.fat')}: ${round1(report.totals.fat)} g`,
    `${I18N.t('rep.logged')}: ${report.totals.count}`,
    `${I18N.t('rep.target')}: ${report.dailyTarget}`,
    trend,
    '',
    I18N.t('health.title'),
    health.level === 'empty'
      ? I18N.t('health.empty')
      : `${I18N.t(`health.level.${health.level}`)} — ${I18N.t('health.score', { n: String(health.score) })}`,
    ...(health.lines || []),
    I18N.t('health.disc'),
    '',
    I18N.t('rep.compTitle'),
    `${I18N.t('rep.compRate')}: ${compliance.rate}%`,
    `${I18N.t('alert.followed')}: ${compliance.counts.followed}`,
    `${I18N.t('alert.altOk')}: ${compliance.counts.altOk}`,
    `${I18N.t('alert.substitute')}: ${compliance.counts.substitute}`,
    `${I18N.t('alert.missed')}: ${compliance.counts.missed}`,
    '',
    I18N.t('rep.mealsTitle'),
    meals || I18N.t('empty.meals'),
  ].join('\n');
}

function renderReport() {
  const targetInput = document.getElementById('cal-target');
  const target = Number(targetInput.value) || HNP.getCalorieTarget();
  HNP.setCalorieTarget(target);
  const report = HNP.rangeReport(period);
  const compliance = HNP.rangeCompliance(period);
  const health = healthLevel(report, compliance);
  const healthBox = document.getElementById('health-card');
  if (health.level === 'empty') {
    healthBox.innerHTML = `
      <h3 class="fa-text">${I18N.t('health.title')}</h3>
      <p class="auth-note">${I18N.t('health.empty')}</p>
      <p class="auth-note">${I18N.t('health.disc')}</p>
    `;
  } else {
    healthBox.innerHTML = `
      <h3 class="fa-text">${I18N.t('health.title')}</h3>
      <p class="health-badge health-${health.level}">${I18N.t(`health.level.${health.level}`)}</p>
      <p class="fa-text">${I18N.t('health.score', { n: String(health.score) })}</p>
      <ul class="health-points">${health.lines.map((line) => `<li>${line}</li>`).join('')}</ul>
      <p class="auth-note">${I18N.t('health.disc')}</p>
    `;
  }
  const kgAbs = Math.abs(round1(report.kg));
  const trendHtml =
    report.kg >= 0
      ? I18N.t('rep.shouldLose', { kg: kgAbs })
      : I18N.t('rep.shouldGain', { kg: kgAbs });

  document.getElementById('report-summary').innerHTML = `
    <h3 class="fa-text">${I18N.t('rep.summary')}</h3>
    <p class="auth-note">${HNP.dateKey(report.start)} → ${HNP.dateKey(report.end)}</p>
    <p class="fa-text">${I18N.t('card.cal')}: <strong>${round1(report.totals.calories)}</strong></p>
    <p class="fa-text">${I18N.t('facts.sugar')}: <strong>${round1(report.totals.sugar)} g</strong></p>
    <p class="fa-text">${I18N.t('facts.protein')}: <strong>${round1(report.totals.protein)} g</strong></p>
    <p class="fa-text">${I18N.t('facts.fat')}: <strong>${round1(report.totals.fat)} g</strong></p>
    <p class="fa-text">${I18N.t('rep.logged')}: <strong>${report.totals.count}</strong></p>
    <p class="fa-text">${trendHtml}</p>
  `;

  const points = bucketDays(report.days, period);
  drawChart(document.getElementById('chart-cal'), points, '#16a34a', 'calories');
  drawChart(document.getElementById('chart-sugar'), points, '#d97706', 'sugar');
  drawChart(document.getElementById('chart-fat'), points, '#7c3aed', 'fat');

  const burn = HNP.planBurndown(period);
  const burnCaption = document.getElementById('burn-caption');
  const burnCanvas = document.getElementById('chart-burn');
  if (!burn.points.length) {
    burnCaption.textContent = I18N.t('rep.burnEmpty');
    burnCanvas.getContext('2d').clearRect(0, 0, burnCanvas.width, burnCanvas.height);
  } else {
    const gap = Number(burn.gap) || 0;
    if (gap > 1) burnCaption.textContent = I18N.t('rep.burnBehind', { n: faDay(String(Math.abs(gap))) });
    else if (gap < -1) burnCaption.textContent = I18N.t('rep.burnAhead', { n: faDay(String(Math.abs(gap))) });
    else burnCaption.textContent = I18N.t('rep.burnOn');
    drawBurndown(burnCanvas, burn);
  }

  const c = compliance.counts;
  const detailRows = compliance.details.length
    ? compliance.details
        .map((item) => {
          const eaten = item.eaten
            .map((meal) => I18N.nameOf({ fa: meal.nameFa, en: meal.nameEn, ar: meal.nameAr }) || meal.nameFa)
            .join('، ');
          return `<div class="meal-row"><div>
            <p class="fa-text">${item.date} — ${I18N.t(`slot.${item.slot}`)}</p>
            <p class="meta">${I18N.t('coach.planned')}: ${item.planned.name}${eaten ? ` → ${eaten}` : ''}</p>
            <p class="alert-line alert-${item.status}">${I18N.t(`alert.${item.status}`)}</p>
          </div></div>`;
        })
        .join('')
    : `<p class="auth-note">${I18N.t('rep.compEmpty')}</p>`;
  document.getElementById('compliance-card').innerHTML = `
    <h3 class="fa-text">${I18N.t('rep.compTitle')}</h3>
    <p class="auth-note">${I18N.t('rep.compHint')}</p>
    <p class="fa-text">${I18N.t('rep.compRate')}: <strong>${compliance.rate}%</strong></p>
    <p class="fa-text">${I18N.t('alert.followed')}: ${c.followed} · ${I18N.t('alert.altOk')}: ${c.altOk}</p>
    <p class="fa-text">${I18N.t('alert.substitute')}: ${c.substitute} · ${I18N.t('alert.missed')}: ${c.missed}</p>
    ${detailRows}
  `;

  const list = document.getElementById('meal-list');
  const logged = report.days.filter((d) => d.count);
  if (!logged.length) {
    list.innerHTML = `<p class="auth-note">${I18N.t('empty.meals')}</p>`;
    return;
  }
  list.innerHTML = logged
    .map((day) => {
      const rows = day.meals
        .map((meal) => {
          const name = I18N.nameOf({ fa: meal.nameFa, en: meal.nameEn, ar: meal.nameAr }) || meal.nameFa;
          const slot = I18N.t(`slot.${meal.slot}`) || meal.slot;
          return `<div class="meal-row"><div><p class="fa-text">${slot} — ${name}</p><p class="meta">${round1(meal.calories)} kcal · ${I18N.t('sugar.short')} ${round1(meal.sugar)}g · ${I18N.t('facts.fat')} ${round1(meal.fat)}g</p></div></div>`;
        })
        .join('');
      return `<div class="slot-block"><div class="slot-title">${day.key}</div>${rows}</div>`;
    })
    .join('');
}

document.getElementById('cal-target').value = HNP.getCalorieTarget();
document.getElementById('cal-target').addEventListener('change', renderReport);

document.querySelectorAll('.report-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    period = btn.dataset.period;
    document.querySelectorAll('.report-tabs .tab').forEach((el) => el.classList.toggle('active', el === btn));
    renderReport();
  });
});

document.getElementById('btn-copy').addEventListener('click', async () => {
  const text = coachText(HNP.rangeReport(period), HNP.rangeCompliance(period));
  try {
    if (navigator.share) {
      await navigator.share({ title: I18N.t('rep.title'), text });
    } else {
      await navigator.clipboard.writeText(text);
      alert(I18N.t('rep.copied'));
    }
  } catch {
    await navigator.clipboard.writeText(text);
    alert(I18N.t('rep.copied'));
  }
});

document.getElementById('btn-print').addEventListener('click', () => window.print());
document.addEventListener('i18n:change', renderReport);
renderReport();
