const app = document.querySelector("#app");

const state = {
  screen: "setup",
  quizzesStatus: "loading",
  quizzes: [],
  selectedCategory: "",
  difficulty: "easy",
  playerName: "",
  setupError: "",
  starting: false,
  sessionId: null,
  question: null,
  totalQuestions: 0,
  answeredCount: 0,
  selectedIndex: null,
  submitting: false,
  answerError: "",
  feedback: null,
  completion: null,
  leaderboardStatus: "idle",
  leaderboard: [],
  leaderboardError: "",
  leaderboardRequest: 0,
};

const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

const formatDuration = (value) => {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload && (payload.message || payload.error);
    throw new Error(message || `The request didn’t work (${response.status}). Please try again.`);
  }
  return payload;
}

function shell(content, screenName = "setup") {
  const sectionLabel = screenName === "quiz" ? "A round in progress" : screenName === "results" ? "Your round, wrapped up" : "A quick brain break";
  return `
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" href="/" aria-label="QuickQuiz home">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">quick<span>quiz</span></span>
        </a>
        <div class="top-note"><span class="top-note-mark" aria-hidden="true"></span>${sectionLabel}</div>
      </header>
      ${content}
      <footer class="app-footer">
        <span>QuickQuiz · Stay curious</span>
        <span>A little thinking goes a long way</span>
      </footer>
    </div>`;
}

function renderSetup() {
  app.innerHTML = shell(`
    <main class="setup-layout reveal">
      <section class="intro-panel" aria-labelledby="intro-title">
        <div class="intro-top eyebrow eyebrow-light"><span class="eyebrow-line"></span> A pocket-sized challenge</div>
        <div class="intro-copy">
          <h1 id="intro-title">A little thinking <em>goes a long way.</em></h1>
          <p>Pick a subject that makes you curious. Take a few questions. Leave with a new fact or two.</p>
        </div>
        <div class="orbit-tag" aria-hidden="true">Curiosity<br>looks good<br>on you</div>
        <div class="intro-foot"><span>No grades. Just good questions.</span><span>01 / 03</span></div>
      </section>
      <section class="setup-content" aria-labelledby="setup-title">
        <div class="setup-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> Make it your kind of quiz</div>
          <h2 id="setup-title">Set up your round</h2>
          <p>Choose a topic, set the pace, and we’ll take it from there.</p>
        </div>
        ${state.setupError ? `
          <div class="notice" role="alert">
            <span class="notice-symbol" aria-hidden="true">!</span>
            <div><strong>We couldn’t start your round.</strong><p>${escapeHTML(state.setupError)}</p></div>
          </div>` : ""}
        ${state.quizzesStatus === "loading" ? `
          <div aria-label="Loading quiz categories">
            <div class="skeleton loading-line"></div>
            <div class="loading-categories">${Array.from({ length: 4 }, () => '<div class="skeleton skeleton-card"></div>').join("")}</div>
          </div>` :
          state.quizzesStatus === "error" ? `
            <div class="notice" role="alert">
              <span class="notice-symbol" aria-hidden="true">!</span>
              <div><strong>Topics haven’t arrived yet.</strong><p>${escapeHTML(state.setupError || "We couldn’t load the quiz categories.")}</p><button class="text-button" type="button" data-action="retry-quizzes">Try again</button></div>
            </div>` :
          state.quizzes.length === 0 ? `
            <div class="empty-state" role="status"><strong>No quizzes to pick from just yet.</strong>There aren’t any available topics right now. Check back in a little while.</div>` :
          `<form class="setup-form" id="setup-form">
            <fieldset class="form-section">
              <legend class="section-heading">Choose a category <span class="section-hint">Pick one</span></legend>
              <div class="category-grid">
                ${state.quizzes.map((quiz, index) => {
                  const selected = state.selectedCategory === quiz.category;
                  const symbol = String(index + 1).padStart(2, "0");
                  const categoryId = `category-${index}`;
                  return `<label class="category-choice" data-selected="${selected}" for="${categoryId}">
                    <input id="${categoryId}" type="radio" name="category" value="${escapeHTML(quiz.category)}" ${selected ? "checked" : ""} required>
                    <span class="category-symbol" aria-hidden="true">${symbol}</span>
                    <span class="category-copy">
                      <span class="category-title">${escapeHTML(quiz.title || quiz.category)}</span>
                      <span class="category-description">${escapeHTML(quiz.description || "")}</span>
                      <span class="category-count">${escapeHTML(quiz.questionCount)} questions</span>
                    </span>
                  </label>`;
                }).join("")}
              </div>
            </fieldset>
            <fieldset class="form-section">
              <legend class="section-heading">Pick your pace <span class="section-hint">You can do this</span></legend>
              <div class="difficulty-options">
                ${["easy", "medium", "hard"].map((level) => `
                  <label class="difficulty-choice">
                    <input type="radio" name="difficulty" value="${level}" ${state.difficulty === level ? "checked" : ""}>
                    <span class="difficulty-label">${level[0].toUpperCase()}${level.slice(1)}</span>
                  </label>`).join("")}
              </div>
            </fieldset>
            <div class="form-section">
              <label class="section-heading" for="player-name">What should we call you? <span class="section-hint">On the leaderboard</span></label>
            <input class="name-field" id="player-name" name="playerName" type="text" maxlength="24" autocomplete="nickname" placeholder="Your name" value="${escapeHTML(state.playerName)}" required>
            </div>
            <div class="form-actions">
              <button class="primary-button start-button" type="submit" ${state.starting || !state.selectedCategory ? "disabled" : ""}>
                <span>${state.starting ? "Getting your questions…" : "Start a quick quiz"}</span><span class="button-arrow" aria-hidden="true">${state.starting ? "…" : "→"}</span>
              </button>
              <p class="form-footnote">A few minutes, a fresh perspective. That’s the whole plan.</p>
            </div>
          </form>`}
      </section>
    </main>`, "setup");
}

function renderQuestionOptions() {
  const locked = Boolean(state.feedback);
  return `<fieldset class="answer-list" ${locked ? 'data-locked="true"' : ""}>
    <legend class="visually-hidden">Choose one answer</legend>
    ${(state.question.options || []).map((option, index) => {
      const selected = state.selectedIndex === index;
      const correct = locked && state.feedback.correctIndex === index;
      const wrong = locked && selected && !state.feedback.correct;
      return `<label class="answer-option" data-selected="${selected}" ${correct ? 'data-correct="true"' : ""} ${wrong ? 'data-wrong="true"' : ""}>
        <input type="radio" name="answer" value="${index}" ${selected ? "checked" : ""} ${locked || state.submitting ? "disabled" : ""}>
        <span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
        <span class="answer-text">${escapeHTML(option)}</span>
      </label>`;
    }).join("")}
  </fieldset>`;
}

function renderQuiz() {
  const total = Math.max(1, Number(state.totalQuestions) || 1);
  const current = Math.min(total, state.answeredCount + (state.feedback ? 0 : 1));
  const percent = Math.round((Math.min(state.answeredCount, total) / total) * 100);
  const category = state.quizzes.find((quiz) => quiz.category === state.selectedCategory);
  const feedback = state.feedback;
  const noNext = feedback && !feedback.completed && !feedback.nextQuestion;
  app.innerHTML = shell(`
    <main class="quiz-layout reveal">
      <div class="quiz-topline">
        <div class="eyebrow eyebrow-dark"><span class="eyebrow-line"></span> Stay curious, ${escapeHTML(state.playerName)}</div>
        <div class="round-meta">
          <span class="meta-chip">${escapeHTML(category?.title || state.question.category)}</span>
          <span class="meta-chip">${escapeHTML(state.difficulty)} pace</span>
        </div>
      </div>
      <div class="progress-wrap" aria-label="Quiz progress">
        <div class="progress-labels"><span>Question ${current} of ${total}</span><span>${percent}% complete</span></div>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(state.answeredCount, total)}" aria-label="Questions answered">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
      </div>
      <div class="quiz-columns">
        <section class="question-card" aria-labelledby="question-title">
          <div class="question-kicker">A question for your curious side</div>
          <h1 class="question-title" id="question-title">${escapeHTML(state.question.prompt)}</h1>
          <form id="answer-form">
            ${renderQuestionOptions()}
            <div class="question-actions">
              <span class="selection-hint">${feedback ? "Your answer is in." : state.selectedIndex === null ? "Go with your first thought." : "Ready when you are."}</span>
              <button class="primary-button submit-answer" type="submit" ${state.submitting || feedback || state.selectedIndex === null ? "disabled" : ""}>
                <span>${state.submitting ? "Checking…" : "Lock in answer"}</span><span class="button-arrow" aria-hidden="true">${state.submitting ? "…" : "→"}</span>
              </button>
            </div>
            ${state.answerError ? `<div class="notice answer-error" role="alert"><span class="notice-symbol" aria-hidden="true">!</span><div><strong>Your answer didn’t go through.</strong><p>${escapeHTML(state.answerError)} Choose “Lock in answer” to try once more.</p></div></div>` : ""}
          </form>
          ${feedback ? `
            <section class="feedback-card ${feedback.correct ? "" : "is-wrong"}" aria-live="polite" aria-atomic="true">
              <h2 class="feedback-title"><span>${feedback.correct ? "That’s right." : "Not quite — now you know."}</span><span aria-hidden="true">${feedback.correct ? "✓" : "↗"}</span></h2>
              ${feedback.explanation ? `<p class="feedback-copy">${escapeHTML(feedback.explanation)}</p>` : `<p class="feedback-copy">The answer is highlighted above. Ready to keep going?</p>`}
              <div class="feedback-actions">
                ${feedback.completed ? `<button class="primary-button" type="button" data-action="show-results"><span>See how you did</span><span class="button-arrow" aria-hidden="true">→</span></button>` :
                  feedback.nextQuestion ? `<button class="primary-button" type="button" data-action="next-question"><span>Next question</span><span class="button-arrow" aria-hidden="true">→</span></button>` :
                  `<button class="secondary-button" type="button" data-action="back-to-setup">Back to setup</button>`}
              </div>
            </section>` : ""}
          ${noNext ? `<div class="notice flow-error" role="status"><span class="notice-symbol" aria-hidden="true">!</span><div><strong>This round has paused.</strong><p>No next question came through, so we can’t continue this session.</p></div></div>` : ""}
        </section>
        <aside class="aside-card">
          <div class="aside-label">A friendly reminder</div>
          <h3>This isn’t a test.</h3>
          <p>It’s a small detour for your brain. Take a breath, trust what you know, and enjoy the surprise.</p>
          <div class="aside-rule"></div>
          <div class="aside-note">Your answer stays hidden until you lock it in. No peeking ahead.</div>
        </aside>
      </div>
    </main>`, "quiz");
}

function renderLeaderboard() {
  if (state.leaderboardStatus === "loading") {
    return `<div class="leaderboard-skeleton" role="status" aria-label="Loading leaderboard">
      ${Array.from({ length: 3 }, () => '<div class="skeleton skeleton-row"></div>').join("")}
    </div>`;
  }
  if (state.leaderboardStatus === "error") {
    return `<div class="notice result-error" role="alert">
      <span class="notice-symbol" aria-hidden="true">!</span>
      <div><strong>Leaderboard unavailable.</strong><p>${escapeHTML(state.leaderboardError)}</p><button class="text-button" type="button" data-action="retry-leaderboard">Try again</button></div>
    </div>`;
  }
  if (!state.leaderboard.length) {
    return `<div class="empty-leaderboard" role="status"><strong>First name on the board?</strong>No completed rounds are listed for this category yet.</div>`;
  }
  return `<div class="leaderboard-list" role="table" aria-label="Category leaderboard">
    <div class="leaderboard-head" role="row">
      <span role="columnheader">Place</span><span role="columnheader">Player</span><span role="columnheader">Score</span><span role="columnheader">Pace</span><span role="columnheader">Date</span>
    </div>
    ${state.leaderboard.map((entry, index) => {
      let completedDate = "—";
      if (entry.completedAt) {
        const date = new Date(entry.completedAt);
        if (!Number.isNaN(date.getTime())) completedDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
      }
      return `<div class="leaderboard-row" role="row">
        <span class="rank-cell" role="cell">${String(index + 1).padStart(2, "0")}</span>
        <span class="player-cell" role="cell"><span class="player-name">${escapeHTML(entry.playerName)}</span><span class="player-detail">${escapeHTML(entry.difficulty)} pace</span></span>
        <span class="leaderboard-value" role="cell"><strong>${escapeHTML(entry.score)}</strong> / ${escapeHTML(entry.totalQuestions)}</span>
        <span class="leaderboard-value" role="cell">${escapeHTML(formatDuration(entry.durationSeconds))}</span>
        <span class="leaderboard-value" role="cell">${escapeHTML(completedDate)}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function renderResults() {
  const result = state.completion || {};
  const category = state.quizzes.find((quiz) => quiz.category === result.category);
  const score = Number(result.score) || 0;
  const total = Number(result.totalQuestions) || state.totalQuestions || 0;
  const perfectRound = total > 0 && score === total;
  app.innerHTML = shell(`
    <main class="results-layout reveal">
      <section class="results-hero" aria-labelledby="results-title">
        <div class="results-copy">
          <div class="eyebrow"><span class="eyebrow-line"></span> Round complete · ${escapeHTML(result.playerName || state.playerName)}</div>
          <h1 id="results-title">${perfectRound ? "A perfect little detour." : "Look at you, getting curious."}</h1>
          <p>${perfectRound ? "Every answer landed. Take a well-earned mental victory lap." : "Every question is a chance to find out something new. Nice work showing up."}</p>
          <div class="result-stats">
            <span class="result-stat"><strong>${escapeHTML(category?.title || result.category)}</strong> category</span>
            <span class="result-stat"><strong>${escapeHTML(String(result.difficulty || state.difficulty))}</strong> pace</span>
            <span class="result-stat"><strong>${escapeHTML(formatDuration(result.durationSeconds))}</strong> elapsed</span>
          </div>
        </div>
        <div class="score-stamp" aria-label="Score ${score} out of ${total}">
          <span class="score-number">${escapeHTML(score)}<span style="font-size:.52em">/${escapeHTML(total)}</span></span>
          <span class="score-caption">your score</span>
        </div>
      </section>
      <section class="leaderboard-section" aria-labelledby="leaderboard-title">
        <div class="leaderboard-heading">
          <div><div class="eyebrow"><span class="eyebrow-line"></span> The curious crowd</div><h2 id="leaderboard-title">Category leaderboard</h2></div>
          <div class="leaderboard-category">${escapeHTML(category?.title || result.category)}</div>
        </div>
        ${renderLeaderboard()}
        <div class="leaderboard-footer">
          <p>Different paces, same curiosity.</p>
          <button class="primary-button" type="button" data-action="back-to-setup"><span>Set up another round</span><span class="button-arrow" aria-hidden="true">→</span></button>
        </div>
      </section>
    </main>`, "results");
}

function render() {
  if (state.screen === "quiz") renderQuiz();
  else if (state.screen === "results") renderResults();
  else renderSetup();
}

async function loadQuizzes() {
  state.quizzesStatus = "loading";
  state.setupError = "";
  render();
  try {
    const result = await api("/api/quizzes");
    if (!result || !Array.isArray(result.quizzes)) throw new Error("The quiz list came back in an unexpected format.");
    state.quizzes = result.quizzes;
    state.quizzesStatus = "loaded";
    if (!state.quizzes.some((quiz) => quiz.category === state.selectedCategory)) {
      state.selectedCategory = state.quizzes[0]?.category || "";
    }
    state.setupError = "";
  } catch (error) {
    state.quizzesStatus = "error";
    state.setupError = error.message || "Please try loading the topics again.";
  }
  render();
}

async function startSession(form) {
  if (state.starting) return;
  const formData = new FormData(form);
  const playerName = String(formData.get("playerName") || "").trim();
  const category = String(formData.get("category") || "");
  const difficulty = String(formData.get("difficulty") || "easy");
  if (!playerName || !category) {
    state.setupError = !category ? "Choose a category before starting." : "Add your name before starting.";
    render();
    return;
  }

  state.playerName = playerName;
  state.selectedCategory = category;
  state.difficulty = difficulty;
  state.starting = true;
  state.setupError = "";
  render();
  try {
    const result = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ playerName, category, difficulty }),
    });
    if (!result?.sessionId || !result?.question) throw new Error("Your session didn’t include a first question. Please try again.");
    state.sessionId = result.sessionId;
    state.question = result.question;
    state.totalQuestions = Number(result.totalQuestions) || 0;
    state.answeredCount = 0;
    state.selectedIndex = null;
    state.feedback = null;
    state.completion = null;
    state.answerError = "";
    state.screen = "quiz";
  } catch (error) {
    state.setupError = error.message || "We couldn’t start the quiz. Please try again.";
  } finally {
    state.starting = false;
    render();
  }
}

async function submitAnswer(form) {
  if (state.submitting || state.selectedIndex === null || state.feedback) return;
  state.submitting = true;
  state.answerError = "";
  render();
  try {
    const result = await api(`/api/sessions/${encodeURIComponent(state.sessionId)}/answer`, {
      method: "POST",
      body: JSON.stringify({
        questionId: state.question.id,
        selectedIndex: state.selectedIndex,
      }),
    });
    if (!result || typeof result.correct !== "boolean") throw new Error("We couldn’t read the answer result. Please try again.");

    state.answeredCount += 1;
    state.feedback = result;
    state.answerError = "";
    if (result.completed) {
      state.completion = {
        playerName: state.playerName,
        category: state.selectedCategory,
        difficulty: state.difficulty,
        score: result.score,
        totalQuestions: result.totalQuestions || state.totalQuestions,
        durationSeconds: result.durationSeconds,
      };
    }
  } catch (error) {
    state.answerError = error.message || "Please try submitting your answer again.";
  } finally {
    state.submitting = false;
    render();
  }
}

async function loadLeaderboard() {
  if (!state.completion?.category) {
    state.leaderboardStatus = "error";
    state.leaderboardError = "This round didn’t include a category for the leaderboard.";
    render();
    return;
  }
  const requestId = ++state.leaderboardRequest;
  state.leaderboardStatus = "loading";
  state.leaderboardError = "";
  render();
  try {
    const query = new URLSearchParams({ category: state.completion.category });
    const result = await api(`/api/leaderboard?${query.toString()}`);
    if (!result || !Array.isArray(result.entries)) throw new Error("The leaderboard came back in an unexpected format.");
    if (requestId !== state.leaderboardRequest) return;
    state.leaderboard = result.entries;
    state.leaderboardStatus = "loaded";
  } catch (error) {
    if (requestId !== state.leaderboardRequest) return;
    state.leaderboardStatus = "error";
    state.leaderboardError = error.message || "Please try loading the leaderboard again.";
  }
  render();
}

function showResults() {
  if (!state.completion) return;
  state.screen = "results";
  state.leaderboardStatus = "loading";
  render();
  loadLeaderboard();
}

function returnToSetup() {
  state.screen = "setup";
  state.sessionId = null;
  state.question = null;
  state.feedback = null;
  state.completion = null;
  state.answerError = "";
  state.selectedIndex = null;
  state.starting = false;
  state.submitting = false;
  state.setupError = "";
  render();
}

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.name === "category") {
    state.selectedCategory = target.value;
    app.querySelectorAll(".category-choice").forEach((choice) => {
      const radio = choice.querySelector('input[name="category"]');
      choice.dataset.selected = String(radio?.checked || false);
    });
    const button = app.querySelector(".start-button");
    if (button) button.disabled = state.starting || !state.selectedCategory;
  } else if (target.name === "difficulty") {
    state.difficulty = target.value;
  } else if (target.name === "answer") {
    state.selectedIndex = Number(target.value);
    app.querySelectorAll(".answer-option").forEach((choice) => {
      const radio = choice.querySelector('input[name="answer"]');
      choice.dataset.selected = String(radio?.checked || false);
    });
    const submit = app.querySelector(".submit-answer");
    if (submit) submit.disabled = state.submitting || Boolean(state.feedback) || state.selectedIndex === null;
    const hint = app.querySelector(".selection-hint");
    if (hint) hint.textContent = "Ready when you are.";
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "setup-form") startSession(form);
  if (form.id === "answer-form") submitAnswer(form);
});

app.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("[data-action]") : null;
  if (!trigger) return;
  const action = trigger.dataset.action;
  if (action === "retry-quizzes") loadQuizzes();
  if (action === "retry-leaderboard") loadLeaderboard();
  if (action === "show-results") showResults();
  if (action === "back-to-setup") returnToSetup();
  if (action === "next-question" && state.feedback?.nextQuestion) {
    state.question = state.feedback.nextQuestion;
    state.feedback = null;
    state.selectedIndex = null;
    state.answerError = "";
    render();
  }
});

render();
loadQuizzes();
