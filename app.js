// ============================================================
//  RuleCard — Main Application v2.0
// ============================================================

const EMOJIS = ['📚','✏️','🧠','📝','🔤','🗣️','📖','🌍','🇷🇺','🔢','🎯','⚡','🌟','💡','🎓','🔬','📐','🎨'];

// ─── State ────────────────────────────────────────────────────
const state = {
  subjects:      [],
  studyCards:    [],
  studyIndex:    0,
  studyMode:     null,
  studySection:  null,
  studySubject:  null,
  results:       { forgot: 0, hard: 0, good: 0, easy: 0 },
  vocabRows:     [{ word: '', note: '' }],
  selectedEmoji: '📚',
  shuffleMode:   false,

  // Session timer
  sessionStart:  null,
  sessionTimer:  null,

  // Unsaved form guard
  formDirty:     false,
  formDraftKey:  null,
};

// ─── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await db.open();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }
  await loadSubjects();
  renderHome();
});

// ─── Protect against accidental close during form edit ────────
window.addEventListener('beforeunload', (e) => {
  if (state.formDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function loadSubjects() {
  state.subjects = await db.getAll('subjects');
}

// ─── Toast ────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2200) {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'globalToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── Confirm Dialog ───────────────────────────────────────────
function showConfirm(title, desc, onConfirm) {
  let ov = document.getElementById('confirmOverlay');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'confirmOverlay';
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="dialog">
      <div class="dialog-title">${title}</div>
      <div class="dialog-desc">${desc}</div>
      <div class="dialog-buttons">
        <button class="btn btn-secondary flex1" id="confirmCancel">Отмена</button>
        <button class="btn btn-danger flex1" id="confirmOk">Подтвердить</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('confirmCancel').onclick = () => ov.remove();
  document.getElementById('confirmOk').onclick = () => { ov.remove(); onConfirm(); };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ─── Render Helpers ───────────────────────────────────────────
function setApp(html) {
  stopSessionTimer();
  state.formDirty = false;
  document.getElementById('app').innerHTML = html;
}

function topbar(title, subtitle, backFn, extra = '') {
  return `
    <div class="topbar">
      <button class="btn-icon" id="btnBack" aria-label="Назад">←</button>
      <div class="topbar-title">
        ${title}
        ${subtitle ? `<span class="topbar-subtitle">${subtitle}</span>` : ''}
      </div>
      ${extra}
    </div>`;
}

function afterRender(backFn) {
  const btn = document.getElementById('btnBack');
  if (btn && backFn) btn.onclick = backFn;
}

// ─────────────────────────────────────────────────────────────
//  SESSION TIMER
// ─────────────────────────────────────────────────────────────
function startSessionTimer() {
  state.sessionStart = Date.now();
  state.sessionTimer = setInterval(() => {
    const el = document.getElementById('sessionTimer');
    if (!el) { stopSessionTimer(); return; }
    const secs = Math.floor((Date.now() - state.sessionStart) / 1000);
    el.textContent = `⏱ ${fmtDuration(secs)}`;
  }, 1000);
}

function stopSessionTimer() {
  if (state.sessionTimer) {
    clearInterval(state.sessionTimer);
    state.sessionTimer = null;
  }
}

function getSessionDuration() {
  if (!state.sessionStart) return 0;
  return Math.floor((Date.now() - state.sessionStart) / 1000);
}

// ─────────────────────────────────────────────────────────────
//  HOME SCREEN
// ─────────────────────────────────────────────────────────────
async function renderHome() {
  const allCards  = await db.getAll('cards');
  const dueCount  = allCards.filter(isDue).length;
  const totalCards = allCards.length;
  const streak    = getStreak();
  const todayLog  = getTodayLog();
  const masteredCount = allCards.filter(c => (c.repetitions ?? 0) > 5).length;
  const masteredPct   = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  setApp(`
    <div class="screen" id="screenHome">
      <div class="home-hero">
        <span class="home-logo">📚</span>
        <h1 class="home-title">RuleCard</h1>
        <p class="home-subtitle">Учи правила и повторяй слова</p>
        ${streak > 0 ? `<div class="streak-badge">🔥 ${streak} ${pluralDays(streak)} подряд!</div>` : ''}
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num">${state.subjects.length}</div>
          <div class="stat-label">Предметов</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${totalCards}</div>
          <div class="stat-label">Карточек</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color: ${dueCount > 0 ? 'var(--accent)' : 'var(--green)'}">${dueCount}</div>
          <div class="stat-label">На сегодня</div>
        </div>
      </div>

      ${totalCards > 0 ? `
      <div class="home-progress-wrap">
        <div class="home-progress-header">
          <span class="home-progress-label">Прогресс освоения</span>
          <span class="home-progress-pct">${masteredPct}%</span>
        </div>
        <div class="home-progress-track">
          <div class="home-progress-fill" style="width:${masteredPct}%"></div>
        </div>
        <div class="home-progress-sub">
          ${masteredCount} из ${totalCards} карточек освоено
          ${todayLog.studied > 0 ? ` · сегодня повторил ${todayLog.studied}` : ''}
        </div>
      </div>` : ''}

      <div class="home-actions">
        <button class="action-card primary" id="btnStudy">
          <div class="action-icon">🎯</div>
          <div class="action-text">
            <div class="action-title">Учиться</div>
            <div class="action-desc">${dueCount > 0 ? `${dueCount} карточек на повторение` : 'Выбрать раздел для изучения'}</div>
          </div>
          <span class="action-arrow">›</span>
        </button>

        <button class="action-card accent" id="btnManage">
          <div class="action-icon">✏️</div>
          <div class="action-text">
            <div class="action-title">Управление</div>
            <div class="action-desc">Добавить предметы, разделы, карточки</div>
          </div>
          <span class="action-arrow">›</span>
        </button>
      </div>

      <div class="home-quick-row">
        <button class="quick-btn" id="btnSearch">
          <span class="quick-btn-icon">🔍</span>
          <span class="quick-btn-label">Поиск</span>
        </button>
        <button class="quick-btn" id="btnStats">
          <span class="quick-btn-icon">📊</span>
          <span class="quick-btn-label">Статистика</span>
        </button>
        <button class="quick-btn" id="btnSettings">
          <span class="quick-btn-icon">⚙️</span>
          <span class="quick-btn-label">Настройки</span>
        </button>
      </div>
    </div>`);

  document.getElementById('btnStudy').onclick   = () => renderSubjectPicker();
  document.getElementById('btnManage').onclick  = () => renderSubjectList();
  document.getElementById('btnSearch').onclick  = renderSearch;
  document.getElementById('btnStats').onclick   = renderStats;
  document.getElementById('btnSettings').onclick = renderSettings;
}

// ─────────────────────────────────────────────────────────────
//  SUBJECT PICKER (for study)
// ─────────────────────────────────────────────────────────────
async function renderSubjectPicker() {
  await loadSubjects();
  const sections = await db.getAll('sections');
  const cards    = await db.getAll('cards');

  if (state.subjects.length === 0) {
    setApp(`
      <div class="screen">
        ${topbar('Учиться', '', renderHome)}
        <div class="content content--center">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">Нет предметов</div>
            <div class="empty-desc">Сначала добавь предметы и карточки в «Управлении»</div>
          </div>
          <button class="btn btn-primary mt-16" id="btnGoManage">Управление</button>
        </div>
      </div>`);
    afterRender(renderHome);
    document.getElementById('btnGoManage').onclick = () => renderSubjectList();
    return;
  }

  const items = state.subjects.map(s => {
    const secs = sections.filter(x => x.subjectId === s.id);
    const secIds = secs.map(x => x.id);
    const sc = cards.filter(c => secIds.includes(c.sectionId));
    return { ...s, cardCount: sc.length, dueCount: sc.filter(isDue).length };
  });

  setApp(`
    <div class="screen">
      ${topbar('Учиться', 'Выбери предмет', renderHome)}
      <div class="content">
        ${items.map(s => `
          <div class="list-item" id="subjectStudy_${s.id}">
            <div class="list-item-icon">${s.emoji || '📚'}</div>
            <div class="list-item-body">
              <div class="list-item-name">${esc(s.name)}</div>
              <div class="list-item-meta">${s.cardCount} карточек${s.dueCount > 0 ? ` · <span style="color:var(--accent)">${s.dueCount} на сегодня</span>` : ''}</div>
            </div>
            <span class="action-arrow">›</span>
          </div>`).join('')}
      </div>
    </div>`);
  afterRender(renderHome);
  items.forEach(s => {
    document.getElementById(`subjectStudy_${s.id}`).onclick = () => renderModePicker(s);
  });
}

// ─────────────────────────────────────────────────────────────
//  MODE PICKER
// ─────────────────────────────────────────────────────────────
async function renderModePicker(subject) {
  const sections    = await db.getByIndex('sections', 'subjectId', subject.id);
  const cards       = await db.getAll('cards');
  const secIds      = sections.map(s => s.id);
  const subjectCards = cards.filter(c => secIds.includes(c.sectionId));
  const dueCount    = subjectCards.filter(isDue).length;

  setApp(`
    <div class="screen">
      ${topbar(subject.name, 'Режим изучения', () => renderSubjectPicker())}
      <div class="content">
        <p class="section-header">Выбери режим</p>
        <div class="mode-grid">
          <div class="mode-card" id="modeManual">
            <div class="mode-icon">🗂️</div>
            <div class="mode-name">По разделам</div>
            <div class="mode-desc">Сам выбираю раздел</div>
          </div>
          <div class="mode-card" id="modeSmart">
            <div class="mode-icon">🧠</div>
            <div class="mode-name">Умный режим</div>
            <div class="mode-desc">${dueCount} карточек на сегодня</div>
          </div>
        </div>
      </div>
    </div>`);
  afterRender(() => renderSubjectPicker());

  document.getElementById('modeManual').onclick = () => renderSectionPicker(subject);
  document.getElementById('modeSmart').onclick  = async () => {
    if (dueCount === 0) { showToast('Нет карточек на сегодня 🎉'); return; }
    const dueCards = subjectCards.filter(isDue).sort(() => Math.random() - 0.5);
    startStudy(dueCards, 'smart', subject);
  };
}

// ─────────────────────────────────────────────────────────────
//  SECTION PICKER (manual mode)
// ─────────────────────────────────────────────────────────────
async function renderSectionPicker(subject) {
  const sections = await db.getByIndex('sections', 'subjectId', subject.id);
  const cards    = await db.getAll('cards');

  if (sections.length === 0) {
    setApp(`
      <div class="screen">
        ${topbar(subject.name, '', () => renderModePicker(subject))}
        <div class="content content--center">
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">Нет разделов</div>
            <div class="empty-desc">Добавь разделы в «Управлении»</div>
          </div>
        </div>
      </div>`);
    afterRender(() => renderModePicker(subject));
    return;
  }

  const items = sections.map(sec => {
    const secCards = cards.filter(c => c.sectionId === sec.id);
    return { ...sec, cardCount: secCards.length, dueCount: secCards.filter(isDue).length };
  });

  setApp(`
    <div class="screen">
      ${topbar(subject.name, 'Выбери раздел', () => renderModePicker(subject))}
      <div class="content">
        <div class="shuffle-toggle-row">
          <span class="shuffle-label">🔀 Перемешать карточки</span>
          <label class="toggle-switch">
            <input type="checkbox" id="shuffleToggle" ${state.shuffleMode ? 'checked' : ''}>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
        <div class="section-picker">
          ${items.map(sec => `
            <div class="section-pick-item" id="secPick_${sec.id}">
              <div class="section-pick-info">
                <div class="section-pick-name">${esc(sec.name)}</div>
                <div class="section-pick-count">${sec.cardCount} карточек</div>
              </div>
              ${sec.dueCount > 0 ? `<span class="section-pick-due">${sec.dueCount} сегодня</span>` : ''}
              <span class="action-arrow" style="color:var(--text3)">›</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`);
  afterRender(() => renderModePicker(subject));

  document.getElementById('shuffleToggle').onchange = (e) => { state.shuffleMode = e.target.checked; };

  items.forEach(sec => {
    document.getElementById(`secPick_${sec.id}`).onclick = async () => {
      let secCards = cards.filter(c => c.sectionId === sec.id);
      if (secCards.length === 0) { showToast('В разделе нет карточек'); return; }
      if (state.shuffleMode) secCards = [...secCards].sort(() => Math.random() - 0.5);
      startStudy(secCards, 'manual', subject, sec);
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  STUDY SESSION
// ─────────────────────────────────────────────────────────────
function startStudy(cards, mode, subject, section = null) {
  state.studyCards   = cards;
  state.studyIndex   = 0;
  state.studyMode    = mode;
  state.studySubject = subject;
  state.studySection = section;
  state.results      = { forgot: 0, hard: 0, good: 0, easy: 0 };
  renderStudyCard();
}

function renderStudyCard() {
  const cards = state.studyCards;
  const idx   = state.studyIndex;
  if (idx >= cards.length) { renderStudyDone(); return; }
  const card  = cards[idx];
  const total = cards.length;
  const pct   = Math.round((idx / total) * 100);
  const sectionLabel = state.studySection ? state.studySection.name : 'Умный режим';
  const note  = getCardNote(card.id);

  setApp(`
    <div class="screen" id="studyScreen">
      ${topbar(
        state.studySubject.name,
        sectionLabel,
        confirmLeaveStudy,
        `<span class="session-timer-badge" id="sessionTimer">⏱ 0:00</span>`
      )}
      <div class="study-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label"><span>Карточка ${idx + 1} из ${total}</span><span>${pct}%</span></div>
      </div>

      <div class="study-card-wrap" id="cardWrap">
        <div class="study-card" id="questionCard">
          <div class="card-label">Вопрос</div>
          <div class="card-question">${esc(card.question)}</div>
        </div>
      </div>

      <div class="study-note-bar">
        <textarea class="study-note-input" id="studyNoteInput"
          placeholder="Заметка к этой карточке (сохранится автоматически)..."
          rows="2">${esc(note)}</textarea>
      </div>

      <div class="study-actions" id="studyActions">
        <div class="study-nav-row">
          ${idx > 0 ? `<button class="btn btn-secondary" id="btnPrev" style="flex:0 0 44px">←</button>` : '<span></span>'}
          <button class="btn btn-primary flex1" id="btnShowAnswer">👁 Показать ответ</button>
          <button class="btn btn-secondary" id="btnSkip" style="flex:0 0 44px">→</button>
        </div>
      </div>
    </div>`);

  startSessionTimer();
  afterRender(confirmLeaveStudy);

  // note autosave
  const noteInput = document.getElementById('studyNoteInput');
  noteInput.addEventListener('input', () => saveCardNote(card.id, noteInput.value));

  document.getElementById('btnShowAnswer').onclick = showAnswer;
  document.getElementById('btnSkip').onclick = () => { state.studyIndex++; renderStudyCard(); };
  if (idx > 0) {
    document.getElementById('btnPrev').onclick = () => { state.studyIndex--; renderStudyCard(); };
  }
}

function showAnswer() {
  const card    = state.studyCards[state.studyIndex];
  const wrap    = document.getElementById('cardWrap');
  const actions = document.getElementById('studyActions');

  let answerHtml = `
    <div class="study-card answer-card" id="answerCard">
      <div class="card-label">Правило</div>
      <div class="card-rule-text">${esc(card.rule)}</div>`;
  if (card.verse) {
    answerHtml += `
      <div class="card-divider"></div>
      <div class="card-verse"><span class="card-verse-icon">🎵</span>${esc(card.verse)}</div>`;
  }
  answerHtml += `</div>`;
  wrap.insertAdjacentHTML('beforeend', answerHtml);

  const hasVocab = card.vocabulary && card.vocabulary.filter(v => v.word).length > 0;
  const vocabBtn = hasVocab
    ? `<button class="btn btn-accent" id="btnShowVocab">📖 Показать слова</button>`
    : '';

  const ratingHtml = state.studyMode === 'smart'
    ? `<div class="rating-row">
        <button class="rating-btn r-forgot" data-r="0"><span class="r-emoji">😰</span>Забыл</button>
        <button class="rating-btn r-hard"   data-r="1"><span class="r-emoji">😕</span>Трудно</button>
        <button class="rating-btn r-good"   data-r="2"><span class="r-emoji">😊</span>Хорошо</button>
        <button class="rating-btn r-easy"   data-r="3"><span class="r-emoji">🌟</span>Легко</button>
       </div>`
    : `<div class="study-nav-row">
         ${state.studyIndex > 0 ? `<button class="btn btn-secondary" id="btnPrev2" style="flex:0 0 44px">←</button>` : '<span></span>'}
         <button class="btn btn-primary flex1" id="btnNext">Следующая →</button>
       </div>`;

  actions.innerHTML = `${vocabBtn}${ratingHtml}`;

  if (hasVocab) {
    document.getElementById('btnShowVocab').onclick = () => showVocab(card);
  }
  if (state.studyMode === 'smart') {
    document.querySelectorAll('.rating-btn').forEach(btn => {
      btn.onclick = () => rateCard(parseInt(btn.dataset.r));
    });
  } else {
    document.getElementById('btnNext').onclick = () => { state.studyIndex++; renderStudyCard(); };
    const prev2 = document.getElementById('btnPrev2');
    if (prev2) prev2.onclick = () => { state.studyIndex--; renderStudyCard(); };
  }

  wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
}

function showVocab(card) {
  const vocabItems = card.vocabulary.filter(v => v.word);
  const wrap = document.getElementById('cardWrap');
  const existing = document.getElementById('vocabCard');
  if (existing) existing.remove();

  wrap.insertAdjacentHTML('beforeend', `
    <div class="study-card vocab-card" id="vocabCard">
      <div class="card-label">📖 Слова для примера</div>
      <div class="vocab-list">
        ${vocabItems.map(v => `
          <div class="vocab-item">
            <div class="vocab-word">${esc(v.word)}</div>
            ${v.note ? `<div class="vocab-note">${esc(v.note)}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`);

  const btn = document.getElementById('btnShowVocab');
  if (btn) btn.style.display = 'none';
  wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
}

async function rateCard(rating) {
  const card = state.studyCards[state.studyIndex];
  const ratingKeys = ['forgot', 'hard', 'good', 'easy'];
  state.results[ratingKeys[rating]]++;

  const updates = sm2Update(card, rating);
  await db.put('cards', { ...card, ...updates });

  state.studyIndex++;
  if (state.studyIndex === 1) updateStreak();
  incrementTodayLog();
  renderStudyCard();
}

function confirmLeaveStudy() {
  showConfirm('Выйти из занятия?', 'Прогресс текущей сессии будет потерян.', () => {
    stopSessionTimer();
    renderModePicker(state.studySubject);
  });
}

// ─────────────────────────────────────────────────────────────
//  STUDY DONE
// ─────────────────────────────────────────────────────────────
function renderStudyDone() {
  stopSessionTimer();
  const r    = state.results;
  const total = state.studyCards.length;
  const secs = getSessionDuration();

  setApp(`
    <div class="screen">
      ${topbar('Готово!', '', () => renderModePicker(state.studySubject))}
      <div class="done-wrap">
        <div class="done-icon">🎉</div>
        <div class="done-title">Сессия завершена!</div>
        <div class="done-subtitle">Ты прошёл ${total} ${pluralCards(total)}</div>
        ${secs > 0 ? `<div class="done-time">⏱ Время: ${fmtDuration(secs)}</div>` : ''}
        ${state.studyMode === 'smart' ? `
          <div class="result-grid">
            <div class="result-item"><div class="result-num red">${r.forgot}</div><div class="result-lbl">😰 Забыл</div></div>
            <div class="result-item"><div class="result-num yellow">${r.hard}</div><div class="result-lbl">😕 Трудно</div></div>
            <div class="result-item"><div class="result-num green">${r.good}</div><div class="result-lbl">😊 Хорошо</div></div>
            <div class="result-item"><div class="result-num purple">${r.easy}</div><div class="result-lbl">🌟 Легко</div></div>
          </div>` : ''}
        <button class="btn btn-primary mt-16" id="btnStudyAgain">Ещё раз</button>
        <button class="btn btn-secondary mt-8" id="btnGoHome">На главную</button>
      </div>
    </div>`);
  afterRender(() => renderModePicker(state.studySubject));
  document.getElementById('btnStudyAgain').onclick = () => {
    if (state.studyMode === 'smart') renderModePicker(state.studySubject);
    else startStudy(state.studyCards, state.studyMode, state.studySubject, state.studySection);
  };
  document.getElementById('btnGoHome').onclick = renderHome;
}

// ─────────────────────────────────────────────────────────────
//  MANAGE — SUBJECT LIST
// ─────────────────────────────────────────────────────────────
async function renderSubjectList() {
  await loadSubjects();
  const sections = await db.getAll('sections');

  setApp(`
    <div class="screen">
      ${topbar('Управление', 'Предметы', renderHome)}
      <div class="content">
        ${state.subjects.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-title">Нет предметов</div>
            <div class="empty-desc">Нажми + чтобы добавить первый предмет</div>
          </div>` :
          state.subjects.map(s => {
            const secCount = sections.filter(x => x.subjectId === s.id).length;
            return `
              <div class="list-item" id="subjectRow_${s.id}">
                <div class="list-item-icon">${s.emoji || '📚'}</div>
                <div class="list-item-body">
                  <div class="list-item-name">${esc(s.name)}</div>
                  <div class="list-item-meta">${secCount} разделов</div>
                </div>
                <div class="list-item-actions">
                  <button class="btn-sm" id="editSubject_${s.id}" title="Редактировать">✏️</button>
                  <button class="btn-sm danger" id="delSubject_${s.id}" title="Удалить">🗑</button>
                </div>
              </div>`;
          }).join('')
        }
      </div>
      <button class="fab" id="fabAddSubject" title="Добавить предмет">+</button>
    </div>`);

  afterRender(renderHome);
  document.getElementById('fabAddSubject').onclick = () => renderEditSubject(null);

  state.subjects.forEach(s => {
    document.getElementById(`subjectRow_${s.id}`).addEventListener('click', (e) => {
      if (!e.target.closest('.list-item-actions')) renderSectionList(s);
    });
    document.getElementById(`editSubject_${s.id}`).onclick = (e) => { e.stopPropagation(); renderEditSubject(s); };
    document.getElementById(`delSubject_${s.id}`).onclick  = (e) => {
      e.stopPropagation();
      showConfirm('Удалить предмет?', `«${s.name}» и все его разделы и карточки будут удалены.`, () => deleteSubject(s.id));
    };
  });
}

async function deleteSubject(id) {
  const sections = await db.getByIndex('sections', 'subjectId', id);
  for (const sec of sections) {
    await db.deleteByIndex('cards', 'sectionId', sec.id);
    await db.delete('sections', sec.id);
  }
  await db.delete('subjects', id);
  showToast('Предмет удалён');
  renderSubjectList();
}

// ─────────────────────────────────────────────────────────────
//  EDIT SUBJECT
// ─────────────────────────────────────────────────────────────
function renderEditSubject(subject) {
  const isEdit = !!subject;
  state.selectedEmoji = subject?.emoji || '📚';

  setApp(`
    <div class="screen">
      ${topbar(isEdit ? 'Редактировать' : 'Новый предмет', '', () => renderSubjectList())}
      <div class="content">
        <div class="form-wrap">
          <div class="form-group">
            <label class="form-label">Название предмета</label>
            <input class="form-input" id="subjectName" type="text" placeholder="Например: Русский язык"
              value="${esc(subject?.name || '')}" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">Иконка</label>
            <div class="emoji-row" id="emojiRow">
              ${EMOJIS.map(e => `<button class="emoji-opt${e === state.selectedEmoji ? ' selected' : ''}"
                data-emoji="${e}">${e}</button>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary mt-16" id="btnSaveSubject">
            ${isEdit ? '💾 Сохранить' : '+ Создать'}
          </button>
        </div>
      </div>
    </div>`);

  afterRender(() => renderSubjectList());

  const nameInput = document.getElementById('subjectName');
  nameInput.addEventListener('input', () => { state.formDirty = true; });

  document.querySelectorAll('.emoji-opt').forEach(btn => {
    btn.onclick = () => {
      state.selectedEmoji = btn.dataset.emoji;
      document.querySelectorAll('.emoji-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });

  document.getElementById('btnSaveSubject').onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) { showToast('Введи название'); return; }
    const data = { name, emoji: state.selectedEmoji };
    if (isEdit) await db.put('subjects', { ...subject, ...data });
    else await db.add('subjects', data);
    state.formDirty = false;
    showToast(isEdit ? 'Сохранено!' : 'Предмет добавлен!');
    renderSubjectList();
  };
}

// ─────────────────────────────────────────────────────────────
//  SECTION LIST
// ─────────────────────────────────────────────────────────────
async function renderSectionList(subject) {
  const sections = await db.getByIndex('sections', 'subjectId', subject.id);
  const cards    = await db.getAll('cards');

  setApp(`
    <div class="screen">
      ${topbar(subject.name, 'Разделы', () => renderSubjectList())}
      <div class="content">
        ${sections.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📂</div>
            <div class="empty-title">Нет разделов</div>
            <div class="empty-desc">Нажми + чтобы добавить раздел</div>
          </div>` :
          sections.map(sec => {
            const cnt = cards.filter(c => c.sectionId === sec.id).length;
            const due = cards.filter(c => c.sectionId === sec.id && isDue(c)).length;
            return `
              <div class="list-item" id="secRow_${sec.id}">
                <div class="list-item-icon" style="background:rgba(77,184,136,0.12);font-size:1.2rem">📑</div>
                <div class="list-item-body">
                  <div class="list-item-name">${esc(sec.name)}</div>
                  <div class="list-item-meta">${cnt} карточек${due > 0 ? ` · <span style="color:var(--accent)">${due} сегодня</span>` : ''}</div>
                </div>
                <div class="list-item-actions">
                  <button class="btn-sm" id="editSec_${sec.id}">✏️</button>
                  <button class="btn-sm danger" id="delSec_${sec.id}">🗑</button>
                </div>
              </div>`;
          }).join('')}
      </div>
      <button class="fab" id="fabAddSec">+</button>
    </div>`);

  afterRender(() => renderSubjectList());
  document.getElementById('fabAddSec').onclick = () => renderEditSection(null, subject);

  sections.forEach(sec => {
    document.getElementById(`secRow_${sec.id}`).addEventListener('click', (e) => {
      if (!e.target.closest('.list-item-actions')) renderCardList(sec, subject);
    });
    document.getElementById(`editSec_${sec.id}`).onclick = (e) => { e.stopPropagation(); renderEditSection(sec, subject); };
    document.getElementById(`delSec_${sec.id}`).onclick  = (e) => {
      e.stopPropagation();
      showConfirm('Удалить раздел?', `«${sec.name}» и все его карточки будут удалены.`, async () => {
        await db.deleteByIndex('cards', 'sectionId', sec.id);
        await db.delete('sections', sec.id);
        showToast('Раздел удалён');
        renderSectionList(subject);
      });
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  EDIT SECTION
// ─────────────────────────────────────────────────────────────
function renderEditSection(section, subject) {
  const isEdit = !!section;
  setApp(`
    <div class="screen">
      ${topbar(isEdit ? 'Редактировать раздел' : 'Новый раздел', subject.name, () => renderSectionList(subject))}
      <div class="content">
        <div class="form-wrap">
          <div class="form-group">
            <label class="form-label">Название раздела</label>
            <input class="form-input" id="secName" type="text"
              placeholder="Например: Двойная НН в существительных"
              value="${esc(section?.name || '')}" autocomplete="off">
          </div>
          <button class="btn btn-primary mt-16" id="btnSaveSec">
            ${isEdit ? '💾 Сохранить' : '+ Создать'}
          </button>
        </div>
      </div>
    </div>`);
  afterRender(() => renderSectionList(subject));

  const secNameEl = document.getElementById('secName');
  secNameEl.addEventListener('input', () => { state.formDirty = true; });

  document.getElementById('btnSaveSec').onclick = async () => {
    const name = secNameEl.value.trim();
    if (!name) { showToast('Введи название'); return; }
    if (isEdit) await db.put('sections', { ...section, name });
    else await db.add('sections', { subjectId: subject.id, name });
    state.formDirty = false;
    showToast(isEdit ? 'Сохранено!' : 'Раздел добавлен!');
    renderSectionList(subject);
  };
}

// ─────────────────────────────────────────────────────────────
//  CARD LIST
// ─────────────────────────────────────────────────────────────
async function renderCardList(section, subject) {
  const cards = await db.getByIndex('cards', 'sectionId', section.id);

  setApp(`
    <div class="screen">
      ${topbar(section.name, subject.name, () => renderSectionList(subject))}
      <div class="content">
        ${cards.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🃏</div>
            <div class="empty-title">Нет карточек</div>
            <div class="empty-desc">Нажми + чтобы добавить карточку</div>
          </div>` :
          cards.map(c => {
            const strength = getStrengthLabel(c);
            const noteCount = getCardNote(c.id) ? '📝' : '';
            return `
              <div class="list-item" id="cardRow_${c.id}">
                <div class="list-item-icon" style="background:rgba(124,92,191,0.12);font-size:1rem">🃏</div>
                <div class="list-item-body">
                  <div class="list-item-name">${esc(c.question)}</div>
                  <div class="list-item-meta row gap-8">
                    <span class="badge ${strength.cls}">${strength.label}</span>
                    ${(c.vocabulary || []).filter(v => v.word).length > 0 ? '<span style="font-size:0.7rem;color:var(--green)">📖 слова</span>' : ''}
                    ${c.verse ? '<span style="font-size:0.7rem;color:var(--accent-l)">🎵 стих</span>' : ''}
                    ${noteCount ? `<span style="font-size:0.7rem;color:var(--text3)">${noteCount} заметка</span>` : ''}
                    ${c.nextReview ? `<span style="font-size:0.7rem;color:var(--text3)">📅 ${fmtDate(c.nextReview)}</span>` : ''}
                  </div>
                </div>
                <div class="list-item-actions">
                  <button class="btn-sm" id="editCard_${c.id}">✏️</button>
                  <button class="btn-sm danger" id="delCard_${c.id}">🗑</button>
                </div>
              </div>`;
          }).join('')}
      </div>
      <button class="fab" id="fabAddCard">+</button>
    </div>`);

  afterRender(() => renderSectionList(subject));
  document.getElementById('fabAddCard').onclick = () => renderEditCard(null, section, subject);

  cards.forEach(c => {
    document.getElementById(`cardRow_${c.id}`).addEventListener('click', (e) => {
      if (!e.target.closest('.list-item-actions')) renderEditCard(c, section, subject);
    });
    document.getElementById(`editCard_${c.id}`).onclick = (e) => { e.stopPropagation(); renderEditCard(c, section, subject); };
    document.getElementById(`delCard_${c.id}`).onclick  = (e) => {
      e.stopPropagation();
      showConfirm('Удалить карточку?', `«${c.question}» будет удалена без возможности восстановления.`, async () => {
        await db.delete('cards', c.id);
        showToast('Карточка удалена');
        renderCardList(section, subject);
      });
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  EDIT CARD
// ─────────────────────────────────────────────────────────────
function renderEditCard(card, section, subject) {
  const isEdit = !!card;
  const vocab  = card?.vocabulary?.length > 0 ? card.vocabulary : [{ word: '', note: '' }];
  state.vocabRows = vocab.map(v => ({ ...v }));

  // Load draft if no card (new card) or keep existing values
  const draftKey = isEdit ? null : `draft_card_${section.id}`;
  let draft = null;
  if (draftKey) {
    try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch {}
  }

  setApp(`
    <div class="screen">
      ${topbar(isEdit ? 'Редактировать карточку' : 'Новая карточка', section.name, () => {
        if (state.formDirty) {
          showConfirm('Выйти без сохранения?', 'Введённые данные будут потеряны.', () => {
            state.formDirty = false;
            if (draftKey) localStorage.removeItem(draftKey);
            renderCardList(section, subject);
          });
        } else {
          renderCardList(section, subject);
        }
      })}
      <div class="content">
        <div class="form-wrap">

          <div class="form-group">
            <label class="form-label">Вопрос / Тема</label>
            <input class="form-input" id="cardQuestion" type="text"
              placeholder="Например: Когда пишется двойная НН?"
              value="${esc(draft?.question ?? card?.question ?? '')}" autocomplete="off">
            <span class="form-hint">Это то, что ты видишь в начале — вопрос, на который отвечаешь вслух</span>
          </div>

          <div class="form-group">
            <label class="form-label">Правило (ответ)</label>
            <textarea class="form-textarea" id="cardRule"
              placeholder="Напиши полное правило. Оно появится после нажатия 'Показать ответ'."
              style="min-height:120px">${esc(draft?.rule ?? card?.rule ?? '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">🎵 Стих / Рифма для запоминания</label>
            <textarea class="form-textarea" id="cardVerse"
              placeholder="Необязательно. Рифма или мнемоника для лучшего запоминания.">${esc(draft?.verse ?? card?.verse ?? '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">📖 Словарные слова</label>
            <span class="form-hint mb-8">Слова-примеры к правилу (появятся отдельной кнопкой)</span>
            <div class="vocab-editor" id="vocabEditor">
              ${renderVocabRows(state.vocabRows)}
            </div>
            <button class="btn btn-secondary mt-8" id="btnAddVocab" style="padding:10px">+ Добавить слово</button>
          </div>

          <button class="btn btn-primary mt-16" id="btnSaveCard">
            ${isEdit ? '💾 Сохранить' : '+ Добавить карточку'}
          </button>
          ${isEdit ? `<button class="btn btn-danger mt-8" id="btnResetCard">♻️ Сбросить прогресс</button>` : ''}
          ${draftKey ? `<div class="draft-indicator hidden" id="draftIndicator">💾 Черновик сохранён</div>` : ''}
        </div>
      </div>
    </div>`);

  afterRender(() => {
    if (state.formDirty) {
      showConfirm('Выйти без сохранения?', 'Введённые данные будут потеряны.', () => {
        state.formDirty = false;
        if (draftKey) localStorage.removeItem(draftKey);
        renderCardList(section, subject);
      });
    } else {
      renderCardList(section, subject);
    }
  });

  bindVocabEditor();

  // Auto-save draft for new cards
  function autosaveDraft() {
    if (!draftKey) return;
    state.formDirty = true;
    const q = document.getElementById('cardQuestion')?.value || '';
    const r = document.getElementById('cardRule')?.value     || '';
    const v = document.getElementById('cardVerse')?.value    || '';
    localStorage.setItem(draftKey, JSON.stringify({ question: q, rule: r, verse: v }));
    const ind = document.getElementById('draftIndicator');
    if (ind) { ind.classList.remove('hidden'); setTimeout(() => ind.classList.add('hidden'), 1500); }
  }

  ['cardQuestion', 'cardRule', 'cardVerse'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      state.formDirty = true;
      autosaveDraft();
    });
  });

  document.getElementById('btnAddVocab').onclick = () => {
    state.vocabRows.push({ word: '', note: '' });
    saveVocabState();
    document.getElementById('vocabEditor').innerHTML = renderVocabRows(state.vocabRows);
    bindVocabEditor();
  };

  document.getElementById('btnSaveCard').onclick = async () => {
    const question = document.getElementById('cardQuestion').value.trim();
    const rule     = document.getElementById('cardRule').value.trim();
    const verse    = document.getElementById('cardVerse').value.trim();
    if (!question) { showToast('Введи вопрос'); return; }
    if (!rule)     { showToast('Введи правило'); return; }
    saveVocabState();
    const vocabulary = state.vocabRows.filter(v => v.word.trim());
    const data = {
      sectionId:   section.id,
      question, rule, verse, vocabulary,
      easiness:    card?.easiness    ?? 2.5,
      interval:    card?.interval    ?? 1,
      repetitions: card?.repetitions ?? 0,
      nextReview:  card?.nextReview  ?? null,
      lastReview:  card?.lastReview  ?? null,
    };
    if (isEdit) await db.put('cards', { ...card, ...data });
    else await db.add('cards', data);
    state.formDirty = false;
    if (draftKey) localStorage.removeItem(draftKey);
    showToast(isEdit ? 'Сохранено!' : 'Карточка добавлена!');
    renderCardList(section, subject);
  };

  if (isEdit) {
    document.getElementById('btnResetCard').onclick = () => {
      showConfirm('Сбросить прогресс?', 'Карточка вернётся к начальному состоянию.', async () => {
        await db.put('cards', { ...card, easiness: 2.5, interval: 1, repetitions: 0, nextReview: null, lastReview: null });
        showToast('Прогресс сброшен');
        renderCardList(section, subject);
      });
    };
  }
}

function renderVocabRows(rows) {
  return rows.map((v, i) => `
    <div class="vocab-row" id="vocabRow_${i}">
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <input class="form-input" id="vw_${i}" type="text"
          placeholder="Слово" value="${esc(v.word)}" autocomplete="off">
        <input class="form-input" id="vn_${i}" type="text"
          placeholder="Пояснение (необязательно)" value="${esc(v.note)}" autocomplete="off">
      </div>
      <button class="btn-remove-vocab" data-vi="${i}">✕</button>
    </div>`).join('');
}

function saveVocabState() {
  state.vocabRows.forEach((_, i) => {
    const wEl = document.getElementById(`vw_${i}`);
    const nEl = document.getElementById(`vn_${i}`);
    if (wEl) state.vocabRows[i].word = wEl.value;
    if (nEl) state.vocabRows[i].note = nEl.value;
  });
}

function bindVocabEditor() {
  document.querySelectorAll('.btn-remove-vocab').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.vi);
      saveVocabState();
      state.vocabRows.splice(i, 1);
      if (state.vocabRows.length === 0) state.vocabRows.push({ word: '', note: '' });
      document.getElementById('vocabEditor').innerHTML = renderVocabRows(state.vocabRows);
      bindVocabEditor();
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  CARD NOTES (per-card localStorage notes)
// ─────────────────────────────────────────────────────────────
function getCardNote(cardId) {
  return localStorage.getItem(`note_${cardId}`) || '';
}

function saveCardNote(cardId, text) {
  if (text.trim()) localStorage.setItem(`note_${cardId}`, text);
  else localStorage.removeItem(`note_${cardId}`);
}

// ─────────────────────────────────────────────────────────────
//  STREAK TRACKING
// ─────────────────────────────────────────────────────────────
function getStreak() {
  const lastDate = localStorage.getItem('rc_lastStudy');
  if (!lastDate) return 0;
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (lastDate !== today && lastDate !== yesterdayStr) {
    localStorage.setItem('rc_streak', '0');
    return 0;
  }
  return parseInt(localStorage.getItem('rc_streak') || '0');
}

function updateStreak() {
  const today    = todayStr();
  const lastDate = localStorage.getItem('rc_lastStudy');
  if (lastDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  let streak = parseInt(localStorage.getItem('rc_streak') || '0');
  streak = lastDate === yStr ? streak + 1 : 1;
  localStorage.setItem('rc_lastStudy', today);
  localStorage.setItem('rc_streak', streak.toString());
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────
//  DAILY LOG (cards studied today count)
// ─────────────────────────────────────────────────────────────
function getTodayLog() {
  const key  = `rc_log_${todayStr()}`;
  const raw  = localStorage.getItem(key);
  if (!raw) return { studied: 0 };
  try { return JSON.parse(raw); } catch { return { studied: 0 }; }
}

function incrementTodayLog() {
  const key = `rc_log_${todayStr()}`;
  const log = getTodayLog();
  log.studied = (log.studied || 0) + 1;
  localStorage.setItem(key, JSON.stringify(log));
}

// ─────────────────────────────────────────────────────────────
//  STATISTICS SCREEN
// ─────────────────────────────────────────────────────────────
async function renderStats() {
  const cards    = await db.getAll('cards');
  const subjects = await db.getAll('subjects');
  const sections = await db.getAll('sections');

  const newCards      = cards.filter(c => (c.repetitions ?? 0) === 0);
  const learningCards = cards.filter(c => { const r = c.repetitions ?? 0; return r >= 1 && r <= 2; });
  const knownCards    = cards.filter(c => { const r = c.repetitions ?? 0; return r >= 3 && r <= 5; });
  const masteredCards = cards.filter(c => (c.repetitions ?? 0) > 5);
  const dueToday      = cards.filter(isDue).length;
  const streak        = getStreak();
  const todayLog      = getTodayLog();
  const total         = cards.length || 1;

  const subjectStats = subjects.map(s => {
    const secs   = sections.filter(x => x.subjectId === s.id);
    const secIds = secs.map(x => x.id);
    const sc     = cards.filter(c => secIds.includes(c.sectionId));
    const mastered = sc.filter(c => (c.repetitions ?? 0) > 5).length;
    return { ...s, cardCount: sc.length, dueCount: sc.filter(isDue).length, masteredCount: mastered };
  });

  setApp(`
    <div class="screen">
      ${topbar('Статистика', '', renderHome)}
      <div class="content">

        <div class="stats-hero-row">
          <div class="stats-hero-card">
            <div class="stats-hero-num">${streak}</div>
            <div class="stats-hero-label">🔥 Дней подряд</div>
          </div>
          <div class="stats-hero-card">
            <div class="stats-hero-num" style="color:${dueToday > 0 ? 'var(--accent)' : 'var(--green)'}">${dueToday}</div>
            <div class="stats-hero-label">📅 На сегодня</div>
          </div>
          <div class="stats-hero-card">
            <div class="stats-hero-num" style="color:var(--green)">${todayLog.studied}</div>
            <div class="stats-hero-label">✅ Повторено сегодня</div>
          </div>
        </div>

        <p class="section-header">Прогресс по уровню</p>
        <div class="stats-card">
          ${mkBar('🆕 Новые',    newCards.length,      total, 'var(--text3)')}
          ${mkBar('📖 Учу',      learningCards.length, total, 'var(--yellow)')}
          ${mkBar('✅ Знаю',     knownCards.length,    total, 'var(--green)')}
          ${mkBar('🌟 Отлично',  masteredCards.length, total, 'var(--primary-l)')}
        </div>

        <p class="section-header">По предметам</p>
        ${subjectStats.length === 0
          ? '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Нет данных</div></div>'
          : subjectStats.map(s => {
            const pct = s.cardCount > 0 ? Math.round((s.masteredCount / s.cardCount) * 100) : 0;
            return `
              <div class="list-item" style="flex-direction:column;align-items:stretch;gap:8px;margin-bottom:10px;cursor:default">
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="list-item-icon">${s.emoji || '📚'}</div>
                  <div class="list-item-body">
                    <div class="list-item-name">${esc(s.name)}</div>
                    <div class="list-item-meta">${s.cardCount} карточек
                      ${s.dueCount > 0
                        ? ` · <span style="color:var(--accent)">${s.dueCount} на сегодня</span>`
                        : s.cardCount > 0 ? ' · <span style="color:var(--green)">всё изучено ✓</span>' : ''}
                    </div>
                  </div>
                  <span style="font-size:0.75rem;color:var(--text3);flex-shrink:0">${pct}%</span>
                </div>
                <div class="home-progress-track" style="margin:0 0 4px">
                  <div class="home-progress-fill" style="width:${pct}%"></div>
                </div>
              </div>`;
          }).join('')}

        <p class="section-header">Итого</p>
        <div class="stats-total-row">
          <div class="stat-card"><div class="stat-num">${subjects.length}</div><div class="stat-label">Предметов</div></div>
          <div class="stat-card"><div class="stat-num">${sections.length}</div><div class="stat-label">Разделов</div></div>
          <div class="stat-card"><div class="stat-num">${cards.length}</div><div class="stat-label">Карточек</div></div>
        </div>
      </div>
    </div>`);
  afterRender(renderHome);
}

function mkBar(label, count, total, color) {
  const pct = Math.round((count / total) * 100);
  return `
    <div class="strength-bar-row">
      <div class="strength-bar-label">${label}</div>
      <div class="strength-bar-track">
        <div class="strength-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="strength-bar-count" style="color:${color}">${count}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  SEARCH SCREEN
// ─────────────────────────────────────────────────────────────
async function renderSearch() {
  const cards    = await db.getAll('cards');
  const sections = await db.getAll('sections');
  const subjects = await db.getAll('subjects');

  const secMap = {}; sections.forEach(s => secMap[s.id] = s);
  const subMap = {}; subjects.forEach(s => subMap[s.id] = s);

  setApp(`
    <div class="screen">
      ${topbar('Поиск', 'Все карточки', renderHome)}
      <div class="content">
        <div class="search-bar-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-input" id="searchInput" type="text"
            placeholder="Вопрос, правило, слово..." autocomplete="off">
          <button class="search-clear hidden" id="searchClear">✕</button>
        </div>
        <div id="searchResults">
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Введи запрос</div>
            <div class="empty-desc">Поиск по вопросам, правилам и словам</div>
          </div>
        </div>
      </div>
    </div>`);

  afterRender(renderHome);
  const input    = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  input.focus();

  function doSearch() {
    const q   = input.value.trim();
    const qLo = q.toLowerCase();
    clearBtn.classList.toggle('hidden', !q);
    const container = document.getElementById('searchResults');
    if (!q) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Введи запрос</div></div>`;
      return;
    }
    const results = cards.filter(c =>
      c.question.toLowerCase().includes(qLo) ||
      c.rule.toLowerCase().includes(qLo) ||
      (c.verse || '').toLowerCase().includes(qLo) ||
      (c.vocabulary || []).some(v => v.word.toLowerCase().includes(qLo))
    );
    if (results.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🤷</div><div class="empty-title">Ничего не найдено</div></div>`;
      return;
    }
    container.innerHTML = `
      <p class="section-header">${results.length} результатов</p>
      ${results.map(c => {
        const sec = secMap[c.sectionId];
        const sub = sec ? subMap[sec.subjectId] : null;
        const s   = getStrengthLabel(c);
        const rulePreview = c.rule.substring(0, 140) + (c.rule.length > 140 ? '…' : '');
        return `
          <div class="search-result-item">
            <div class="search-result-meta">${sub ? esc(sub.name) : ''} › ${sec ? esc(sec.name) : ''}</div>
            <div class="search-result-question">${highlight(c.question, q)}</div>
            <div class="search-result-rule">${highlight(rulePreview, q)}</div>
            <div class="search-result-tags">
              <span class="badge ${s.cls}">${s.label}</span>
              ${c.verse ? '<span style="font-size:0.7rem;color:var(--accent-l)">🎵 стих</span>' : ''}
              ${(c.vocabulary||[]).filter(v=>v.word).length > 0 ? '<span style="font-size:0.7rem;color:var(--green)">📖 слова</span>' : ''}
            </div>
          </div>`;
      }).join('')}`;
  }

  input.addEventListener('input', doSearch);
  clearBtn.onclick = () => { input.value = ''; doSearch(); input.focus(); };
}

// ─────────────────────────────────────────────────────────────
//  SETTINGS SCREEN
// ─────────────────────────────────────────────────────────────
function renderSettings() {
  const todayLog  = getTodayLog();
  const streak    = getStreak();
  setApp(`
    <div class="screen">
      ${topbar('Настройки', '', renderHome)}
      <div class="content">

        <p class="section-header">💾 Данные и резервная копия</p>
        <div class="settings-list">
          <div class="settings-item" id="btnExport">
            <div class="settings-item-icon">📤</div>
            <div class="settings-item-body">
              <div class="settings-item-name">Экспорт данных</div>
              <div class="settings-item-desc">Скачать все данные как JSON-файл (резервная копия)</div>
            </div>
            <span class="settings-arrow">›</span>
          </div>
          <div class="settings-item" id="btnImport">
            <div class="settings-item-icon">📥</div>
            <div class="settings-item-body">
              <div class="settings-item-name">Импорт данных</div>
              <div class="settings-item-desc">Восстановить или объединить из JSON-файла</div>
            </div>
            <span class="settings-arrow">›</span>
          </div>
        </div>

        <div class="settings-info-box">
          <div class="settings-info-icon">🔒</div>
          <div class="settings-info-text">Все данные хранятся локально на твоём устройстве в IndexedDB и не удаляются при закрытии приложения. Для надёжности делай экспорт время от времени.</div>
        </div>

        <p class="section-header">📊 Текущая сессия</p>
        <div class="settings-list">
          <div class="settings-item" style="cursor:default">
            <div class="settings-item-icon">🔥</div>
            <div class="settings-item-body">
              <div class="settings-item-name">${streak} ${pluralDays(streak)} подряд</div>
              <div class="settings-item-desc">Серия ежедневных занятий</div>
            </div>
          </div>
          <div class="settings-item" style="cursor:default">
            <div class="settings-item-icon">✅</div>
            <div class="settings-item-body">
              <div class="settings-item-name">${todayLog.studied} карточек сегодня</div>
              <div class="settings-item-desc">Повторено за сегодняшний день</div>
            </div>
          </div>
        </div>

        <p class="section-header">⚠️ Сброс</p>
        <div class="settings-list">
          <div class="settings-item danger" id="btnResetStreak">
            <div class="settings-item-icon">🔥</div>
            <div class="settings-item-body">
              <div class="settings-item-name">Сбросить счётчик дней</div>
              <div class="settings-item-desc">Обнулить streak</div>
            </div>
          </div>
          <div class="settings-item danger" id="btnClearAll">
            <div class="settings-item-icon">🗑</div>
            <div class="settings-item-body">
              <div class="settings-item-name">Удалить ВСЕ данные</div>
              <div class="settings-item-desc">Безвозвратно — сначала сделай экспорт!</div>
            </div>
          </div>
        </div>

        <p class="section-header">ℹ️ О приложении</p>
        <div class="settings-list">
          <div class="settings-item" style="cursor:default">
            <div class="settings-item-icon">📚</div>
            <div class="settings-item-body">
              <div class="settings-item-name">RuleCard v2.0</div>
              <div class="settings-item-desc">PWA · Работает оффлайн · Данные только у тебя</div>
            </div>
          </div>
        </div>

        <input type="file" id="importFileInput" accept=".json" style="display:none">
      </div>
    </div>`);

  afterRender(renderHome);
  document.getElementById('btnExport').onclick  = exportData;
  document.getElementById('btnImport').onclick  = () => document.getElementById('importFileInput').click();
  document.getElementById('importFileInput').onchange = importData;

  document.getElementById('btnResetStreak').onclick = () =>
    showConfirm('Сбросить streak?', 'Счётчик дней подряд будет обнулён.', () => {
      localStorage.removeItem('rc_streak');
      localStorage.removeItem('rc_lastStudy');
      showToast('Streak сброшен');
      renderSettings();
    });

  document.getElementById('btnClearAll').onclick = () =>
    showConfirm('Удалить ВСЕ данные?',
      'Это удалит все предметы, разделы и карточки. Сначала сделай экспорт! Действие нельзя отменить.',
      async () => {
        const allCards    = await db.getAll('cards');
        const allSections = await db.getAll('sections');
        const allSubjects = await db.getAll('subjects');
        for (const c of allCards)    await db.delete('cards',    c.id);
        for (const s of allSections) await db.delete('sections', s.id);
        for (const s of allSubjects) await db.delete('subjects', s.id);
        localStorage.removeItem('rc_streak');
        localStorage.removeItem('rc_lastStudy');
        showToast('Все данные удалены');
        renderHome();
      });
}

// ─────────────────────────────────────────────────────────────
//  EXPORT / IMPORT
// ─────────────────────────────────────────────────────────────
async function exportData() {
  const subjects = await db.getAll('subjects');
  const sections = await db.getAll('sections');
  const cards    = await db.getAll('cards');
  const payload  = { version: 2, exportedAt: new Date().toISOString(), subjects, sections, cards };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `rulecard_${new Date().toISOString().split('T')[0]}.json`
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Экспортировано ${cards.length} карточек ✅`);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.subjects || !data.sections || !data.cards) {
      showToast('Неверный формат файла'); return;
    }
    showConfirm(
      'Импортировать данные?',
      `Будет добавлено: ${data.subjects.length} предм., ${data.sections.length} разд., ${data.cards.length} карточек. Существующие данные останутся.`,
      async () => {
        const subjectIdMap = {};
        for (const s of data.subjects) {
          const { id, ...rest } = s;
          subjectIdMap[id] = await db.add('subjects', rest);
        }
        const sectionIdMap = {};
        for (const s of data.sections) {
          const { id, ...rest } = s;
          rest.subjectId = subjectIdMap[rest.subjectId] ?? rest.subjectId;
          sectionIdMap[id] = await db.add('sections', rest);
        }
        for (const c of data.cards) {
          const { id, ...rest } = c;
          rest.sectionId = sectionIdMap[rest.sectionId] ?? rest.sectionId;
          await db.add('cards', rest);
        }
        showToast(`Импортировано ${data.cards.length} карточек! ✅`);
        await loadSubjects();
        renderHome();
      }
    );
  } catch { showToast('Ошибка чтения файла'); }
  event.target.value = '';
}
