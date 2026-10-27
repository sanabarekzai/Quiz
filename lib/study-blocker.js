function calculateStudyBlockerResult(questions, answers, data) {
  if (!Array.isArray(questions) || questions.length !== data.questions.length ||
      !Array.isArray(answers) || answers.length !== questions.length ||
      answers.some((index) => !Number.isInteger(index) || index < 0 || index > 3)) {
    throw new Error("Study blocker results require all 12 valid answers.");
  }
  const counts = Object.fromEntries(data.order.map((id) => [id, 0]));
  const results = questions.map((question, index) => {
    const profileId = question.answer_points?.[answers[index]];
    if (!Object.hasOwn(counts, profileId)) throw new Error("Study blocker scoring is not configured correctly.");
    counts[profileId]++;
    return { questionId: question.id, selectedIndex: answers[index], isCorrect: null, isScored: false };
  });
  const lastAnswerProfile = questions.at(-1).answer_points[answers.at(-1)];
  const profiles = data.order.map((id) => ({
    id,
    ...data.profiles[id],
    points: counts[id],
    maxPoints: data.maxPoints[id],
    percentage: Math.round(counts[id] / data.maxPoints[id] * 100),
  })).sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints ||
    (a.id === lastAnswerProfile ? -1 : b.id === lastAnswerProfile ? 1 : data.order.indexOf(a.id) - data.order.indexOf(b.id)));

  const exactPercent = (profile) => profile.points / profile.maxPoints * 100;
  const isSteadyBuilder = profiles.every((profile) => exactPercent(profile) < data.steadyThreshold);
  const primaryProfiles = isSteadyBuilder
    ? ["steady"]
    : [profiles[0].id, ...(exactPercent(profiles[0]) - exactPercent(profiles[1]) <= 10 ? [profiles[1].id] : [])];
  const profileSummary = isSteadyBuilder
    ? data.profiles.steady.name
    : primaryProfiles.map((id) => data.profiles[id].name).join(" + ");
  const blendKey = primaryProfiles.length === 2
    ? data.order.filter((id) => primaryProfiles.includes(id)).join("")
    : null;
  return {
    score: null,
    totalQuestions: questions.length,
    percentage: null,
    results,
    profiles,
    primaryProfiles,
    isSteadyBuilder,
    profileSummary,
    blendMessage: blendKey ? data.blends[blendKey] || null : null,
    steadyBuilder: data.profiles.steady,
    reflections: data.reflections,
    feedback: profileSummary,
  };
}

module.exports = { calculateStudyBlockerResult };
