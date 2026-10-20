// ============================================================
//  RuleCard — Shared Utilities
// ============================================================

// ─── Card Strength ───────────────────────────────────────────
function getStrengthLabel(card) {
  const r = card.repetitions ?? 0;
  if (r === 0) return { label: '🆕 Новая',   cls: 'badge-new'      };
  if (r <= 2)  return { label: '📖 Учу',     cls: 'badge-learning' };
  if (r <= 5)  return { label: '✅ Знаю',    cls: 'badge-known'    };
               return { label: '🌟 Отлично', cls: 'badge-mastered' };
}

// ─── Due Check ───────────────────────────────────────────────
function isDue(card) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= new Date();
}

// ─── Highlight search term in text ──────────────────────────
function highlight(text, query) {
  if (!query || !text) return esc(text || '');
  const safe = esc(text);
  const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(
    new RegExp(`(${safeQ})`, 'gi'),
    '<mark class="search-highlight">$1</mark>'
  );
}

// ─── Format duration (seconds → mm:ss) ──────────────────────
function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Format date (ISO → readable) ───────────────────────────
function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

// ─── Plural forms for Russian ────────────────────────────────
function pluralDays(n) {
  if (n % 100 >= 11 && n % 100 <= 19) return 'дней';
  const r = n % 10;
  if (r === 1) return 'день';
  if (r >= 2 && r <= 4) return 'дня';
  return 'дней';
}

function pluralCards(n) {
  if (n % 100 >= 11 && n % 100 <= 19) return 'карточек';
  const r = n % 10;
  if (r === 1) return 'карточка';
  if (r >= 2 && r <= 4) return 'карточки';
  return 'карточек';
}

// ─── Escape HTML ─────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
