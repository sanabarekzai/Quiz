const app = document.querySelector("#app");

const state = {
  screen: "setup",
  user: null,
  authModal: "none",
  authError: "",
  authLoading: false,
  registerData: {
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    displayName: "",
  },
  loginData: {
    username: "",
    password: "",
  },
  quizzesStatus: "loading",
  quizzes: [],
  selectedQuizId: "",
  playerName: "",
  myRecords: [],
  recordsError: "",
  setupError: "",
  starting: false,
  currentQuiz: null,
  questions: [],
  currentQuestionIndex: 0,
  answers: [],
  submitting: false,
  answerError: "",
  results: null,
  leaderboardStatus: "idle",
  leaderboard: [],
  leaderboardError: "",
  leaderboardRequest: 0,
  matcherQuestions: [],
  matcherAnswers: {},
  matcherIndex: 0,
  matcherResult: null,
  matcherHistory: [],
  matcherError: "",
  matcherLoading: false,
};

const STUDY_PERSONALITY_PROFILES = {
  S: {
    name: "The Sprinter",
    emoji: "⚡",
    tagline: "You thrive under pressure.",
    strengths: "Deadlines give you focus and energy, and you can produce a lot in a short time.",
    watchOut: "Last-minute work leaves little room for mistakes, sleep, or help. It can also be stressful, even when it works.",
    strategies: [
      "Make fake deadlines. Set mini-deadlines before the real one.",
      "Use the 5-minute rule: promise yourself you’ll work for just five minutes.",
      "Start with the step you’re avoiding.",
    ],
    tools: "Structured, Google Calendar, and Focustown.",
    challenge: "Start one assignment three days early, even for just 15 minutes.",
  },
  P: {
    name: "The Perfectionist Planner",
    emoji: "📋",
    tagline: "You care about quality and organization.",
    strengths: "You’re reliable, detail-oriented, and rarely miss a deadline.",
    watchOut: "Organizing can become a way to avoid the work, and chasing “perfect” can drain your time and energy.",
    strategies: [
      "Set a 15-minute limit for planning, then start.",
      "Aim for “good enough” on a first draft. Rough drafts are meant to be messy.",
      "Practice an imperfect start by doing one task at 80% quality on purpose.",
    ],
    tools: "Notion, Quizlet, and Structured.",
    challenge: "Finish one task without doing a final perfecting pass.",
  },
  B: {
    name: "The Study Buddy",
    emoji: "🤝",
    tagline: "You get energy from other people.",
    strengths: "You explain ideas well, ask for help easily, and keep others motivated.",
    watchOut: "Studying can slip when nobody is around, and chatting can replace working.",
    strategies: [
      "Tell a friend your goal and check in when you’re done.",
      "Schedule study sessions with a clear goal for each one.",
      "Take turns teaching topics, and keep a solo backup plan for days nobody is available.",
    ],
    tools: "Focustown, LifeAt, Quizlet, and Google Calendar.",
    challenge: "Set up one study session with a goal written down beforehand.",
  },
  E: {
    name: "The Explorer",
    emoji: "🧭",
    tagline: "You’re curious and creative.",
    strengths: "You generate ideas, enjoy learning, and notice things others miss.",
    watchOut: "Your attention can jump between topics and tabs, so deadlines may sneak up.",
    strategies: [
      "Keep a “parking lot” note for tempting side-thoughts.",
      "Use short timed sessions, then reward yourself with time to explore.",
      "Pick one thing to finish before opening anything new.",
    ],
    tools: "Structured, Notion, Focustown, and Gemini.",
    challenge: "Do three 25-minute sessions with your phone out of reach and note distractions instead of following them.",
  },
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
    credentials: "include",
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload && (payload.message || payload.error);
    throw new Error(message || `The request didn\u2019t work (${response.status}). Please try again.`);
  }
  return payload;
}

// Auth functions
async function registerUser(form) {
  if (!(form instanceof HTMLFormElement)) return;
  const formData = new FormData(form);
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const firstName = String(formData.get("firstName") || "");
  const lastName = String(formData.get("lastName") || "");
  const displayName = String(formData.get("displayName") || "");
  state.registerData = { username, password, firstName, lastName, displayName };
  if (!username || !password || !firstName || !lastName) {
    state.authError = "All fields are required.";
    render();
    return;
  }
  state.authLoading = true;
  state.authError = "";
  render();
  try {
    const result = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        firstName,
        lastName,
        displayName: displayName || `${firstName} ${lastName}`,
      }),
    });
    state.user = result.user;
    state.authModal = "none";
    state.authLoading = false;
    state.registerData = { username: "", password: "", firstName: "", lastName: "", displayName: "" };
    await loadMyRecords();
    render();
  } catch (error) {
    state.authError = error.message || "Registration failed.";
    state.authLoading = false;
    render();
  }
}

async function loginUser(form) {
  if (!(form instanceof HTMLFormElement)) return;
  const formData = new FormData(form);
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  state.loginData = { username, password };
  if (!username || !password) {
    state.authError = "Username and password are required.";
    render();
    return;
  }
  state.authLoading = true;
  state.authError = "";
  render();
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    state.user = result.user;
    state.authModal = "none";
    state.authLoading = false;
    state.loginData = { username: "", password: "" };
    await loadMyRecords();
    render();
  } catch (error) {
    state.authError = error.message || "Login failed.";
    state.authLoading = false;
    render();
  }
}

async function logoutUser() {
  try {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    state.myRecords = [];
    state.recordsError = "";
    render();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

async function checkAuthStatus() {
  try {
    const result = await api("/api/me");
    state.user = result.user;
    await loadMyRecords();
    render();
  } catch (error) {
    state.user = null;
    state.myRecords = [];
    render();
  }
}

async function loadMyRecords() {
  if (!state.user) {
    state.myRecords = [];
    state.recordsError = "";
    return;
  }
  try {
    const result = await api("/api/me/records");
    state.myRecords = Array.isArray(result.records) ? result.records : [];
    state.recordsError = "";
  } catch (error) {
    state.recordsError = error.message || "Your saved records could not be loaded.";
  }
}

function openAuthModal(type) {
  state.authModal = type;
  state.authError = "";
  render();
}

function closeAuthModal() {
  state.authModal = "none";
  state.authError = "";
  render();
}

function shell(content, screenName = "setup") {
  const sectionLabel = screenName === "quiz" ? "A round in progress" : screenName === "results" ? "Your round, wrapped up" : "A quick brain break";
  const authBar = state.user ? `
    <div class="auth-bar">
      <span class="welcome-message">Welcome, ${escapeHTML(state.user.displayName)}</span>
      <button class="text-button logout-button" type="button" data-action="logout">Logout</button>
    </div>` : `
    <div class="auth-bar">
      <button class="text-button login-button" type="button" data-action="open-login">Login</button>
      <button class="primary-button signup-button" type="button" data-action="open-register">Sign Up</button>
    </div>`;
  return `
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" href="/" aria-label="Quiz App home">
          <img class="brand-logo" src="/study-smart-logo.jpg" alt="Quiz App" width="520" height="375">
        </a>
        <div class="top-note"><span class="top-note-mark" aria-hidden="true"></span>Quiz App</div>
        ${authBar}
      </header>
      ${content}
      ${renderAuthModal()}
      <footer class="app-footer">
        <span>Quiz App</span>
        <span>Test your knowledge</span>
      </footer>
    </div>`;
}

function renderAuthModal() {
  if (state.authModal === "none") return "";
  
  if (state.authModal === "register") {
    return `
      <div class="modal-overlay" data-modal="auth">
        <div class="modal-content auth-modal">
          <h2>Create an Account</h2>
          ${state.authError ? `<div class="notice auth-error" role="alert"><span class="notice-symbol" aria-hidden="true">!</span><div><strong>Error</strong><p>${escapeHTML(state.authError)}</p></div></div>` : ""}
          <form id="register-form">
            <div class="form-group">
              <label for="reg-username">Username</label>
              <input type="text" id="reg-username" name="username" value="${escapeHTML(state.registerData.username)}" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="reg-password">Password</label>
              <input type="password" id="reg-password" name="password" value="${escapeHTML(state.registerData.password)}" required autocomplete="new-password">
            </div>
            <div class="form-group">
              <label for="reg-firstName">First Name</label>
              <input type="text" id="reg-firstName" name="firstName" value="${escapeHTML(state.registerData.firstName)}" required autocomplete="given-name">
            </div>
            <div class="form-group">
              <label for="reg-lastName">Last Name</label>
              <input type="text" id="reg-lastName" name="lastName" value="${escapeHTML(state.registerData.lastName)}" required autocomplete="family-name">
            </div>
            <div class="form-group">
              <label for="reg-displayName">Display Name (optional)</label>
              <input type="text" id="reg-displayName" name="displayName" value="${escapeHTML(state.registerData.displayName)}" placeholder="${escapeHTML(state.registerData.firstName)} ${escapeHTML(state.registerData.lastName)}" autocomplete="name">
            </div>
            <div class="modal-actions">
              <button type="button" class="secondary-button" onclick="closeAuthModal()">Cancel</button>
              <button type="submit" class="primary-button" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Creating..." : "Sign Up"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }
  
  if (state.authModal === "login") {
    return `
      <div class="modal-overlay" data-modal="auth">
        <div class="modal-content auth-modal">
          <h2>Login</h2>
          ${state.authError ? `<div class="notice auth-error" role="alert"><span class="notice-symbol" aria-hidden="true">!</span><div><strong>Error</strong><p>${escapeHTML(state.authError)}</p></div></div>` : ""}
          <form id="login-form">
            <div class="form-group">
              <label for="login-username">Username</label>
              <input type="text" id="login-username" name="username" value="${escapeHTML(state.loginData.username)}" required autocomplete="username">
            </div>
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" name="password" value="${escapeHTML(state.loginData.password)}" required autocomplete="current-password">
            </div>
            <div class="modal-actions">
              <button type="button" class="secondary-button" onclick="closeAuthModal()">Cancel</button>
              <button type="submit" class="primary-button" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Logging in..." : "Login"}</button>
            </div>
          </form>
        </div>
      </div>`;
  }
  
  return "";
}

function renderMyRecords() {
  if (!state.user) return "";
  const content = state.recordsError
    ? `<p class="record-note" role="alert">${escapeHTML(state.recordsError)}</p>`
    : state.myRecords.length === 0
      ? '<p class="record-note">Your completed quizzes and latest results will appear here.</p>'
      : `<div class="account-record-list">${state.myRecords.map((record) => {
        const result = record.result || {};
        const isOpinionSurvey = record.categoryId === "club_carnival";
        const isPersonalitySurvey = record.categoryId === "study_personality";
        const profileNames = (result.primaryProfiles || [])
          .map((profileId) => STUDY_PERSONALITY_PROFILES[profileId]?.name.replace(/^The /, ""))
          .filter(Boolean);
        const profileHistory = Array.isArray(record.profileHistory) ? record.profileHistory : [];
        const profileHistoryMarkup = isPersonalitySurvey && profileHistory.length > 1
          ? `<div class="profile-history">
              <h4>Recent profiles</h4>
              <ol>${profileHistory.map((attempt) => {
                const names = (attempt.primaryProfiles || [])
                  .map((profileId) => STUDY_PERSONALITY_PROFILES[profileId]?.name.replace(/^The /, ""))
                  .filter(Boolean);
                return `<li><span>${escapeHTML(names.join(" + ") || "Profile saved")}</span><time datetime="${escapeHTML(attempt.completedAt)}">${escapeHTML(new Date(attempt.completedAt).toLocaleDateString())}</time></li>`;
              }).join("")}</ol>
            </div>`
          : "";
        const scoreLabel = isOpinionSurvey
          ? "Opinion responses saved"
          : isPersonalitySurvey
            ? `Study profile: ${profileNames.join(" + ") || "saved"}`
            : result.maxScore
              ? `${record.score} / ${result.maxScore} points`
              : record.percentage !== null
                ? `${record.score} / ${record.totalQuestions} · ${record.percentage}%`
                : `${record.score} / ${record.totalQuestions} points`;
        const feedback = typeof result.feedback === "string"
          ? result.feedback
          : result.tier || result.level
            ? [result.emoji, result.tier || `Level ${result.level}`, result.recommendation].filter(Boolean).join(" · ")
            : "Latest result saved.";
        return `<article class="account-record">
          <div class="account-record-heading">
            <h3>${escapeHTML(record.title)}</h3>
            <span>${escapeHTML(record.attemptCount)} ${record.attemptCount === 1 ? "attempt" : "attempts"}</span>
          </div>
          <p class="account-record-score">${escapeHTML(scoreLabel)}</p>
          <p class="account-record-feedback">${escapeHTML(feedback)}</p>
          ${profileHistoryMarkup}
          <time datetime="${escapeHTML(record.completedAt)}">Latest attempt: ${escapeHTML(new Date(record.completedAt).toLocaleDateString())}</time>
        </article>`;
      }).join("")}</div>`;

  return `<section class="account-records" aria-labelledby="account-records-title">
    <div class="account-records-heading">
      <div>
        <div class="eyebrow"><span class="eyebrow-line"></span> Saved to your account</div>
        <h2 id="account-records-title">Your latest quiz records</h2>
      </div>
    </div>
    ${content}
  </section>`;
}

function renderSetup() {
  app.innerHTML = shell(`
    <main class="setup-layout reveal">
      <section class="intro-panel" aria-labelledby="intro-title">
        <div class="intro-top eyebrow eyebrow-light"><span class="eyebrow-line"></span> Quiz App</div>
        <div class="intro-copy">
          <h1 id="intro-title">Quiz App</h1>
          <p>Test your knowledge and track your progress through our quizzes.</p>
        </div>
        <div class="orbit-tag" aria-hidden="true">Knowledge<br>is power<br>here</div>
        <div class="intro-foot"><span>Track your learning journey</span><span>01 / 03</span></div>
      </section>
      <section class="setup-content" aria-labelledby="setup-title">
        <div class="setup-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> Configure your quiz</div>
          <h2 id="setup-title">Set up your quiz</h2>
          <p>Choose a quiz category and begin your quiz.</p>
        </div>
        ${renderMyRecords()}
        ${state.setupError ? `
          <div class="notice" role="alert">
            <span class="notice-symbol" aria-hidden="true">!</span>
            <div><strong>We couldn\u2019t start your round.</strong><p>${escapeHTML(state.setupError)}</p></div>
          </div>` : ""}
        ${state.quizzesStatus === "loading" ? `
          <div aria-label="Loading quiz categories">
            <div class="skeleton loading-line"></div>
            <div class="loading-categories">${Array.from({ length: 5 }, () => '<div class="skeleton skeleton-card"></div>').join("")}</div>
          </div>` :
          state.quizzesStatus === "error" ? `
            <div class="notice" role="alert">
              <span class="notice-symbol" aria-hidden="true">!</span>
              <div><strong>Topics haven\u2019t arrived yet.</strong><p>${escapeHTML(state.setupError || "We couldn\u2019t load the quiz categories.")}</p><button class="text-button" type="button" data-action="retry-quizzes">Try again</button></div>
            </div>` :
          state.quizzes.length === 0 ? `
            <div class="empty-state" role="status"><strong>No quizzes to pick from just yet.</strong>There aren\u2019t any available topics right now. Check back in a little while.</div>` :
          `<form class="setup-form" id="setup-form">
            <fieldset class="form-section">
              <legend class="section-heading">Choose a quiz <span class="section-hint">Pick one</span></legend>
              <div class="category-grid">
                ${state.quizzes.map((quiz, index) => {
                  const selected = state.selectedQuizId === quiz.id;
                  const symbol = String(index + 1).padStart(2, "0");
                  const quizId = `quiz-${index}`;
                  return `<label class="category-choice" data-selected="${selected}" for="${quizId}">
                    <input id="${quizId}" type="radio" name="quizId" value="${escapeHTML(quiz.id)}" ${selected ? "checked" : ""} required>
                    <span class="category-symbol" aria-hidden="true">${symbol}</span>
                    <span class="category-copy">
                      <span class="category-title">${escapeHTML(quiz.title || quiz.id)}</span>
                      <span class="category-description">${escapeHTML(quiz.description || "")}</span>
                      <span class="category-count">${escapeHTML(quiz.questionCount || 0)} questions</span>
                    </span>
                  </label>`;
                }).join("")}
              </div>
            </fieldset>
            <div class="form-actions">
              <button class="primary-button start-button" type="submit" ${state.starting || !state.selectedQuizId ? "disabled" : ""}>
                <span>${state.starting ? "Loading quiz..." : "Start Quiz"}</span><span class="button-arrow" aria-hidden="true">${state.starting ? "\u2026" : "\u2192"}</span>
              </button>
              <p class="form-footnote">A few minutes, a fresh perspective. That\u2019s the whole plan.</p>
            </div>
          </form>`}
        <section class="matcher-promo">
          <div>
            <div class="eyebrow"><span class="eyebrow-line"></span> Separate survey</div>
            <h3>Which Study Tools Fit You?</h3>
            <p>Find tools that match how you plan, focus, and learn. Sign in to save your results.</p>
          </div>
          <button class="secondary-button" type="button" data-action="start-matcher" ${state.matcherLoading ? "disabled" : ""}>
            ${state.matcherLoading ? "Loading..." : "Start Study Tool Matcher"}
          </button>
          ${state.matcherError ? `<p class="matcher-error" role="alert">${escapeHTML(state.matcherError)}</p>` : ""}
        </section>
      </section>
    </main>`, "setup");
}

function renderQuestionOptions() {
  const currentQuestion = state.questions[state.currentQuestionIndex];
  if (!currentQuestion) return "";
  
  const answer = state.answers[state.currentQuestionIndex];
  const locked = state.results !== null;
  
  return `<fieldset class="answer-list" ${locked ? 'data-locked="true"' : ""}>
    <legend class="visually-hidden">Choose one answer</legend>
    ${(currentQuestion.options || []).map((option, index) => {
      const selected = answer === index;
      const correct = locked && currentQuestion.correctIndex === index;
      const wrong = locked && selected && answer !== currentQuestion.correctIndex;
      return `<label class="answer-option" data-selected="${selected}" ${correct ? 'data-correct="true"' : ""} ${wrong ? 'data-wrong="true"' : ""}>
        <input type="radio" name="answer" value="${index}" ${selected ? "checked" : ""} ${locked || state.submitting ? "disabled" : ""}>
        <span class="answer-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
        <span class="answer-text">${escapeHTML(option)}</span>
      </label>`;
    }).join("")}
  </fieldset>`;
}

function renderQuiz() {
  const total = Math.max(1, state.questions.length);
  const current = Math.min(total, state.currentQuestionIndex + 1);
  const percent = Math.round(((state.currentQuestionIndex + (state.answers[state.currentQuestionIndex] !== undefined ? 1 : 0)) / total) * 100);
  const currentQuestion = state.questions[state.currentQuestionIndex];
  
  app.innerHTML = shell(`
    <main class="quiz-layout reveal">
      <div class="quiz-topline">
        <div class="eyebrow eyebrow-dark"><span class="eyebrow-line"></span> Welcome, ${escapeHTML(state.playerName)}</div>
        <div class="round-meta">
          <span class="meta-chip">${escapeHTML(state.currentQuiz?.title || state.selectedQuizId)}</span>
        </div>
      </div>
      <div class="progress-wrap" aria-label="Quiz progress">
        <div class="progress-labels"><span>Question ${current} of ${total}</span><span>${percent}% complete</span></div>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(state.currentQuestionIndex + 1, total)}" aria-label="Questions answered">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
      </div>
      <div class="quiz-columns">
        <section class="question-card" aria-labelledby="question-title">
          <div class="question-kicker">Question ${current} of ${total}</div>
          <h1 class="question-title" id="question-title">${escapeHTML(currentQuestion?.prompt || "")}</h1>
          <form id="answer-form">
            ${renderQuestionOptions()}
            <div class="question-actions">
              <span class="selection-hint">${state.answers[state.currentQuestionIndex] !== undefined ? "Answer selected. Ready to continue." : "Select an answer to continue."}</span>
              <div class="quiz-navigation">
                <button class="secondary-button prev-button" type="button" data-action="prev-question" ${state.currentQuestionIndex === 0 ? "disabled" : ""}>
                  <span class="button-arrow" aria-hidden="true">\u2190</span><span>Previous</span>
                </button>
                ${state.currentQuestionIndex < total - 1 ? `
                  <button class="primary-button next-button" type="button" data-action="next-question" ${state.answers[state.currentQuestionIndex] === undefined ? "disabled" : ""}>
                    <span>Next</span><span class="button-arrow" aria-hidden="true">\u2192</span>
                  </button>` : `
                  <button class="primary-button submit-quiz-button" type="submit" ${state.answers[state.currentQuestionIndex] === undefined ? "disabled" : ""}>
                    <span>${state.submitting ? "Submitting..." : "Submit Quiz"}</span><span class="button-arrow" aria-hidden="true">${state.submitting ? "\u2026" : "\u2192"}</span>
                  </button>`}
              </div>
            </div>
            ${state.answerError ? `<div class="notice answer-error" role="alert"><span class="notice-symbol" aria-hidden="true">!</span><div><strong>Your response didn\u2019t go through.</strong><p>${escapeHTML(state.answerError)}</p></div></div>` : ""}
          </form>
        </section>
        <aside class="aside-card">
          <div class="aside-label">A friendly reminder</div>
          <h3>This isn\u2019t a test.</h3>
          <p>It\u2019s a small detour for your brain. Take a breath, trust what you know, and enjoy the surprise.</p>
          <div class="aside-rule"></div>
          <div class="aside-note">Your answer stays hidden until you lock it in. No peeking ahead.</div>
        </aside>
      </div>
    </main>`, "quiz");
}

function renderStudyPersonalityResults(result) {
  const profileBars = (result.profiles || []).map((profile) => {
    const details = STUDY_PERSONALITY_PROFILES[profile.id];
    if (!details) return "";
    const percentage = Math.max(0, Math.min(100, Number(profile.percentage) || 0));
    return `<div class="personality-bar-row">
      <div class="personality-bar-label"><span>${details.emoji} ${escapeHTML(details.name.replace(/^The /, ""))}</span><strong>${percentage}%</strong></div>
      <div class="personality-bar-track" role="progressbar" aria-label="${escapeHTML(details.name)} share of responses" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}">
        <div class="personality-bar-fill" style="width:${percentage}%"></div>
      </div>
    </div>`;
  }).join("");

  const primaryProfiles = (result.primaryProfiles || [])
    .map((profileId) => STUDY_PERSONALITY_PROFILES[profileId] ? { id: profileId, ...STUDY_PERSONALITY_PROFILES[profileId] } : null)
    .filter(Boolean);
  const profileCards = primaryProfiles.map((profile) => `
    <article class="personality-profile-card">
      <div class="eyebrow"><span class="eyebrow-line"></span> ${escapeHTML(profile.emoji)} Study style</div>
      <h3>${escapeHTML(profile.name)}</h3>
      <p class="personality-tagline">${escapeHTML(profile.tagline)}</p>
      <div class="personality-detail-grid">
        <div><h4>Strengths</h4><p>${escapeHTML(profile.strengths)}</p></div>
        <div><h4>Watch out for</h4><p>${escapeHTML(profile.watchOut)}</p></div>
      </div>
      <h4>Strategies to try</h4>
      <ul>${profile.strategies.map((strategy) => `<li>${escapeHTML(strategy)}</li>`).join("")}</ul>
      <p><strong>Tools to explore:</strong> ${escapeHTML(profile.tools)}</p>
      <p class="personality-challenge"><strong>This week’s challenge:</strong> ${escapeHTML(profile.challenge)}</p>
    </article>`).join("");

  return `<div class="personality-results">
    <section class="personality-distribution" aria-labelledby="personality-distribution-title">
      <div class="eyebrow"><span class="eyebrow-line"></span> Your response patterns</div>
      <h3 id="personality-distribution-title">${escapeHTML(result.profileSummary || "Your study profile")}</h3>
      <p>No answer is right or wrong, and no profile is better than another. These patterns can shift over time.</p>
      ${result.blendMessage ? `<p class="personality-blend">${escapeHTML(result.blendMessage)}</p>` : ""}
      <div class="personality-bars">${profileBars}</div>
    </section>
    <div class="personality-profile-grid">${profileCards}</div>
    <section class="personality-reflections" aria-labelledby="personality-reflections-title">
      <div class="eyebrow"><span class="eyebrow-line"></span> Reflect privately or with a club partner</div>
      <h3 id="personality-reflections-title">Think it over</h3>
      <ol>
        <li>Which profile surprised you, and which felt right?</li>
        <li>When is your pattern a strength, and when does it get in your way?</li>
        <li>What’s one tip you’ll try this week?</li>
      </ol>
      <p>Reflection answers are not collected or saved.</p>
    </section>
  </div>`;
}

function renderResults() {
  const result = state.results || {};
  const score = Number(result.score) || 0;
  const total = Number(result.totalQuestions) || 0;
  const percentage = Number(result.percentage) || 0;
  const resultDetails = result.results || [];
  const categoryId = state.currentQuiz?.id || state.selectedQuizId;
  const isOpinionSurvey = categoryId === "club_carnival";
  const isPersonalitySurvey = categoryId === "study_personality";
  const isFeedbackSurvey = categoryId === "student_wellness" || categoryId === "study_skills";
  const perfectRound = !isOpinionSurvey && !isPersonalitySurvey && percentage === 100;
  
  let surveyContent = "";
  
  if (isOpinionSurvey) {
    surveyContent = `<div class="survey-feedback"><p class="survey-feedback-text">${escapeHTML(result.feedback || "Thanks for sharing your thoughts about the club.")}</p></div>`;
  } else if (categoryId === 'student_wellness') {
    const tier = result.tier || "";
    const feedback = result.feedback || "";
    const recommendation = result.recommendation || "";
    const maxScore = result.maxScore || 36;
    surveyContent = `
      <div class="survey-feedback">
        <div class="survey-tier">${escapeHTML(tier)}</div>
        <p class="survey-feedback-text">${escapeHTML(feedback)}</p>
        <p class="survey-recommendation">${escapeHTML(recommendation)}</p>
        <p><strong>Score:</strong> ${score} / ${maxScore}</p>
      </div>`;
  } else if (categoryId === 'study_skills') {
    const level = result.level || 0;
    const tier = result.tier || "";
    const emoji = result.emoji || "";
    const feedback = result.feedback || "";
    const tips = result.tips || [];
    const nextQuest = result.nextQuest || "";
    const maxScore = result.maxScore || 30;
    surveyContent = `
      <div class="survey-feedback">
        <div class="survey-tier">${escapeHTML(emoji)} Level ${escapeHTML(level)}: ${escapeHTML(tier)}</div>
        <p class="survey-feedback-text">${escapeHTML(feedback)}</p>
        <div class="survey-tips">
          <h4>Your Tips:</h4>
          <ul>${tips.map(tip => `<li>${escapeHTML(tip)}</li>`).join("")}</ul>
        </div>
        <p><strong>Next Quest:</strong> ${escapeHTML(nextQuest)}</p>
        <p><strong>Score:</strong> ${score} / ${maxScore}</p>
      </div>`;
  }
  
  app.innerHTML = shell(`
    <main class="results-layout reveal">
      <section class="results-hero" aria-labelledby="results-title">
        <div class="results-copy">
          <div class="eyebrow"><span class="eyebrow-line"></span> Quiz complete \u00b7 ${escapeHTML(state.playerName)}</div>
          <h1 id="results-title">${isPersonalitySurvey ? "Your Study Personality" : isOpinionSurvey || isFeedbackSurvey ? "Survey Complete!" : perfectRound ? "Perfect Score!" : "Great Effort!"}</h1>
          <p>${isPersonalitySurvey ? "A self-reflection tool, not a test. Use these patterns as a starting point, not a label." : isOpinionSurvey ? "Your responses have been saved to your account." : perfectRound ? "You answered all questions correctly! Excellent work." : isFeedbackSurvey ? "Here are your results." : "You've completed the quiz. Review your results below."}</p>
          ${surveyContent}
          <div class="result-stats">
            <span class="result-stat"><strong>${escapeHTML(state.currentQuiz?.title || state.selectedQuizId)}</strong> quiz</span>
            ${isOpinionSurvey || isPersonalitySurvey ? "" : !isFeedbackSurvey ? `
              <span class="result-stat"><strong>${escapeHTML(score)}</strong> / ${escapeHTML(total)} correct</span>
              <span class="result-stat"><strong>${escapeHTML(percentage)}%</strong> score</span>` : `
              <span class="result-stat"><strong>${escapeHTML(score)}</strong> / ${escapeHTML(result.maxScore || total)} points</span>`}
          </div>
        </div>
        ${isOpinionSurvey || isPersonalitySurvey ? "" : `<div class="score-stamp" aria-label="Score ${score} out of ${total}">
          <span class="score-number">${escapeHTML(score)}<span style="font-size:.52em">/${escapeHTML(result.maxScore || total)}</span></span>
          <span class="score-caption">your score</span>
        </div>`}
      </section>
      <section class="results-summary" aria-labelledby="summary-title">
        <div class="summary-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> Results Summary</div>
          <h2 id="summary-title">${isPersonalitySurvey ? "Your study patterns and next steps" : isOpinionSurvey || isFeedbackSurvey ? "Your Responses" : "Question Breakdown"}</h2>
        </div>
        ${isPersonalitySurvey ? renderStudyPersonalityResults(result) : `<div class="results-list">
          ${state.questions.map((question, index) => {
            const answer = state.answers[index];
            const resultItem = resultDetails[index] || {};
            const isCorrect = resultItem.isCorrect || false;
            const correctIndex = resultItem.correctIndex;
            return `<div class="result-item ${isOpinionSurvey ? "" : isFeedbackSurvey ? "" : isCorrect ? "correct" : "incorrect"}">
              <span class="result-question">Q${index + 1}: ${escapeHTML(question.prompt)}</span>
              <span class="result-answer">Your answer: ${escapeHTML(question.options[answer] || "No answer")}</span>
              ${isOpinionSurvey ? "" : !isFeedbackSurvey ? `
                <span class="result-status">${isCorrect ? "\u2713 Correct" : "\u2717 Incorrect"}</span>
                ${!isCorrect && correctIndex !== undefined ? `<span class="result-correct">Correct: ${escapeHTML(question.options[correctIndex])}</span>` : ""}` : `
                <span class="result-points">Points: ${resultItem.points || 0}</span>`}
            </div>`;
          }).join("")}
        </div>`}
        <div class="results-actions">
          <button class="primary-button" type="button" data-action="retry-quiz"><span>Retry Quiz</span><span class="button-arrow" aria-hidden="true">\u2192</span></button>
          <button class="secondary-button" type="button" data-action="back-to-setup">Back to Quiz Selection</button>
        </div>
      </section>
    </main>`, "results");
}

async function startMatcher() {
  if (!state.user) {
    state.matcherError = "Sign in to use the Study Tool Matcher and save your results.";
    state.authModal = "login";
    state.authError = state.matcherError;
    render();
    return;
  }
  state.matcherLoading = true;
  state.matcherError = "";
  renderSetup();
  try {
    const [questionResponse, historyResponse] = await Promise.all([
      api("/api/matcher/questions"),
      api("/api/matcher/results"),
    ]);
    state.matcherQuestions = questionResponse.questions;
    state.matcherHistory = historyResponse.results || [];
    state.matcherAnswers = {};
    state.matcherIndex = 0;
    state.matcherResult = null;
    state.matcherLoading = false;
    state.screen = "matcher";
    render();
  } catch (error) {
    state.matcherLoading = false;
    state.matcherError = error.message;
    if (error.message.includes("Unauthorized")) {
      state.authModal = "login";
      state.authError = state.matcherError;
    }
    render();
  }
}

function renderMatcherQuestion() {
  const question = state.matcherQuestions[state.matcherIndex];
  if (!question) return renderSetup();
  const answer = state.matcherAnswers[question.id];
  const progress = Math.round(((state.matcherIndex + 1) / state.matcherQuestions.length) * 100);
  app.innerHTML = shell(`<main class="matcher-layout reveal">
    <div class="matcher-heading">
      <div class="eyebrow"><span class="eyebrow-line"></span> Study Tool Matcher</div>
      <h1>Which Study Tools Fit You?</h1>
      <p>Choose what fits you right now. There are no right or wrong answers.</p>
    </div>
    <div class="progress-labels"><span>Question ${state.matcherIndex + 1} of ${state.matcherQuestions.length}</span><span>${progress}%</span></div>
    <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
    <section class="matcher-question">
      <h2>${escapeHTML(question.text)}</h2>
      <div class="matcher-choices">${question.choices.map((choice) => `
        <label class="matcher-choice" data-selected="${answer === choice.id}">
          <input type="radio" name="matcherChoice" value="${escapeHTML(choice.id)}" ${answer === choice.id ? "checked" : ""}>
          <span>${escapeHTML(choice.text)}</span>
        </label>`).join("")}</div>
      ${state.matcherError ? `<p class="matcher-error" role="alert">${escapeHTML(state.matcherError)}</p>` : ""}
      <div class="matcher-actions">
        <button class="secondary-button" type="button" data-action="matcher-back" ${state.matcherIndex === 0 ? "disabled" : ""}>Back</button>
        ${state.matcherIndex < state.matcherQuestions.length - 1
          ? `<button class="primary-button" type="button" data-action="matcher-next" ${!answer ? "disabled" : ""}>Next →</button>`
          : `<button class="primary-button" type="button" data-action="matcher-submit" ${!answer || state.matcherLoading ? "disabled" : ""}>${state.matcherLoading ? "Saving..." : "See my matches →"}</button>`}
      </div>
    </section>
  </main>`, "matcher");
}

function renderMatcherResults() {
  const result = state.matcherResult;
  if (!result) return renderSetup();
  const previousTop = state.matcherHistory[0]?.ranking?.[0];
  const currentTop = result.ranking[0];
  const change = previousTop
    ? `<p class="matcher-change">${previousTop.id === currentTop.id
      ? `Your top match is still ${escapeHTML(currentTop.name)}.`
      : `Your top match changed from ${escapeHTML(previousTop.name)} to ${escapeHTML(currentTop.name)}.`}</p>`
    : "";
  app.innerHTML = shell(`<main class="matcher-results-layout reveal">
    <section class="results-hero matcher-results-hero">
      <div class="results-copy">
        <div class="eyebrow"><span class="eyebrow-line"></span> Your study tool matches</div>
        <h1>${escapeHTML(result.bestGroup.name)}</h1>
        <p>Best-fit group · ${result.bestGroup.matchPercent}% average match</p>
        ${change}
        <p class="matcher-caveat">${escapeHTML(result.note || "")}</p>
      </div>
    </section>
    <section class="matcher-ranking" aria-label="Study tools ranked by match">
      ${result.ranking.map((tool) => `<article class="matcher-tool-card">
        <div class="matcher-tool-top"><span class="matcher-rank">#${tool.rank}</span><div><h2>${escapeHTML(tool.name)}</h2><span>${escapeHTML(tool.groupName)}</span></div><strong>${tool.matchPercent}%</strong></div>
        ${tool.rank === 7 ? '<p class="matcher-neutral-note">Less helpful for you right now</p>' : ""}
        <div class="personality-bar-track"><div class="personality-bar-fill" style="width:${tool.matchPercent}%"></div></div>
        <p>${escapeHTML(tool.blurb)}</p><p><strong>Try this week:</strong> ${escapeHTML(tool.firstStep)}</p>
      </article>`).join("")}
    </section>
    <section class="matcher-groups">
      <h2>Best-fit groups</h2>
      ${result.groupScores.map((group) => `<p>${escapeHTML(group.name)} <strong>${group.matchPercent}%</strong></p>`).join("")}
    </section>
    <div class="matcher-actions">
      <button class="primary-button" type="button" data-action="matcher-retake">Retake</button>
      <button class="secondary-button" type="button" data-action="back-to-setup">Back to quizzes</button>
    </div>
  </main>`, "matcher-results");
}

async function submitMatcher() {
  state.matcherLoading = true;
  state.matcherError = "";
  renderMatcherQuestion();
  try {
    const result = await api("/api/matcher/submit", {
      method: "POST",
      body: JSON.stringify({ answers: state.matcherAnswers }),
    });
    state.matcherResult = result;
    state.matcherHistory = [result, ...state.matcherHistory];
    state.matcherLoading = false;
    state.screen = "matcher-results";
    render();
  } catch (error) {
    state.matcherLoading = false;
    state.matcherError = error.message;
    renderMatcherQuestion();
  }
}

function render() {
  if (state.screen === "quiz") renderQuiz();
  else if (state.screen === "results") renderResults();
  else if (state.screen === "matcher") renderMatcherQuestion();
  else if (state.screen === "matcher-results") renderMatcherResults();
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
    if (!state.quizzes.some((quiz) => quiz.id === state.selectedQuizId)) {
      state.selectedQuizId = state.quizzes[0]?.id || "";
    }
    state.setupError = "";
  } catch (error) {
    state.quizzesStatus = "error";
    state.setupError = error.message || "Please try loading the topics again.";
  }
  render();
}

async function startQuiz(form) {
  if (state.starting) return;
  const formData = new FormData(form);
  const playerName = String(state.user?.displayName || "Guest").trim();
  const quizId = String(formData.get("quizId") || "");
  
  if (!quizId) {
    state.setupError = "Choose a quiz before starting.";
    render();
    return;
  }

  state.playerName = playerName;
  state.selectedQuizId = quizId;
  state.starting = true;
  state.setupError = "";
  render();
  
  try {
    const result = await api(`/api/quizzes/${encodeURIComponent(quizId)}`);
    if (!result?.quiz || !Array.isArray(result.questions) || result.questions.length === 0) {
      throw new Error("Quiz data is incomplete. Please try again.");
    }
    
    state.currentQuiz = result.quiz;
    state.questions = result.questions;
    state.currentQuestionIndex = 0;
    state.answers = Array(result.questions.length).fill(null);
    state.results = null;
    state.screen = "quiz";
    state.starting = false;
    render();
  } catch (error) {
    state.setupError = error.message || "We couldn\u2019t load the quiz. Please try again.";
    state.starting = false;
    render();
  }
}

async function submitQuiz() {
  if (state.submitting) return;
  if (!state.user) {
    state.authModal = "login";
    state.authError = "Log in to save your quiz results to your account.";
    render();
    return;
  }
  
  // Check all questions are answered
  if (state.answers.some(a => a === null)) {
    state.answerError = "Please answer all questions before submitting.";
    render();
    return;
  }
  
  state.submitting = true;
  state.answerError = "";
  render();
  
  try {
    const result = await api(`/api/quizzes/${encodeURIComponent(state.selectedQuizId)}/submit`, {
      method: "POST",
      body: JSON.stringify({
        answers: state.answers,
        questionIds: state.questions.map((question) => question.id),
      }),
    });
    
    const categoryId = state.currentQuiz?.id || state.selectedQuizId;
    const allowsNoNumericScore = categoryId === "club_carnival" || categoryId === "study_personality";
    if (!result || (!allowsNoNumericScore && typeof result.score !== "number")) {
      throw new Error("We couldn\u2019t calculate your score. Please try again.");
    }
    
    state.results = result;
    state.screen = "results";
    state.submitting = false;
    await loadMyRecords();
    render();
  } catch (error) {
    state.answerError = error.message || "Please try submitting your quiz again.";
    state.submitting = false;
    render();
  }
}

function goToNextQuestion() {
  if (state.currentQuestionIndex < state.questions.length - 1) {
    state.currentQuestionIndex++;
    render();
  }
}

function goToPrevQuestion() {
  if (state.currentQuestionIndex > 0) {
    state.currentQuestionIndex--;
    render();
  }
}

function selectAnswer(index) {
  state.answers[state.currentQuestionIndex] = index;
  render();
}

function retryQuiz() {
  state.screen = "quiz";
  state.currentQuestionIndex = 0;
  state.answers = Array(state.questions.length).fill(null);
  state.results = null;
  state.answerError = "";
  render();
}

function returnToSetup() {
  state.screen = "setup";
  state.selectedQuizId = "";
  state.currentQuiz = null;
  state.questions = [];
  state.currentQuestionIndex = 0;
  state.answers = [];
  state.results = null;
  state.answerError = "";
  state.playerName = "";
  state.starting = false;
  state.submitting = false;
  state.setupError = "";
  render();
}

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  
  if (target.name === "quizId") {
    state.selectedQuizId = target.value;
    app.querySelectorAll(".category-choice").forEach((choice) => {
      const radio = choice.querySelector('input[name="quizId"]');
      choice.dataset.selected = String(radio?.checked || false);
    });
    const button = app.querySelector(".start-button");
    if (button) button.disabled = state.starting || !state.selectedQuizId;
    renderSetup();
  } else if (target.name === "answer") {
    state.answers[state.currentQuestionIndex] = Number(target.value);
    app.querySelectorAll(".answer-option").forEach((choice) => {
      const radio = choice.querySelector('input[name="answer"]');
      choice.dataset.selected = String(radio?.checked || false);
    });
    renderQuiz();
  } else if (target.name === "matcherChoice") {
    const question = state.matcherQuestions[state.matcherIndex];
    if (question) state.matcherAnswers[question.id] = target.value;
    state.matcherError = "";
    renderMatcherQuestion();
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "register-form") registerUser(form);
  if (form.id === "login-form") loginUser(form);
  if (form.id === "setup-form") startQuiz(form);
  if (form.id === "answer-form" && state.currentQuestionIndex === state.questions.length - 1) submitQuiz();
});

app.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("[data-action]") : null;
  if (!trigger) return;
  const action = trigger.dataset.action;
  
  if (action === "retry-quizzes") loadQuizzes();
  if (action === "open-login") openAuthModal("login");
  if (action === "open-register") openAuthModal("register");
  if (action === "logout") logoutUser();
  if (action === "back-to-setup") returnToSetup();
  if (action === "retry-quiz") retryQuiz();
  if (action === "next-question") goToNextQuestion();
  if (action === "prev-question") goToPrevQuestion();
  if (action === "start-matcher") startMatcher();
  if (action === "matcher-back" && state.matcherIndex > 0) {
    state.matcherIndex--;
    state.matcherError = "";
    renderMatcherQuestion();
  }
  if (action === "matcher-next" && state.matcherAnswers[state.matcherQuestions[state.matcherIndex]?.id]) {
    state.matcherIndex++;
    state.matcherError = "";
    renderMatcherQuestion();
  }
  if (action === "matcher-submit" && state.matcherAnswers[state.matcherQuestions[state.matcherIndex]?.id]) submitMatcher();
  if (action === "matcher-retake") startMatcher();
});

// Initialize Google Sign-In when the page loads
window.addEventListener("load", () => {
  // Initialize Google Sign-In if needed
  if (window.google && window.google.accounts) {
    window.google.accounts.id.initialize({
      client_id: "YOUR_GOOGLE_CLIENT_ID",
      callback: handleGoogleSignIn,
    });
  }
});

function handleGoogleSignIn(response) {
  // Handle Google sign-in if configured
  console.log("Google sign-in response:", response);
}

// Check auth status on page load
checkAuthStatus();

render();
loadQuizzes();
