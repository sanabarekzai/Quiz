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
  myHistory: [],
  historyError: "",
  recordsError: "",
  communityResults: [],
  communityStatus: "idle",
  communityError: "",
  communityCategory: "all",
  adminQuestions: [],
  adminCategories: [],
  adminError: "",
  adminNotice: "",
  adminLoading: false,
  adminEditingId: null,
  adminCsvText: "",
  adminCsvRows: [],
  adminCsvError: "",
  adminCsvNotice: "",
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
    await Promise.all([loadMyRecords(), loadMyHistory(), loadCommunityResults()]);
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
    await Promise.all([loadMyRecords(), loadMyHistory(), loadCommunityResults()]);
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
    state.myHistory = [];
    state.communityResults = [];
    state.communityStatus = "idle";
    state.historyError = "";
    state.recordsError = "";
    if (state.screen === "admin") state.screen = "setup";
    render();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

async function checkAuthStatus() {
  try {
    const result = await api("/api/me");
    state.user = result.user;
    await Promise.all([loadMyRecords(), loadMyHistory(), loadCommunityResults()]);
    render();
  } catch (error) {
    state.user = null;
    state.myRecords = [];
    state.myHistory = [];
    state.historyError = "";
    state.communityResults = [];
    state.communityStatus = "idle";
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

async function loadMyHistory() {
  if (!state.user) {
    state.myHistory = [];
    state.historyError = "";
    return;
  }
  try {
    const result = await api("/api/me/history");
    state.myHistory = Array.isArray(result.attempts) ? result.attempts : [];
    state.historyError = "";
  } catch (error) {
    state.historyError = error.message || "Your attempt history could not be loaded.";
  }
}

async function loadCommunityResults() {
  if (!state.user) {
    state.communityResults = [];
    state.communityStatus = "idle";
    state.communityError = "";
    return;
  }
  state.communityStatus = "loading";
  state.communityError = "";
  try {
    const query = state.communityCategory === "all" ? "" : `?category=${encodeURIComponent(state.communityCategory)}`;
    const result = await api(`/api/community-results${query}`);
    state.communityResults = Array.isArray(result.entries) ? result.entries : [];
    state.communityStatus = "loaded";
  } catch (error) {
    state.communityError = error.message || "Community results could not be loaded.";
    state.communityStatus = "error";
  }
  render();
}

async function loadAdminQuestions() {
  if (state.user?.role !== "admin") return;
  state.adminLoading = true;
  state.adminError = "";
  state.adminNotice = "";
  renderAdmin();
  try {
    const result = await api("/api/admin/questions");
    state.adminCategories = Array.isArray(result.categories) ? result.categories : [];
    state.adminQuestions = Array.isArray(result.questions) ? result.questions : [];
    state.adminLoading = false;
  } catch (error) {
    state.adminLoading = false;
    state.adminError = error.message || "Questions could not be loaded.";
  }
  renderAdmin();
}

async function saveAdminQuestion(form) {
  const formData = new FormData(form);
  const question = {
    categoryId: formData.get("categoryId"),
    difficulty: formData.get("difficulty"),
    prompt: formData.get("prompt"),
    options: [0, 1, 2, 3].map((index) => formData.get(`choice${index}`)),
    correctIndex: Number(formData.get("correctIndex")),
    explanation: formData.get("explanation"),
  };
  state.adminLoading = true;
  state.adminError = "";
  state.adminNotice = "";
  renderAdmin();
  try {
    await api(state.adminEditingId ? `/api/admin/questions/${state.adminEditingId}` : "/api/admin/questions", {
      method: state.adminEditingId ? "PUT" : "POST",
      body: JSON.stringify(question),
    });
    state.adminEditingId = null;
    await loadAdminQuestions();
    state.adminNotice = "Question saved.";
    renderAdmin();
  } catch (error) {
    state.adminLoading = false;
    state.adminError = error.message || "Question could not be saved.";
    renderAdmin();
  }
}

async function handleCsvFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  state.adminCsvError = "";
  state.adminCsvNotice = "";
  state.adminCsvRows = [];
  try {
    if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
    if (file.size > 1024 * 1024) throw new Error("CSV files must be smaller than 1 MB.");
    state.adminCsvText = await file.text();
  } catch (error) {
    state.adminCsvText = "";
    state.adminCsvError = error.message || "The CSV file could not be read.";
  }
  renderAdmin();
}

async function previewAdminCsv() {
  state.adminCsvError = "";
  state.adminCsvNotice = "";
  try {
    const result = await api("/api/admin/questions/csv/preview", {
      method: "POST",
      body: state.adminCsvText,
      headers: { "Content-Type": "text/csv" },
    });
    state.adminCsvRows = Array.isArray(result.rows) ? result.rows : [];
  } catch (error) {
    state.adminCsvRows = [];
    state.adminCsvError = error.message || "The CSV could not be validated.";
  }
  renderAdmin();
}

async function importAdminCsv() {
  if (!state.adminCsvRows.some((row) => row.valid)) return;
  state.adminCsvError = "";
  state.adminCsvNotice = "";
  try {
    const result = await api("/api/admin/questions/csv/import", {
      method: "POST",
      body: state.adminCsvText,
      headers: { "Content-Type": "text/csv" },
    });
    state.adminCsvNotice = `${result.imported} questions imported. ${result.invalid} invalid rows skipped.`;
    state.adminCsvRows = Array.isArray(result.rows) ? result.rows : [];
    await loadAdminQuestions();
    renderAdmin();
  } catch (error) {
    state.adminCsvError = error.message || "The CSV could not be imported.";
    renderAdmin();
  }
}

function startAdmin() {
  if (state.user?.role !== "admin") return;
  state.screen = "admin";
  state.adminEditingId = null;
  renderAdmin();
  loadAdminQuestions();
}

function renderCommunityResults() {
  if (!state.user) return "";
  const categories = state.quizzes.map((quiz) =>
    `<option value="${escapeHTML(quiz.id)}" ${state.communityCategory === quiz.id ? "selected" : ""}>${escapeHTML(quiz.title)}</option>`
  ).join("");
  let content;
  if (state.communityStatus === "loading") {
    content = '<p class="record-note" role="status">Loading recent results…</p>';
  } else if (state.communityError) {
    content = `<p class="record-note" role="alert">${escapeHTML(state.communityError)}</p>`;
  } else if (state.communityResults.length === 0) {
    content = '<p class="record-note">Completed results will appear here, newest first.</p>';
  } else {
    content = `<div class="community-results-list">${state.communityResults.map((entry) => {
      const outcome = entry.outcome || {};
      const score = entry.score === null || entry.score === undefined
        ? "Unscored"
        : `${entry.score} / ${outcome.maxScore || entry.totalQuestions}${entry.percentage == null ? "" : ` · ${entry.percentage}%`}`;
      const details = [...new Set([
        outcome.profileSummary,
        outcome.tier,
        outcome.level ? `Level ${outcome.level}` : null,
        outcome.feedback,
        outcome.recommendation,
      ].filter(Boolean))];
      const responses = Array.isArray(entry.sharedResponses) && entry.sharedResponses.length
        ? `<div class="community-response-list"><strong>Shared preferences</strong><ul>${entry.sharedResponses.map((response) =>
          `<li><span>${escapeHTML(response.question)}</span><b>${escapeHTML(response.answer)}</b></li>`
        ).join("")}</ul></div>`
        : "";
      const date = new Date(entry.completedAt);
      const dateLabel = Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
      return `<article class="community-result">
        <div class="community-result-meta"><strong>${escapeHTML(entry.username)}</strong><span>${escapeHTML(dateLabel)}</span></div>
        <h3>${escapeHTML(entry.title)}</h3>
        <p class="community-result-score">${escapeHTML(score)}</p>
        ${details.map((detail) => `<p class="community-result-feedback">${escapeHTML(detail)}</p>`).join("")}
        ${responses}
      </article>`;
    }).join("")}</div>`;
  }
  return `<section class="community-board" id="community-results" aria-labelledby="community-results-title">
    <div class="community-board-heading">
      <div><div class="eyebrow"><span class="eyebrow-line"></span> From the community</div>
      <h2 id="community-results-title">Community results</h2>
      <p>See what other students found useful. Recent results appear first; this is not a competition.</p></div>
      <label class="community-filter">Activity
        <select id="community-category"><option value="all">All activities</option>${categories}</select>
      </label>
    </div>
    ${content}
  </section>`;
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
  const homeNavigation = screenName === "setup" || screenName === "admin" ? `
    <nav class="site-nav" aria-label="Main navigation">
      <a href="#quiz-library">Explore</a>
      <a href="#matcher-promo">Study tools</a>
      ${state.user ? '<a href="#my-history">My History</a>' : ""}
      ${state.user ? '<a href="#community-results">Community results</a>' : ""}
      ${state.user?.role === "admin" ? '<button class="site-nav-button" type="button" data-action="open-admin">Admin tools</button>' : ""}
    </nav>` : "";
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
        <a class="brand" href="/" aria-label="Study Smart home">
          <img class="brand-logo" src="/study-smart-logo.jpg" alt="Study Smart" width="520" height="375">
        </a>
        ${homeNavigation}
        <div class="top-note"><span class="top-note-mark" aria-hidden="true"></span>Study Smart</div>
        ${authBar}
      </header>
      ${content}
      ${renderAuthModal()}
      <footer class="app-footer">
        <span>Study Smart</span>
        <span>Build momentum, one session at a time</span>
      </footer>
    </div>`;
}

function renderAdmin() {
  if (state.user?.role !== "admin") {
    app.innerHTML = shell('<main class="admin-page"><h1>Admin access required</h1><p>This area is available to administrators only.</p></main>', "admin");
    return;
  }
  const question = state.adminQuestions.find((item) => item.id === state.adminEditingId);
  const categoryOptions = state.adminCategories.map((category) =>
    `<option value="${escapeHTML(category.id)}" ${question?.categoryId === category.id ? "selected" : ""}>${escapeHTML(category.title)}</option>`
  ).join("");
  const choices = Array.isArray(question?.options) ? question.options : ["", "", "", ""];
  const questionList = state.adminQuestions.map((item) => `<article class="admin-question">
    <div><span class="admin-question-category">${escapeHTML(item.categoryTitle)} · ${escapeHTML(item.difficulty)}</span>
    <h3>${escapeHTML(item.prompt)}</h3>
    <ol type="A">${(item.options || []).map((option) => `<li>${escapeHTML(option)}${item.correctIndex === item.options.indexOf(option) ? " (correct)" : ""}</li>`).join("")}</ol></div>
    <button class="secondary-button" type="button" data-action="edit-admin-question" data-question-id="${item.id}">Edit</button>
  </article>`).join("");
  const preview = state.adminCsvRows.length
    ? `<div class="csv-preview"><h3>Import preview</h3><p>${state.adminCsvRows.filter((row) => row.valid).length} valid · ${state.adminCsvRows.filter((row) => !row.valid).length} invalid</p>
      <div class="csv-preview-table-wrap"><table class="csv-preview-table"><thead><tr><th>Row</th><th>Question</th><th>Status</th></tr></thead><tbody>
      ${state.adminCsvRows.map((row) => `<tr class="${row.valid ? "csv-valid" : "csv-invalid"}"><td>${row.rowNumber}</td><td>${escapeHTML(row.prompt)}</td><td>${row.valid ? "Ready to import" : escapeHTML(row.errors.join(" "))}</td></tr>`).join("")}
      </tbody></table></div>
      ${state.adminCsvRows.some((row) => row.valid) ? '<button class="primary-button" type="button" data-action="import-admin-csv">Import valid rows</button>' : ""}
      ${state.adminCsvNotice ? `<p class="admin-notice" role="status">${escapeHTML(state.adminCsvNotice)}</p>` : ""}
      </div>`
    : "";

  app.innerHTML = shell(`<main class="admin-page">
    <div class="admin-page-heading"><div class="eyebrow"><span class="eyebrow-line"></span> Administrator workspace</div><h1>Question library</h1><p>Add or edit scored quiz questions. Existing survey content is kept separate.</p></div>
    ${state.adminError ? `<p class="admin-error" role="alert">${escapeHTML(state.adminError)}</p>` : ""}
    ${state.adminNotice ? `<p class="admin-notice" role="status">${escapeHTML(state.adminNotice)}</p>` : ""}
    <div class="admin-tool-grid">
      <section class="admin-panel">
        <h2>${question ? "Edit question" : "Add a question"}</h2>
        <form id="admin-question-form">
          <label>Quiz<select name="categoryId" required>${categoryOptions}</select></label>
          <label>Difficulty<select name="difficulty" required>
            ${["easy", "medium", "hard"].map((level) => `<option value="${level}" ${(question?.difficulty || "easy") === level ? "selected" : ""}>${level[0].toUpperCase()}${level.slice(1)}</option>`).join("")}
          </select></label>
          <label>Question<textarea name="prompt" maxlength="500" required>${escapeHTML(question?.prompt || "")}</textarea></label>
          ${choices.map((choice, index) => `<label>Choice ${String.fromCharCode(65 + index)}<input name="choice${index}" value="${escapeHTML(choice)}" maxlength="300" required></label>`).join("")}
          <label>Correct choice<select name="correctIndex" required>${["A", "B", "C", "D"].map((letter, index) => `<option value="${index}" ${question?.correctIndex === index ? "selected" : ""}>${letter}</option>`).join("")}</select></label>
          <label>Explanation<textarea name="explanation" maxlength="1000">${escapeHTML(question?.explanation || "")}</textarea></label>
          <div class="admin-form-actions"><button class="primary-button" type="submit" ${state.adminLoading ? "disabled" : ""}>${question ? "Save changes" : "Add question"}</button>
          ${question ? '<button class="text-button" type="button" data-action="new-admin-question">Cancel edit</button>' : ""}</div>
        </form>
      </section>
      <section class="admin-panel">
        <h2>Import questions from CSV</h2>
        <p>Use columns: quiz_id, question_text, choice_a, choice_b, choice_c, choice_d, correct_choice. Imports use Easy difficulty.</p>
        <label class="csv-file-label">Choose CSV file<input id="admin-csv-file" type="file" accept=".csv,text/csv"></label>
        ${state.adminCsvError ? `<p class="admin-error" role="alert">${escapeHTML(state.adminCsvError)}</p>` : ""}
        ${state.adminCsvText ? `<button class="secondary-button" type="button" data-action="preview-admin-csv">Preview CSV</button>` : ""}
        ${preview}
      </section>
    </div>
    <section class="admin-question-list"><div class="admin-list-heading"><h2>Questions</h2><span>${state.adminQuestions.length} listed</span></div>
      ${state.adminLoading ? '<p role="status">Loading questions…</p>' : questionList || '<p class="record-note">No editable questions yet.</p>'}
    </section>
  </main>`, "admin");
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
        const isBlockerSurvey = record.categoryId === "study_blockers";
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
            : isBlockerSurvey
              ? `Study patterns: ${result.profileSummary || "saved"}`
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

  return `<section class="account-records" id="your-progress" aria-labelledby="account-records-title">
    <div class="account-records-heading">
      <div>
        <div class="eyebrow"><span class="eyebrow-line"></span> Saved to your account</div>
        <h2 id="account-records-title">Your latest quiz records</h2>
      </div>
    </div>
    ${content}
  </section>`;
}

function renderMyHistory() {
  if (!state.user) return "";

  let content;
  if (state.historyError) {
    content = `<p class="record-note" role="alert">${escapeHTML(state.historyError)}</p>`;
  } else if (state.myHistory.length === 0) {
    content = '<p class="record-note">Completed activities will appear here.</p>';
  } else {
    const rows = state.myHistory.map((attempt) => {
      const result = attempt.result || {};
      const outcome = attempt.score !== null && attempt.score !== undefined
        ? result.maxScore
          ? `${attempt.score} / ${result.maxScore} points`
          : attempt.percentage !== null && attempt.percentage !== undefined
            ? `${attempt.score} / ${attempt.totalQuestions} · ${attempt.percentage}%`
            : `${attempt.score} / ${attempt.totalQuestions} points`
        : result.profileSummary || result.tier || result.category || "Response saved";
      const completedDate = new Date(attempt.completedAt);
      const formattedDate = Number.isNaN(completedDate.getTime())
        ? "Date unavailable"
        : completedDate.toLocaleString();
      return `<tr>
        <th scope="row">${escapeHTML(attempt.title)}</th>
        <td>${escapeHTML(outcome)}</td>
        <td><time datetime="${escapeHTML(attempt.completedAt)}">${escapeHTML(formattedDate)}</time></td>
      </tr>`;
    }).join("");
    content = `<div class="history-table-wrap">
      <table class="history-table">
        <thead><tr><th scope="col">Activity</th><th scope="col">Result</th><th scope="col">Completed</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  return `<section class="account-records" id="my-history" aria-labelledby="my-history-title">
    <div class="account-records-heading">
      <div>
        <div class="eyebrow"><span class="eyebrow-line"></span> Your completed attempts</div>
        <h2 id="my-history-title">My History</h2>
      </div>
    </div>
    ${content}
  </section>`;
}

function renderSetup() {
  app.innerHTML = shell(`
    <main class="setup-layout reveal">
      <section class="intro-panel" aria-labelledby="intro-title">
        <div class="intro-top eyebrow eyebrow-light"><span class="eyebrow-line"></span> Study Smart · Learning hub</div>
        <div class="intro-copy">
          <h1 id="intro-title">Study smarter.<em>Start anywhere.</em></h1>
          <p>Build confidence, find your rhythm, and make your next study session count.</p>
          <div class="hero-actions">
            <a class="primary-button hero-primary" href="#quiz-library">Explore quizzes <span aria-hidden="true">↘</span></a>
            <a class="hero-text-link" href="#matcher-promo">Find a tool that fits <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div class="hero-visual">
          <img class="hero-study-photo" src="/study-session.webp" alt="A student writing in a notebook at her desk">
        </div>
        <div class="orbit-tag" aria-hidden="true">Knowledge<br>is power<br>here</div>
        <div class="intro-foot"><span>Study smart · learn your way</span><span>${String(state.quizzes.length).padStart(2, "0")} ACTIVITIES</span></div>
      </section>
      <section class="setup-content" id="quiz-library" aria-labelledby="setup-title">
        <div class="setup-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> Choose your next step</div>
          <h2 id="setup-title">Explore the library</h2>
          <p>Pick an activity that meets you where you are today.</p>
        </div>
        ${renderMyRecords()}
        ${renderMyHistory()}
        ${renderCommunityResults()}
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
              <legend class="section-heading">All study activities <span class="section-hint">Select one to begin</span></legend>
              <div class="category-grid">
                ${state.quizzes.map((quiz, index) => {
                  const selected = state.selectedQuizId === quiz.id;
                  const symbol = String(index + 1).padStart(2, "0");
                  const quizId = `quiz-${index}`;
                  const kind = quiz.id === "study_blockers" ? "SELF-REFLECTION" :
                    quiz.id === "study_personality" ? "STUDY HABITS" :
                    quiz.id === "club_carnival" ? "COMMUNITY" :
                    quiz.id === "student_wellness" ? "WELLBEING" :
                    quiz.id === "study_skills" ? "PRACTICE" : "QUIZ";
                  return `<label class="category-choice" data-selected="${selected}" for="${quizId}">
                    <input id="${quizId}" type="radio" name="quizId" value="${escapeHTML(quiz.id)}" ${selected ? "checked" : ""} required>
                    <span class="category-symbol" aria-hidden="true">${symbol}</span>
                    <span class="category-copy">
                      <span class="category-kind">${kind}</span>
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
              <p class="form-footnote">Your progress saves to your account when you’re signed in.</p>
            </div>
          </form>`}
        <section class="matcher-promo" id="matcher-promo">
          <div>
            <div class="eyebrow"><span class="eyebrow-line"></span> Separate survey</div>
            <h3>Which study tools fit you?</h3>
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
  const currentAnswer = state.answers[state.currentQuestionIndex];
  const hasCurrentAnswer = currentAnswer !== null && currentAnswer !== undefined;
  const answeredCount = state.answers.filter((answer) => answer !== null && answer !== undefined).length;
  const percent = Math.round((answeredCount / total) * 100);
  const currentQuestion = state.questions[state.currentQuestionIndex];
  const isBlockerSurvey = (state.currentQuiz?.id || state.selectedQuizId) === "study_blockers";
  
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
              <span class="selection-hint">${hasCurrentAnswer ? "Answer selected. Ready to continue." : "Select an answer to continue."}</span>
              <div class="quiz-navigation">
                <button class="secondary-button prev-button" type="button" data-action="prev-question" ${state.currentQuestionIndex === 0 ? "disabled" : ""}>
                  <span class="button-arrow" aria-hidden="true">\u2190</span><span>Previous</span>
                </button>
                ${state.currentQuestionIndex < total - 1 ? `
                  <button class="primary-button next-button" type="button" data-action="next-question" ${!hasCurrentAnswer ? "disabled" : ""}>
                    <span>Next</span><span class="button-arrow" aria-hidden="true">\u2192</span>
                  </button>` : `
                  <button class="primary-button submit-quiz-button" type="submit" ${!hasCurrentAnswer ? "disabled" : ""}>
                    <span>${state.submitting ? "Submitting..." : "Submit Quiz"}</span><span class="button-arrow" aria-hidden="true">${state.submitting ? "\u2026" : "\u2192"}</span>
                  </button>`}
              </div>
            </div>
            ${state.answerError ? `<div class="notice answer-error" role="alert"><span class="notice-symbol" aria-hidden="true">!</span><div><strong>Your response didn\u2019t go through.</strong><p>${escapeHTML(state.answerError)}</p></div></div>` : ""}
          </form>
        </section>
        <aside class="aside-card">
          <div class="aside-label">${isBlockerSurvey ? "Before you begin" : "A friendly reminder"}</div>
          <h3>${isBlockerSurvey ? "Think about a normal school week." : "This isn\u2019t a test."}</h3>
          <p>${isBlockerSurvey ? "Pick the answer that is most true for you, even if it’s not flattering. Honest answers give more useful tips." : "It\u2019s a small detour for your brain. Take a breath, trust what you know, and enjoy the surprise."}</p>
          <div class="aside-rule"></div>
          <div class="aside-note">${isBlockerSurvey ? "There are no right or wrong answers. Your reflection prompts are private and are not saved." : "Your answer stays hidden until you lock it in. No peeking ahead."}</div>
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

function renderStudyBlockerResults(result) {
  const weekLabels = {
    S: ["Day 1", "Days 2–3", "Days 4–5", "Day 6", "Day 7"],
    D: ["Day 1", "Days 2–3", "Days 4–5", "Day 6", "Day 7"],
    E: ["Day 1", "Days 2–4", "Days 5–6", "Day 7"],
    P: ["Day 1", "Days 2–5", "Day 6", "Day 7"],
    M: ["Day 1", "Days 2–5", "Day 6", "Day 7"],
  };
  const focusProfiles = result.isSteadyBuilder
    ? [{ id: "steady", ...result.steadyBuilder }]
    : (result.primaryProfiles || [])
      .map((id) => result.profiles?.find((profile) => profile.id === id))
      .filter(Boolean);
  const bars = (result.profiles || []).map((profile) => {
    const percent = Math.max(0, Math.min(100, Number(profile.percentage) || 0));
    return `<div class="personality-bar-row">
      <div class="personality-bar-label"><span>${escapeHTML(profile.emoji)} ${escapeHTML(profile.name)}</span><strong>${percent}%</strong></div>
      <div class="personality-bar-track" role="progressbar" aria-label="${escapeHTML(profile.name)} match" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="personality-bar-fill" style="width:${percent}%"></div></div>
    </div>`;
  }).join("");
  const cards = focusProfiles.map((profile) => `
    <article class="personality-profile-card">
      <div class="eyebrow"><span class="eyebrow-line"></span>${escapeHTML(profile.emoji)} Your pattern</div>
      <h3>${escapeHTML(profile.name)}</h3>
      <p>${escapeHTML(profile.what || "")}</p>
      ${profile.why ? `<div class="personality-detail-grid"><div><h4>Why it can happen</h4><p>${escapeHTML(profile.why)}</p></div></div>` : ""}
      <h4>Fixes to try</h4>
      <ul>${(profile.fixes || []).map((tip) => `<li>${escapeHTML(tip)}</li>`).join("")}</ul>
      ${profile.plan?.length ? `<h4>7-day starter plan</h4><ol>${profile.plan.map((step, index) => `<li><strong>${escapeHTML(weekLabels[profile.id]?.[index] || `Day ${index + 1}`)}:</strong> ${escapeHTML(step)}</li>`).join("")}</ol>` : ""}
      ${profile.tools ? `<p><strong>Tools to try:</strong> ${escapeHTML(profile.tools)}</p>` : ""}
      ${profile.careNote ? `<p class="blocker-care-note">${escapeHTML(profile.careNote)}</p>` : ""}
    </article>`).join("");
  return `<div class="personality-results">
    <section class="personality-distribution" aria-labelledby="blocker-results-title">
      <div class="eyebrow"><span class="eyebrow-line"></span> Your response patterns</div>
      <h3 id="blocker-results-title">${escapeHTML(result.profileSummary || "Your study patterns")}</h3>
      <p>This is a self-reflection check-in, not a diagnosis or a grade. Patterns can change, and no answer is right or wrong.</p>
      ${result.blendMessage ? `<p class="personality-blend">${escapeHTML(result.blendMessage)}</p>` : ""}
      <div class="personality-bars">${bars}</div>
    </section>
    <div class="personality-profile-grid">${cards}</div>
    <section class="personality-reflections" aria-labelledby="blocker-reflections-title">
      <div class="eyebrow"><span class="eyebrow-line"></span> Reflect privately</div>
      <h3 id="blocker-reflections-title">Think it over</h3>
      <ol>${(result.reflections || []).map((prompt) => `<li>${escapeHTML(prompt)}</li>`).join("")}</ol>
      <p>Your reflection answers are not collected or saved.</p>
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
  const isBlockerSurvey = categoryId === "study_blockers";
  const isFeedbackSurvey = categoryId === "student_wellness" || categoryId === "study_skills";
  const isSelfReflectionSurvey = isPersonalitySurvey || isBlockerSurvey;
  const perfectRound = !isOpinionSurvey && !isSelfReflectionSurvey && percentage === 100;
  
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
          <div class="eyebrow"><span class="eyebrow-line"></span> ${isBlockerSurvey ? "Check-in" : "Quiz"} complete \u00b7 ${escapeHTML(state.playerName)}</div>
          <h1 id="results-title">${isBlockerSurvey ? "Your Study Patterns" : isPersonalitySurvey ? "Your Study Personality" : isOpinionSurvey || isFeedbackSurvey ? "Survey Complete!" : perfectRound ? "Perfect Score!" : "Great Effort!"}</h1>
          <p>${isBlockerSurvey ? "A self-reflection check-in, not a test or diagnosis. Use these patterns as a starting point, not a label." : isPersonalitySurvey ? "A self-reflection tool, not a test. Use these patterns as a starting point, not a label." : isOpinionSurvey ? "Your responses have been saved to your account." : perfectRound ? "You answered all questions correctly! Excellent work." : isFeedbackSurvey ? "Here are your results." : "You've completed the quiz. Review your results below."}</p>
          ${surveyContent}
          <div class="result-stats">
            <span class="result-stat"><strong>${escapeHTML(state.currentQuiz?.title || state.selectedQuizId)}</strong> ${isBlockerSurvey ? "check-in" : "quiz"}</span>
            ${isOpinionSurvey || isSelfReflectionSurvey ? "" : !isFeedbackSurvey ? `
              <span class="result-stat"><strong>${escapeHTML(score)}</strong> / ${escapeHTML(total)} correct</span>
              <span class="result-stat"><strong>${escapeHTML(percentage)}%</strong> score</span>` : `
              <span class="result-stat"><strong>${escapeHTML(score)}</strong> / ${escapeHTML(result.maxScore || total)} points</span>`}
          </div>
        </div>
        ${isOpinionSurvey || isSelfReflectionSurvey ? "" : `<div class="score-stamp" aria-label="Score ${score} out of ${total}">
          <span class="score-number">${escapeHTML(score)}<span style="font-size:.52em">/${escapeHTML(result.maxScore || total)}</span></span>
          <span class="score-caption">your score</span>
        </div>`}
      </section>
      <section class="results-summary" aria-labelledby="summary-title">
        <div class="summary-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> Results Summary</div>
          <h2 id="summary-title">${isBlockerSurvey ? "Patterns and next steps" : isPersonalitySurvey ? "Your study patterns and next steps" : isOpinionSurvey || isFeedbackSurvey ? "Your Responses" : "Question Breakdown"}</h2>
        </div>
        ${isBlockerSurvey ? renderStudyBlockerResults(result) : isPersonalitySurvey ? renderStudyPersonalityResults(result) : `<div class="results-list">
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
  else if (state.screen === "admin") renderAdmin();
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
    const allowsNoNumericScore = categoryId === "club_carnival" || categoryId === "study_personality" || categoryId === "study_blockers";
    if (!result || (!allowsNoNumericScore && typeof result.score !== "number")) {
      throw new Error("We couldn\u2019t calculate your score. Please try again.");
    }
    
    state.results = result;
    state.screen = "results";
    state.submitting = false;
    await Promise.all([loadMyRecords(), loadMyHistory(), loadCommunityResults()]);
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
  if (!(target instanceof HTMLInputElement) && target.tagName !== "SELECT") return;

  if (target.id === "admin-csv-file") {
    handleCsvFile(target);
    return;
  }
  if (target.id === "community-category") {
    state.communityCategory = target.value;
    loadCommunityResults();
    return;
  }
  
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
  if (form.id === "admin-question-form") saveAdminQuestion(form);
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
  if (action === "open-admin") startAdmin();
  if (action === "new-admin-question") {
    state.adminEditingId = null;
    renderAdmin();
  }
  if (action === "edit-admin-question") {
    state.adminEditingId = Number(trigger.dataset.questionId);
    renderAdmin();
  }
  if (action === "preview-admin-csv") previewAdminCsv();
  if (action === "import-admin-csv") importAdminCsv();
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
