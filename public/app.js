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
async function registerUser() {
  const { username, password, firstName, lastName, displayName } = state.registerData;
  if (!username || !password || !firstName || !lastName) {
    state.authError = "All fields are required.";
    render();
    return;
  }
  if (username.length < 5) {
    state.authError = "Username must be at least 5 characters.";
    render();
    return;
  }
  if (firstName.length < 5 || lastName.length < 5) {
    state.authError = "First and last name must be at least 5 characters.";
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
    render();
  } catch (error) {
    state.authError = error.message || "Registration failed.";
    state.authLoading = false;
    render();
  }
}

async function loginUser() {
  const { username, password } = state.loginData;
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
    render();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

async function checkAuthStatus() {
  try {
    const result = await api("/api/me");
    state.user = result.user;
    render();
  } catch (error) {
    state.user = null;
    render();
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

function updateRegisterField(field, value) {
  state.registerData[field] = value;
}

function updateLoginField(field, value) {
  state.loginData[field] = value;
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
          <form id="register-form" onsubmit="event.preventDefault(); registerUser();">
            <div class="form-group">
              <label for="reg-username">Username (min 5 chars)</label>
              <input type="text" id="reg-username" value="${escapeHTML(state.registerData.username)}" oninput="updateRegisterField('username', this.value)" required minlength="5">
            </div>
            <div class="form-group">
              <label for="reg-password">Password</label>
              <input type="password" id="reg-password" value="${escapeHTML(state.registerData.password)}" oninput="updateRegisterField('password', this.value)" required>
            </div>
            <div class="form-group">
              <label for="reg-firstName">First Name (min 5 chars)</label>
              <input type="text" id="reg-firstName" value="${escapeHTML(state.registerData.firstName)}" oninput="updateRegisterField('firstName', this.value)" required minlength="5">
            </div>
            <div class="form-group">
              <label for="reg-lastName">Last Name (min 5 chars)</label>
              <input type="text" id="reg-lastName" value="${escapeHTML(state.registerData.lastName)}" oninput="updateRegisterField('lastName', this.value)" required minlength="5">
            </div>
            <div class="form-group">
              <label for="reg-displayName">Display Name (optional)</label>
              <input type="text" id="reg-displayName" value="${escapeHTML(state.registerData.displayName)}" oninput="updateRegisterField('displayName', this.value)" placeholder="${escapeHTML(state.registerData.firstName)} ${escapeHTML(state.registerData.lastName)}">
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
          <form id="login-form" onsubmit="event.preventDefault(); loginUser();">
            <div class="form-group">
              <label for="login-username">Username</label>
              <input type="text" id="login-username" value="${escapeHTML(state.loginData.username)}" oninput="updateLoginField('username', this.value)" required>
            </div>
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" value="${escapeHTML(state.loginData.password)}" oninput="updateLoginField('password', this.value)" required>
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

function renderSetup() {
  const selectedQuiz = state.quizzes.find((quiz) => quiz.id === state.selectedQuizId);
  
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
            <div class="form-section">
              <label class="section-heading" for="player-name">What should we call you? <span class="section-hint">On the leaderboard</span></label>
              <input class="name-field" id="player-name" name="playerName" type="text" maxlength="24" autocomplete="nickname" placeholder="Your name" value="${escapeHTML(state.playerName)}" required>
            </div>
            <div class="form-actions">
              <button class="primary-button start-button" type="submit" ${state.starting || !state.selectedQuizId ? "disabled" : ""}>
                <span>${state.starting ? "Loading quiz..." : "Start Quiz"}</span><span class="button-arrow" aria-hidden="true">${state.starting ? "\u2026" : "\u2192"}</span>
              </button>
              <p class="form-footnote">A few minutes, a fresh perspective. That\u2019s the whole plan.</p>
            </div>
          </form>`}
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

function renderResults() {
  const result = state.results || {};
  const score = Number(result.score) || 0;
  const total = Number(result.totalQuestions) || 0;
  const percentage = Number(result.percentage) || 0;
  const perfectRound = percentage === 100;
  
  app.innerHTML = shell(`
    <main class="results-layout reveal">
      <section class="results-hero" aria-labelledby="results-title">
        <div class="results-copy">
          <div class="eyebrow"><span class="eyebrow-line"></span> Quiz complete \u00b7 ${escapeHTML(state.playerName)}</div>
          <h1 id="results-title">${perfectRound ? "Perfect Score!" : "Great Effort!"}</h1>
          <p>${perfectRound ? "You answered all questions correctly! Excellent work." : "You've completed the quiz. Review your results below."}</p>
          <div class="result-stats">
            <span class="result-stat"><strong>${escapeHTML(state.currentQuiz?.title || state.selectedQuizId)}</strong> quiz</span>
            <span class="result-stat"><strong>${escapeHTML(score)}</strong> / ${escapeHTML(total)} correct</span>
            <span class="result-stat"><strong>${escapeHTML(percentage)}%</strong> score</span>
          </div>
        </div>
        <div class="score-stamp" aria-label="Score ${score} out of ${total}">
          <span class="score-number">${escapeHTML(score)}<span style="font-size:.52em">/${escapeHTML(total)}</span></span>
          <span class="score-caption">your score</span>
        </div>
      </section>
      <section class="results-summary" aria-labelledby="summary-title">
        <div class="summary-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> Results Summary</div>
          <h2 id="summary-title">Question Breakdown</h2>
        </div>
        <div class="results-list">
          ${state.questions.map((question, index) => {
            const answer = state.answers[index];
            const isCorrect = answer === question.correctIndex;
            return `<div class="result-item ${isCorrect ? "correct" : "incorrect"}">
              <span class="result-question">Q${index + 1}: ${escapeHTML(question.prompt)}</span>
              <span class="result-answer">Your answer: ${escapeHTML(question.options[answer] || "No answer")}</span>
              <span class="result-status">${isCorrect ? "\u2713 Correct" : "\u2717 Incorrect"}</span>
              ${!isCorrect ? `<span class="result-correct">Correct: ${escapeHTML(question.options[question.correctIndex])}</span>` : ""}
            </div>`;
          }).join("")}
        </div>
        <div class="results-actions">
          <button class="primary-button" type="button" data-action="retry-quiz"><span>Retry Quiz</span><span class="button-arrow" aria-hidden="true">\u2192</span></button>
          <button class="secondary-button" type="button" data-action="back-to-setup">Back to Quiz Selection</button>
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
  const playerName = String(formData.get("playerName") || "").trim();
  const quizId = String(formData.get("quizId") || "");
  
  if (!playerName || !quizId) {
    state.setupError = !quizId ? "Choose a quiz before starting." : "Add your name before starting.";
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
    if (!result?.quiz || !Array.isArray(result.questions)) {
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
      }),
    });
    
    if (!result || typeof result.score !== "number") {
      throw new Error("We couldn\u2019t calculate your score. Please try again.");
    }
    
    state.results = result;
    state.screen = "results";
    state.submitting = false;
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
    const nameField = app.querySelector("#player-name");
    if (nameField) state.playerName = nameField.value;
    state.selectedQuizId = target.value;
    app.querySelectorAll(".category-choice").forEach((choice) => {
      const radio = choice.querySelector('input[name="quizId"]');
      choice.dataset.selected = String(radio?.checked || false);
    });
    const button = app.querySelector(".start-button");
    if (button) button.disabled = state.starting || !state.selectedQuizId;
    renderSetup();
  } else if (target.name === "playerName") {
    state.playerName = target.value;
  } else if (target.name === "answer") {
    state.answers[state.currentQuestionIndex] = Number(target.value);
    app.querySelectorAll(".answer-option").forEach((choice) => {
      const radio = choice.querySelector('input[name="answer"]');
      choice.dataset.selected = String(radio?.checked || false);
    });
    renderQuiz();
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
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
