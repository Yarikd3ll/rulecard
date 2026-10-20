// SM-2 Spaced Repetition Algorithm
// rating: 0=Forgot, 1=Hard, 2=Good, 3=Easy

function sm2Update(card, rating) {
  const qualityMap = { 0: 0, 1: 3, 2: 4, 3: 5 };
  const q = qualityMap[rating];

  let easiness = card.easiness ?? 2.5;
  let interval = card.interval ?? 1;
  let repetitions = card.repetitions ?? 0;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easiness);
    repetitions += 1;
  }

  easiness = Math.max(1.3, easiness + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easiness,
    interval,
    repetitions,
    nextReview: nextReview.toISOString().split('T')[0],
    lastReview: new Date().toISOString().split('T')[0]
  };
}

function isDue(card) {
  if (!card.nextReview) return true;
  const today = new Date().toISOString().split('T')[0];
  return card.nextReview <= today;
}

function getStrengthLabel(card) {
  const r = card.repetitions ?? 0;
  if (r === 0) return { label: 'Новая', cls: 'new' };
  if (r <= 2) return { label: 'Учу', cls: 'learning' };
  if (r <= 5) return { label: 'Знаю', cls: 'known' };
  return { label: 'Отлично', cls: 'mastered' };
}
