const FOOD_SAMPLES = [
  {
    foodName: { fa: 'خوراک مرغ و برنج', en: 'Chicken rice plate', ar: 'طبق دجاج وأرز' },
    calories: 520,
    protein: 32,
    fat: 14,
    saturatedFat: 3.5,
    carbs: 48,
    fiber: 5,
    sugar: 4,
    salt: 1.2,
  },
];

function mockAnalyzeFood(portionInfo = { mode: 'auto' }) {
  const sample = FOOD_SAMPLES[0];

  if (portionInfo.mode === 'manual' && portionInfo.items?.length) {
    const breakdown = portionInfo.items.map((item) => ({
      name: item.name,
      grams: item.grams,
      calories: Math.round(item.grams * 1.5),
      sugar: Math.round(item.grams * 0.015 * 10) / 10,
    }));

    const totalGrams = breakdown.reduce((s, b) => s + b.grams, 0);
    const totalCalories = breakdown.reduce((s, b) => s + b.calories, 0);
    const ratio = totalCalories / sample.calories;

    return {
      foodName: portionInfo.plateEstimate?.foodName || sample.foodName,
      calories: totalCalories,
      protein: Math.round(sample.protein * ratio * 10) / 10,
      fat: Math.round(sample.fat * ratio * 10) / 10,
      saturatedFat: Math.round(sample.saturatedFat * ratio * 10) / 10,
      carbs: Math.round(sample.carbs * ratio * 10) / 10,
      fiber: Math.round(sample.fiber * ratio * 10) / 10,
      sugar: Math.round(sample.sugar * ratio * 10) / 10,
      salt: Math.round(sample.salt * ratio * 10) / 10,
      portionNote: {
        fa: `تأیید شده: ${breakdown.map((b) => `${b.name.fa} ${b.grams}g`).join('، ')}`,
        en: `Confirmed: ${breakdown.map((b) => `${b.name.en} ${b.grams}g`).join(', ')}`,
      },
      confidence: 'high',
      source: 'mock',
      portionMode: 'manual',
      components: breakdown,
    };
  }

  return {
    foodName: sample.foodName,
    calories: sample.calories,
    protein: sample.protein,
    fat: sample.fat,
    saturatedFat: sample.saturatedFat,
    carbs: sample.carbs,
    fiber: sample.fiber,
    sugar: sample.sugar,
    salt: sample.salt,
    portionNote: { fa: 'تخمین از روی عکس', en: 'Estimated from photo' },
    confidence: 'medium',
    source: 'mock',
    portionMode: 'auto',
    components: [],
  };
}

module.exports = { mockAnalyzeFood };
