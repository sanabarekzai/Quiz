function publicQuestions(data) {
  return data.questions.map(({ id, text, choices }) => ({
    id,
    text,
    choices: choices.map(({ id: choiceId, text: choiceText }) => ({ id: choiceId, text: choiceText })),
  }));
}

function validateAnswers(answers, data) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false;
  if (Object.keys(answers).length !== data.questions.length) return false;
  return data.questions.every((question) =>
    typeof answers[question.id] === "string" &&
    question.choices.some((choice) => choice.id === answers[question.id]));
}

function calculateResults(answers, data) {
  const points = Object.fromEntries(data.tools.map((tool) => [tool.id, 0]));
  const maxPossible = Object.fromEntries(data.tools.map((tool) => [tool.id, 0]));
  const groupNames = Object.fromEntries(data.groups.map((group) => [group.id, group.name]));
  for (const question of data.questions) {
    for (const tool of data.tools) {
      maxPossible[tool.id] += Math.max(0, ...question.choices.map((choice) => choice.points[tool.id] || 0));
    }
    const selected = question.choices.find((choice) => choice.id === answers[question.id]);
    for (const [toolId, value] of Object.entries(selected.points)) points[toolId] += value;
  }
  const firstChoice = data.questions[0].choices.find((choice) => choice.id === answers[1]);
  const ranking = data.tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    group: tool.group,
    groupName: groupNames[tool.group],
    matchPercent: Math.round(100 * points[tool.id] / maxPossible[tool.id]),
    blurb: tool.blurb,
    firstStep: tool.firstStep,
  })).sort((a, b) =>
    b.matchPercent - a.matchPercent ||
    (firstChoice.points[b.id] || 0) - (firstChoice.points[a.id] || 0) ||
    a.name.localeCompare(b.name));
  ranking.forEach((tool, index) => { tool.rank = index + 1; });
  const groupScores = data.groups.map((group) => ({
    id: group.id,
    name: group.name,
    matchPercent: Math.round(group.tools.reduce((sum, id) =>
      sum + ranking.find((tool) => tool.id === id).matchPercent, 0) / group.tools.length),
  })).sort((a, b) => b.matchPercent - a.matchPercent || a.name.localeCompare(b.name));
  return { ranking, groupScores, bestGroup: groupScores[0], note: data.resultNote };
}

module.exports = { publicQuestions, validateAnswers, calculateResults };
