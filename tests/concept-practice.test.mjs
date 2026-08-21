import test from "node:test";
import { readFile } from "node:fs/promises";
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

test("portable iOS recall cards offer a separate judged Swift companion after reveal", async () => {
  const [items, component, app] = await Promise.all([
    readFile(new URL("../app/lib/items.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ConceptPractice.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(items, /"ios:copy-on-write-draft": "swift-independent-array-copies"/);
  assert.match(items, /"ios:optional-throwing-boundary": "swift-optional-port-boundary"/);
  assert.match(component, /Next step · portable execution/);
  assert.match(component, /Open isolated Swift solve/);
  assert.match(component, /Public\s+examples are practice feedback; sealed\s+cases remain private/);
  assert.match(app, /candidate\.trustedChallengeKey ===/);
  assert.match(app, /onOpenCompanion=\{\(item\) =>/);
  assert.match(app, /props\.onOpenItem\(item, 5, undefined, undefined, "solving"\)/);
});
