const CONCEPT_GRADES = ["again", "hard", "good", "easy"];

export function supportsConceptPractice(item) {
  return Boolean(
    item?.track === "ios" &&
      Array.isArray(item.recallChecks) &&
      item.recallChecks.length === 3 &&
      Array.isArray(item.conceptAnswers) &&
      item.conceptAnswers.length === 3,
  );
}

export function selectConceptCheckIndex(attempts, itemId, itemRevision) {
  const completed = (Array.isArray(attempts) ? attempts : []).filter(
    (attempt) =>
      attempt?.itemId === itemId &&
      Number(attempt.itemRevision) === Number(itemRevision) &&
      attempt.practiceKind === "concept" &&
      attempt.outcome === "completed",
  ).length;
  return completed % 3;
}

export function isConceptGrade(value) {
  return CONCEPT_GRADES.includes(value);
}

export function conceptQualification({ grade, peeks = 0 } = {}) {
  return Number(peeks) === 0 && (grade === "good" || grade === "easy")
    ? "independent"
    : "assisted";
}

export function cleanConceptResponse(value, limit = 1_000) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}
