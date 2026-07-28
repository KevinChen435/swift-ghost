import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanConceptResponse,
  conceptQualification,
  isConceptGrade,
  selectConceptCheckIndex,
  supportsConceptPractice,
} from "../app/lib/concept-practice.mjs";

test("concept checks rotate only current-revision completed concept attempts", () => {
  const attempts = [
    { itemId: "ios:a", itemRevision: 2, practiceKind: "concept", outcome: "completed" },
    { itemId: "ios:a", itemRevision: 1, practiceKind: "concept", outcome: "completed" },
    { itemId: "ios:a", itemRevision: 2, practiceKind: "typing", outcome: "completed" },
    { itemId: "ios:a", itemRevision: 2, practiceKind: "concept", outcome: "abandoned" },
  ];
  assert.equal(selectConceptCheckIndex(attempts, "ios:a", 2), 1);
  attempts.push({ itemId: "ios:a", itemRevision: 2, practiceKind: "concept", outcome: "completed" });
  assert.equal(selectConceptCheckIndex(attempts, "ios:a", 2), 2);
  attempts.push({ itemId: "ios:a", itemRevision: 2, practiceKind: "concept", outcome: "completed" });
  assert.equal(selectConceptCheckIndex(attempts, "ios:a", 2), 0);
});

test("concept evidence is strong only for unassisted good or easy recall", () => {
  assert.equal(conceptQualification({ grade: "good", peeks: 0 }), "independent");
  assert.equal(conceptQualification({ grade: "easy", peeks: 0 }), "independent");
  assert.equal(conceptQualification({ grade: "good", peeks: 1 }), "assisted");
  assert.equal(conceptQualification({ grade: "hard", peeks: 0 }), "assisted");
  assert.equal(isConceptGrade("again"), true);
  assert.equal(isConceptGrade("perfect"), false);
});

test("concept responses are bounded but never semantically scored", () => {
  assert.equal(cleanConceptResponse("my own explanation", 10), "my own exp");
  assert.equal(cleanConceptResponse(null), "");
});

test("concept capability requires a complete authored iOS card", () => {
  assert.equal(
    supportsConceptPractice({
      track: "ios",
      recallChecks: ["one", "two", "three"],
      conceptAnswers: ["a", "b", "c"],
    }),
    true,
  );
  assert.equal(
    supportsConceptPractice({ track: "ios", recallChecks: ["one"] }),
    false,
  );
  assert.equal(
    supportsConceptPractice({
      track: "interview",
      recallChecks: ["one", "two", "three"],
      conceptAnswers: ["a", "b", "c"],
    }),
    false,
  );
});
