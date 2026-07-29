import assert from "node:assert/strict";
import test from "node:test";
import {
  CONCEPT_TRANSFER_LANES,
  CONCEPT_TRANSFER_SOURCES,
  RECORDS_SECTIONS,
  parseRoute,
  resolveRouteItem,
  routeForItem,
  serializeRoute,
} from "../app/lib/routes.mjs";
import { DEFAULT_CATALOG_QUERY } from "../app/lib/catalog-discovery.mjs";
import { DEFAULT_SUBMISSION_WORK_LOG_QUERY } from "../app/lib/submission-work-log.mjs";

test("study plans have a first-class reload-safe route", () => {
  const route = parseRoute("/?view=plans");
  assert.equal(route.view, "plans");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/"),
    "/swift-ghost/?view=plans",
  );
});

test("Pattern Academy routes round-trip bounded lesson state and ignore it elsewhere", () => {
  const route = parseRoute(
    "/swift-ghost/?view=learn&pattern=arrays-hashing&lessonStep=trace&stale=1#lesson",
  );
  assert.equal(route.view, "learn");
  assert.equal(route.patternId, "arrays-hashing");
  assert.equal(route.lessonStep, "trace");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?old=1#lesson"),
    "/swift-ghost/?view=learn&pattern=arrays-hashing&lessonStep=trace#lesson",
  );

  const defaultStep = parseRoute("/?view=learn&pattern=trees");
  assert.equal(defaultStep.lessonStep, "recognize");
  assert.equal(serializeRoute(defaultStep), "/?view=learn&pattern=trees");

  for (const value of ["../../private", "UPPER CASE", "x".repeat(65)]) {
    const invalid = parseRoute(`/?view=learn&pattern=${encodeURIComponent(value)}`);
    assert.equal(invalid.patternId, undefined);
    assert.equal(invalid.lessonStep, undefined);
  }
  assert.equal(
    parseRoute("/?view=learn&pattern=stack&lessonStep=admin").lessonStep,
    "recognize",
  );
  assert.equal(
    parseRoute("/?view=improve&pattern=arrays-hashing&lessonStep=trace").patternId,
    undefined,
  );
  assert.doesNotMatch(
    serializeRoute({
      view: "improve",
      patternId: "arrays-hashing",
      lessonStep: "trace",
    }),
    /pattern=|lessonStep=/,
  );
});

test("Pattern Decision Review routes preserve a bounded sprint and exclude lesson state", () => {
  const route = parseRoute(
    "/swift-ghost/?view=learn&review=mixed&sprint=pattern-sprint%3Aabc-123&pattern=trees&lessonStep=trace",
  );
  assert.equal(route.view, "learn");
  assert.equal(route.learnReview, "mixed");
  assert.equal(route.patternSprintId, "pattern-sprint:abc-123");
  assert.equal(route.patternId, undefined);
  assert.equal(route.lessonStep, undefined);
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=learn&review=mixed&sprint=pattern-sprint%3Aabc-123",
  );

  const malformed = parseRoute(
    `/?view=learn&review=mixed&sprint=${encodeURIComponent("../".repeat(80))}`,
  );
  assert.equal(malformed.learnReview, "mixed");
  assert.equal(malformed.patternSprintId, undefined);
  assert.equal(
    parseRoute("/?view=learn&review=admin&sprint=valid-sprint").learnReview,
    undefined,
  );
  assert.equal(
    parseRoute("/?view=records&review=mixed&sprint=valid-sprint").learnReview,
    undefined,
  );
  assert.doesNotMatch(
    serializeRoute({
      view: "records",
      learnReview: "mixed",
      patternSprintId: "valid-sprint",
    }),
    /review=mixed|sprint=/,
  );
});

test("Test Design Academy round-trips lane, sprint, and exact evidence while clearing incompatible lesson state", () => {
  const route = parseRoute(
    "/?view=learn&review=tests&lane=swift&sprint=test-lab%3Aabc&attempt=test-attempt%3A1&pattern=trees&lessonStep=trace",
  );
  assert.equal(route.learnReview, "tests");
  assert.equal(route.testDesignLane, "swift");
  assert.equal(route.testDesignSprintId, "test-lab:abc");
  assert.equal(route.testDesignAttemptId, "test-attempt:1");
  assert.equal(route.patternSprintId, undefined);
  assert.equal(route.patternId, undefined);
  assert.equal(route.lessonStep, undefined);
  assert.equal(
    serializeRoute(route),
    "/?view=learn&review=tests&lane=swift&sprint=test-lab%3Aabc&attempt=test-attempt%3A1",
  );

  for (const lane of ["python", "swift", "ios"]) {
    const laneRoute = parseRoute(`/?view=learn&review=tests&lane=${lane}`);
    assert.equal(laneRoute.testDesignLane, lane);
    assert.equal(
      serializeRoute(laneRoute),
      `/?view=learn&review=tests&lane=${lane}`,
    );
  }

  const invalid = parseRoute(
    "/?view=learn&review=tests&lane=admin&sprint=..%2Fprivate&attempt=..%2Fprivate",
  );
  assert.equal(invalid.testDesignLane, undefined);
  assert.equal(invalid.testDesignSprintId, undefined);
  assert.equal(invalid.testDesignAttemptId, undefined);
  assert.equal(serializeRoute(invalid), "/?view=learn&review=tests");

  const mixed = parseRoute("/?view=learn&review=mixed&sprint=pattern-only");
  assert.equal(mixed.testDesignSprintId, undefined);
  assert.equal(mixed.testDesignLane, undefined);
  assert.equal(mixed.testDesignAttemptId, undefined);
  assert.equal(
    serializeRoute({
      view: "learn",
      learnReview: "tests",
      patternSprintId: "wrong",
      testDesignSprintId: "right",
      testDesignLane: "ios",
      testDesignAttemptId: "evidence-1",
    }),
    "/?view=learn&review=tests&lane=ios&sprint=right&attempt=evidence-1",
  );
  assert.doesNotMatch(
    serializeRoute({
      view: "records",
      learnReview: "tests",
      testDesignLane: "swift",
      testDesignAttemptId: "evidence-1",
    }),
    /review=tests|lane=swift|attempt=evidence-1/,
  );
});

test("Cold Reconstruction Lab routes preserve only bounded Swift and iOS variant state", () => {
  assert.deepEqual(CONCEPT_TRANSFER_LANES, ["swift", "ios"]);
  assert.deepEqual(CONCEPT_TRANSFER_SOURCES, ["academy", "today", "assessment", "weakness"]);
  const route = parseRoute(
    "/?view=learn&review=reconstruct&lane=swift&variant=concept-transfer%3Aarc-capture&from=weakness&pattern=trees&sprint=wrong",
  );
  assert.equal(route.learnReview, "reconstruct");
  assert.equal(route.conceptTransferLane, "swift");
  assert.equal(route.conceptTransferVariantId, "concept-transfer:arc-capture");
  assert.equal(route.conceptTransferSource, "weakness");
  assert.equal(route.patternId, undefined);
  assert.equal(route.patternSprintId, undefined);
  assert.equal(route.testDesignLane, undefined);
  assert.equal(
    serializeRoute(route),
    "/?view=learn&review=reconstruct&lane=swift&variant=concept-transfer%3Aarc-capture&from=weakness",
  );

  const ios = parseRoute("/?view=learn&review=reconstruct&lane=ios");
  assert.equal(ios.conceptTransferLane, "ios");
  assert.equal(serializeRoute(ios), "/?view=learn&review=reconstruct&lane=ios");

  const invalid = parseRoute(
    "/?view=learn&review=reconstruct&lane=python&variant=..%2Fprivate&from=admin",
  );
  assert.equal(invalid.conceptTransferLane, undefined);
  assert.equal(invalid.conceptTransferVariantId, undefined);
  assert.equal(invalid.conceptTransferSource, undefined);
  assert.equal(serializeRoute(invalid), "/?view=learn&review=reconstruct");

  assert.doesNotMatch(
    serializeRoute({
      view: "records",
      learnReview: "reconstruct",
      conceptTransferLane: "swift",
      conceptTransferVariantId: "concept-transfer:arc-capture",
      conceptTransferSource: "today",
      patternSprintId: "stale-pattern-sprint",
    }),
    /reconstruct|concept-transfer|lane=swift|from=today|sprint=/,
  );

  assert.doesNotMatch(
    serializeRoute({
      view: "learn",
      learnReview: "reconstruct",
      conceptTransferLane: "swift",
      patternSprintId: "stale-pattern-sprint",
    }),
    /sprint=/,
  );
});

test("Weakness Lab filters and selected cases are bounded and reload-safe", () => {
  const route = parseRoute(
    "/?view=improve&inbox=due&lane=python&case=python%3Aarrays-hashing%3Averification",
  );
  assert.equal(route.view, "improve");
  assert.equal(route.weaknessFilter, "due");
  assert.equal(route.weaknessLane, "python");
  assert.equal(route.weaknessCaseId, "python:arrays-hashing:verification");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=improve&inbox=due&lane=python&case=python%3Aarrays-hashing%3Averification",
  );

  const fallback = parseRoute(
    "/?view=improve&inbox=../../all&lane=admin&case=../../private",
  );
  assert.equal(fallback.weaknessFilter, "priority");
  assert.equal(fallback.weaknessLane, "all");
  assert.equal(fallback.weaknessCaseId, undefined);
  assert.equal(
    serializeRoute(fallback, "https://example.test/swift-ghost/"),
    "/swift-ghost/?view=improve",
  );
  assert.doesNotMatch(
    serializeRoute(
      {
        view: "library",
        weaknessFilter: "due",
        weaknessLane: "python",
        weaknessCaseId: "python:arrays-hashing:verification",
      },
      "https://example.test/",
    ),
    /inbox=|case=/,
  );
});

test("attempt closures have a bounded reload-safe Records route", () => {
  assert.ok(RECORDS_SECTIONS.includes("closures"));
  const route = parseRoute(
    "/?view=records&section=closures&closure=closure%3Asubmission%3Aabc_123",
  );
  assert.equal(route.recordsSection, "closures");
  assert.equal(route.closureId, "closure:submission:abc_123");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=records&section=closures&closure=closure%3Asubmission%3Aabc_123",
  );

  const invalid = parseRoute(
    "/?view=records&section=closures&closure=..%2Fprivate",
  );
  assert.equal(invalid.closureId, undefined);
  assert.equal(serializeRoute(invalid), "/?view=records&section=closures");
  assert.doesNotMatch(
    serializeRoute({ view: "library", closureId: "closure:submission:abc" }),
    /closure=/,
  );
});

test("practice-session recaps have a bounded reload-safe route", () => {
  const route = parseRoute("/?view=sessions&session=session_01-recap:2");
  assert.equal(route.view, "sessions");
  assert.equal(route.sessionId, "session_01-recap:2");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=sessions&session=session_01-recap%3A2",
  );
  assert.equal(
    parseRoute("/?view=sessions&session=../../private").sessionId,
    undefined,
  );
  assert.equal(
    parseRoute("/?view=library&session=session-1").sessionId,
    undefined,
  );
  assert.doesNotMatch(
    serializeRoute(
      { view: "library", sessionId: "session-1" },
      "https://example.test/",
    ),
    /session=/,
  );
});

test("assessments have reload-safe list and detail routes", () => {
  assert.deepEqual(parseRoute("/?view=assessments&assessment=python-reentry"), {
    view: "assessments",
    language: undefined,
    track: undefined,
    item: undefined,
    stage: undefined,
    practiceKind: undefined,
    communityTab: undefined,
    profile: undefined,
    assessment: "python-reentry",
  });
  assert.equal(
    serializeRoute(
      { view: "assessments", assessment: "ios-pulse" },
      "https://example.test/swift-ghost/",
    ),
    "/swift-ghost/?view=assessments&assessment=ios-pulse",
  );
  assert.equal(
    parseRoute("/?view=assessments&assessment=../../bad").assessment,
    undefined,
  );
  assert.doesNotMatch(
    serializeRoute(
      { view: "library", assessment: "python-reentry" },
      "https://example.test/",
    ),
    /assessment=/,
  );
});

test("the contest center has bounded reload-safe section and report routes", () => {
  assert.deepEqual(
    parseRoute(
      "/swift-ghost/?view=assessments&assessment=virtual-rounds&contest=review&round=virtual-round_01%3Areport",
    ),
    {
      view: "assessments",
      language: undefined,
      track: undefined,
      item: undefined,
      stage: undefined,
      practiceKind: undefined,
      communityTab: undefined,
      profile: undefined,
      assessment: "virtual-rounds",
      contestSection: "review",
      contestRoundId: "virtual-round_01:report",
    },
  );
  assert.equal(
    serializeRoute(
      {
        view: "assessments",
        assessment: "virtual-rounds",
        contestSection: "standings",
      },
      "https://example.test/swift-ghost/?stale=1",
    ),
    "/swift-ghost/?view=assessments&assessment=virtual-rounds&contest=standings",
  );
  assert.equal(
    serializeRoute(
      {
        view: "assessments",
        assessment: "virtual-rounds",
        contestSection: "review",
        contestRoundId: "virtual-round_01:report",
      },
      "https://example.test/swift-ghost/",
    ),
    "/swift-ghost/?view=assessments&assessment=virtual-rounds&contest=review&round=virtual-round_01%3Areport",
  );
  assert.equal(
    serializeRoute(
      {
        view: "assessments",
        assessment: "virtual-rounds",
        contestSection: "overview",
      },
      "https://example.test/swift-ghost/",
    ),
    "/swift-ghost/?view=assessments&assessment=virtual-rounds",
  );
  assert.equal(
    parseRoute(
      "/?view=assessments&assessment=virtual-rounds&contest=../../admin&round=../../private",
    ).contestSection,
    "overview",
  );
  assert.equal(
    parseRoute(
      "/?view=assessments&assessment=virtual-rounds&contest=review&round=../../private",
    ).contestRoundId,
    undefined,
  );
  assert.equal(
    parseRoute("/?view=library&contest=standings&round=round-1")
      .contestSection,
    undefined,
  );
  assert.doesNotMatch(
    serializeRoute({
      view: "library",
      assessment: "virtual-rounds",
      contestSection: "review",
      contestRoundId: "round-1",
    }),
    /contest=|round=/,
  );
});

test("the Records submission work log round-trips filters, selection, and compare state", () => {
  const route = parseRoute(
    "/swift-ghost/?view=records&section=submissions&sq=two+sum&verdict=accepted&verdict=pending&origin=mock&language=python&revision=older&range=30d&sort=oldest&page=3&size=50&submission=receipt-2&compare=receipt-1",
  );
  assert.equal(route.view, "records");
  assert.equal(route.recordsSection, "submissions");
  assert.deepEqual(route.submissions, {
    ...DEFAULT_SUBMISSION_WORK_LOG_QUERY,
    text: "two sum",
    statuses: ["accepted", "pending"],
    origins: ["mock"],
    languages: ["python"],
    revision: "older",
    range: "30d",
    sort: "oldest",
    page: 3,
    pageSize: 50,
    selectedId: "receipt-2",
    compareId: "receipt-1",
  });
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=records&section=submissions&sq=two+sum&verdict=accepted&verdict=pending&origin=mock&language=python&revision=older&range=30d&sort=oldest&page=3&size=50&submission=receipt-2&compare=receipt-1",
  );
  const ignored = parseRoute(
    "/?view=library&section=submissions&verdict=accepted&submission=receipt-2",
  );
  assert.equal(ignored.recordsSection, undefined);
  assert.equal(ignored.submissions, undefined);
});

test("solution review routes preserve a bounded attempt identity", () => {
  const route = parseRoute(
    "/swift-ghost/?view=records&section=reviews&attempt=attempt_01-review:2",
  );
  assert.equal(route.view, "records");
  assert.equal(route.recordsSection, "reviews");
  assert.equal(route.reviewAttemptId, "attempt_01-review:2");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=records&section=reviews&attempt=attempt_01-review%3A2",
  );
  assert.equal(
    parseRoute(
      "/?view=records&section=reviews&attempt=..%2F..%2Fprivate",
    ).reviewAttemptId,
    undefined,
  );
  assert.equal(
    parseRoute("/?view=library&section=reviews&attempt=attempt-1")
      .reviewAttemptId,
    undefined,
  );
});

test("longitudinal readiness trends have a canonical Records route", () => {
  const route = parseRoute(
    "/swift-ghost/?view=records&section=trends&attempt=ignored&verdict=accepted",
  );
  assert.equal(route.view, "records");
  assert.equal(route.recordsSection, "trends");
  assert.equal(route.reviewAttemptId, undefined);
  assert.equal(route.submissions, undefined);
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=records&section=trends",
  );
  assert.equal(
    parseRoute("/?view=library&section=trends").recordsSection,
    undefined,
  );
});

test("transfer evidence routes preserve only bounded variant and attempt identities", () => {
  const route = parseRoute(
    "/swift-ghost/?view=records&section=transfer&variant=transfer%3A20001&attempt=attempt_01-review%3A2&verdict=accepted",
  );
  assert.equal(route.view, "records");
  assert.equal(route.recordsSection, "transfer");
  assert.equal(route.transferVariantId, "transfer:20001");
  assert.equal(route.transferAttemptId, "attempt_01-review:2");
  assert.equal(route.reviewAttemptId, undefined);
  assert.equal(route.submissions, undefined);
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?stale=1"),
    "/swift-ghost/?view=records&section=transfer&variant=transfer%3A20001&attempt=attempt_01-review%3A2",
  );

  const missingVariant = parseRoute(
    "/?view=records&section=transfer&attempt=attempt-1",
  );
  assert.equal(missingVariant.transferVariantId, undefined);
  assert.equal(missingVariant.transferAttemptId, undefined);
  assert.equal(
    parseRoute("/?view=records&section=transfer&variant=../../private")
      .transferVariantId,
    undefined,
  );
  assert.equal(
    parseRoute("/?view=library&section=transfer&variant=transfer:20001")
      .transferVariantId,
    undefined,
  );
});

const items = [
  {
    itemId: "builtin:1",
    slug: "two-sum",
    language: "swift",
    track: "interview",
    source: "builtin",
  },
  {
    itemId: "python:1",
    slug: "two-sum",
    language: "python",
    track: "interview",
    source: "builtin",
  },
  {
    itemId: "custom:abc",
    slug: "custom-abc",
    language: "python",
    track: "interview",
    source: "custom",
  },
  {
    itemId: "ios:actor-cache",
    slug: "actor-cache",
    language: "swift",
    track: "ios",
    source: "builtin",
  },
];

test("parses safe deep links and preserves legacy profile links", () => {
  assert.deepEqual(
    parseRoute("/?view=practice&lang=python&item=two-sum&stage=4"),
    {
      view: "practice",
      language: "python",
      track: undefined,
      item: "two-sum",
      stage: 4,
      practiceKind: undefined,
      communityTab: undefined,
      profile: undefined,
      assessment: undefined,
    },
  );
  assert.deepEqual(parseRoute("/?profile=kevin-swift"), {
    view: "records",
    language: undefined,
    track: undefined,
    item: undefined,
    stage: undefined,
    practiceKind: undefined,
    communityTab: "profile",
    profile: "kevin-swift",
    assessment: undefined,
    recordsSection: "overview",
  });
});

test("rejects malformed route dimensions without throwing", () => {
  assert.deepEqual(
    parseRoute("/?view=nope&lang=ruby&stage=99&profile=%F0%28%8C%28"),
    {
      view: "today",
      language: undefined,
      track: undefined,
      item: undefined,
      stage: undefined,
      practiceKind: undefined,
      communityTab: undefined,
      profile: undefined,
      assessment: undefined,
    },
  );
});

test("resolves duplicate slugs by language", () => {
  assert.equal(
    resolveRouteItem(
      items,
      parseRoute("/?view=practice&lang=python&item=two-sum"),
    )?.itemId,
    "python:1",
  );
  assert.equal(
    resolveRouteItem(
      items,
      parseRoute("/?view=practice&lang=swift&item=two-sum"),
    )?.itemId,
    "builtin:1",
  );
  assert.equal(
    resolveRouteItem(
      [items[1], items[0]],
      parseRoute("/?view=practice&item=two-sum"),
    )?.itemId,
    "builtin:1",
  );
});

test("serializes routes without losing a static-host base path", () => {
  const route = routeForItem(items[1], 3);
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/?old=1"),
    "/swift-ghost/?view=practice&lang=python&track=interview&item=two-sum&stage=3",
  );
  assert.equal(
    serializeRoute(routeForItem(items[2], 2), "https://example.test/"),
    "/?view=practice&lang=python&track=interview&item=custom%3Aabc&stage=2",
  );
  assert.equal(
    serializeRoute(routeForItem(items[3], 1), "https://example.test/"),
    "/?view=practice&lang=swift&track=ios&item=actor-cache&stage=1",
  );
  assert.equal(
    serializeRoute(
      routeForItem(items[1], 5, "solving"),
      "https://example.test/swift-ghost/",
    ),
    "/swift-ghost/?view=practice&lang=python&track=interview&item=two-sum&stage=5&practice=solve",
  );
  assert.equal(
    parseRoute("/?view=practice&practice=solve").practiceKind,
    "solving",
  );
  assert.equal(
    parseRoute("/?view=practice&practice=unknown").practiceKind,
    undefined,
  );
});

test("concept practice deep links round-trip explicitly", () => {
  const route = parseRoute(
    "https://example.test/?view=practice&track=ios&item=value-reference-snapshots&stage=5&practice=concept",
  );
  assert.equal(route.practiceKind, "concept");
  assert.match(
    serializeRoute(route, "https://example.test/swift-ghost/"),
    /practice=concept/,
  );
});

test("library catalog routes round-trip every canonical query dimension in order", () => {
  const catalog = {
    text: " two sum ",
    lanes: ["python", "ios"],
    patterns: ["Sliding Window", "Heap"],
    difficulties: ["Medium", "Hard"],
    statuses: ["due", "favorite"],
    lineRange: "26-40",
    timeRange: "11-15",
    collectionIds: ["plan:meta", "favorites"],
    sort: "title",
    direction: "desc",
    layout: "cards",
    page: 3,
    pageSize: 50,
  };
  const serialized = serializeRoute(
    { view: "library", catalog },
    "https://example.test/swift-ghost/?old=1#catalog",
  );
  assert.equal(
    serialized,
    "/swift-ghost/?view=library&q=two+sum&lane=python&lane=ios&pattern=Sliding+Window&pattern=Heap&difficulty=Medium&difficulty=Hard&status=due&status=favorite&lines=26-40&time=11-15&collection=plan%3Ameta&collection=favorites&sort=title&dir=desc&layout=cards&page=3&size=50#catalog",
  );
  assert.deepEqual(parseRoute(serialized).catalog, {
    ...catalog,
    text: "two sum",
  });
});

test("library catalog routes omit normalized defaults and discard unknown params", () => {
  const route = parseRoute("/?view=library&unknown=drop-me");
  assert.deepEqual(route.catalog, DEFAULT_CATALOG_QUERY);
  assert.equal(
    serializeRoute(route, "https://example.test/base/?stale=1#results"),
    "/base/?view=library#results",
  );
});

test("library routes dedupe and bound repeated facets through the catalog normalizer", () => {
  const patterns = Array.from({ length: 55 }, (_, index) => `pattern-${index}`);
  const params = new URLSearchParams({ view: "library" });
  params.append("lane", "python");
  params.append("lane", "python");
  params.append("lane", "ios");
  params.append("difficulty", "Easy");
  params.append("difficulty", "Easy");
  params.append("status", "due");
  params.append("status", "due");
  params.append("collection", "study-one");
  params.append("collection", "study-one");
  for (const pattern of patterns) params.append("pattern", pattern);

  const catalog = parseRoute(params).catalog;
  assert.deepEqual(catalog.lanes, ["python", "ios"]);
  assert.deepEqual(catalog.difficulties, ["Easy"]);
  assert.deepEqual(catalog.statuses, ["due"]);
  assert.deepEqual(catalog.collectionIds, ["study-one"]);
  assert.equal(catalog.patterns.length, 50);
  assert.equal(catalog.patterns.at(-1), "pattern-49");
});

test("legacy library language and track params map to canonical lanes", () => {
  const laneFor = (query) => parseRoute(`/?view=library&${query}`).catalog.lanes;
  assert.deepEqual(laneFor("lang=python"), ["python"]);
  assert.deepEqual(laneFor("lang=swift"), ["swift"]);
  assert.deepEqual(laneFor("track=ios"), ["ios"]);
  assert.deepEqual(laneFor("track=ios&lang=python"), ["ios"]);
  assert.deepEqual(laneFor("track=ios&lang=swift"), ["ios"]);
  assert.deepEqual(laneFor("track=interview&lang=python"), ["python"]);
  assert.deepEqual(laneFor("track=interview&lang=swift"), ["swift"]);
  assert.deepEqual(laneFor("track=interview"), []);
  assert.deepEqual(laneFor("lane=nope&track=ios&lang=python"), []);
  assert.equal(
    serializeRoute(parseRoute("/?view=library&track=ios&lang=python")),
    "/?view=library&lane=ios",
  );
  assert.equal(
    serializeRoute({ view: "library", language: "python" }),
    "/?view=library&lane=python",
  );
});

test("malformed and oversized catalog route input normalizes safely", () => {
  const params = new URLSearchParams({
    view: "library",
    q: `  ${"x".repeat(200)}  `,
    lines: "huge",
    time: "soon",
    sort: "random",
    dir: "sideways",
    layout: "grid",
    page: "9007199254740992",
    size: "30",
  });
  params.append("lane", "ruby");
  params.append("difficulty", "easy");
  params.append("status", "done");
  params.append("pattern", ` ${"p".repeat(160)} `);
  const catalog = parseRoute(params).catalog;
  assert.equal(catalog.text.length, 120);
  assert.deepEqual(catalog.lanes, []);
  assert.deepEqual(catalog.difficulties, []);
  assert.deepEqual(catalog.statuses, []);
  assert.equal(catalog.patterns[0].length, 120);
  assert.equal(catalog.lineRange, "all");
  assert.equal(catalog.timeRange, "all");
  assert.equal(catalog.sort, "recommended");
  assert.equal(catalog.direction, "asc");
  assert.equal(catalog.layout, "table");
  assert.equal(catalog.page, 1);
  assert.equal(catalog.pageSize, 25);
});

test("catalog query data is ignored outside the library view", () => {
  const route = parseRoute("/?view=practice&q=two-sum&lane=python&item=two-sum");
  assert.equal("catalog" in route, false);
  assert.equal(
    serializeRoute({
      view: "practice",
      language: "python",
      item: "two-sum",
      catalog: { ...DEFAULT_CATALOG_QUERY, lanes: ["ios"] },
    }),
    "/?view=practice&lang=python&item=two-sum",
  );
});
