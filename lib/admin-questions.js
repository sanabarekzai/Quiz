const EDITABLE_CATEGORIES = new Set(["science", "geography", "history", "study_skills"]);
const CSV_HEADER = ["quiz_id", "question_text", "choice_a", "choice_b", "choice_c", "choice_d", "correct_choice"];

function parseCsv(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("Choose a CSV file with question rows.");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function validateCsv(text, existingQuestions = new Set()) {
  const rows = parseCsv(text);
  const header = rows.shift()?.map((value, index) => index === 0 ? value.replace(/^\uFEFF/, "").trim().toLowerCase() : value.trim().toLowerCase());
  if (!header || header.length !== CSV_HEADER.length || header.some((value, index) => value !== CSV_HEADER[index])) {
    throw new Error(`CSV header must be: ${CSV_HEADER.join(",")}`);
  }
  if (rows.length > 500) throw new Error("A CSV can contain at most 500 question rows.");

  const seen = new Set();
  return rows.map((cells, index) => {
    const errors = [];
    if (cells.length !== CSV_HEADER.length) errors.push("Expected seven columns.");
    const [categoryId, prompt, ...choiceCells] = cells;
    const choices = choiceCells.slice(0, 4).map((value) => String(value || "").trim());
    const correctChoice = String(choiceCells[4] || "").trim().toUpperCase();
    if (!EDITABLE_CATEGORIES.has(String(categoryId || "").trim())) errors.push("Choose a supported quiz ID.");
    if (!String(prompt || "").trim()) errors.push("Question text is required.");
    if (String(prompt || "").length > 500) errors.push("Question text must be 500 characters or fewer.");
    if (choices.length !== 4 || choices.some((choice) => !choice)) errors.push("All four choices are required.");
    if (choices.some((choice) => choice.length > 300)) errors.push("Each choice must be 300 characters or fewer.");
    if (!["A", "B", "C", "D"].includes(correctChoice)) errors.push("Correct choice must be A, B, C, or D.");
    const key = `${String(categoryId || "").trim()}\u0000easy\u0000${String(prompt || "").trim().toLowerCase()}`;
    if (seen.has(key) || existingQuestions.has(key)) errors.push("This question already exists for that quiz.");
    seen.add(key);
    return {
      rowNumber: index + 2,
      categoryId: String(categoryId || "").trim(),
      prompt: String(prompt || "").trim(),
      choices,
      correctIndex: ["A", "B", "C", "D"].indexOf(correctChoice),
      valid: errors.length === 0,
      errors,
    };
  });
}

function validateQuestion(input) {
  const categoryId = String(input?.categoryId || "").trim();
  const prompt = String(input?.prompt || "").trim();
  const options = Array.isArray(input?.options) ? input.options.map((value) => String(value || "").trim()) : [];
  const difficulty = String(input?.difficulty || "easy");
  const correctIndex = Number(input?.correctIndex);
  const explanation = String(input?.explanation || "").trim();
  const errors = [];
  if (!EDITABLE_CATEGORIES.has(categoryId)) errors.push("Choose a supported quiz.");
  if (!prompt || prompt.length > 500) errors.push("Question text must be between 1 and 500 characters.");
  if (options.length !== 4 || options.some((option) => !option || option.length > 300)) errors.push("Enter four choices of 1 to 300 characters.");
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) errors.push("Choose the correct answer.");
  if (!["easy", "medium", "hard"].includes(difficulty)) errors.push("Choose a valid difficulty.");
  if (explanation.length > 1000) errors.push("Explanation must be 1000 characters or fewer.");
  return {
    valid: errors.length === 0,
    errors,
    question: { categoryId, prompt, options, difficulty, correctIndex, explanation },
  };
}

module.exports = { CSV_HEADER, EDITABLE_CATEGORIES, parseCsv, validateCsv, validateQuestion };
