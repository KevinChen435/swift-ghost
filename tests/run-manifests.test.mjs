import assert from "node:assert/strict";
import test from "node:test";
import {
  RUN_MANIFEST_DURATIONS,
  RUN_MANIFEST_LIMITS,
  archiveRunManifest,
  createRunManifest,
  createRunManifestWorkspace,
  deriveRunManifestReport,
  finishRunManifest,
  normalizeRunManifestWorkspace,
  resumeRunManifest,
  startRunManifest,
} from "../app/lib/run-manifests.mjs";

const NOW = "2026-07-29T12:00:00.000Z";
const LATER = "2026-07-29T12:30:00.000Z";

function item(index, overrides = {}) {
  return {
    itemId: `python:${index}`,
    contentRevision: index,
    title: `Problem ${index}`,
    track: "interview",
    language: "python",
    source: "builtin",
    difficulty: index % 2 ? "Easy" : "Medium",
    estimatedMinutes: 8 + index,
    verification: { revision: 10 + index },
    ...overrides,
  };
}

const registry = [
  item(1),
  item(2),
  item(3, {
    itemId: "builtin:3",
    language: "swift",
    verification: undefined,
  }),
  item(4, { itemId: "ios:arc", track: "ios", language: "swift", verification: undefined }),
];

function create(input = {}, workspace = createRunManifestWorkspace()) {
  return createRunManifest(
    workspace,
    {
      title: "Focused set",
      source: "catalog",
      mode: "practice",
      itemIds: ["python:2", "python:1"],
      ...input,
    },
    registry,
    { id: input.id ?? "manifest-1", now: NOW },
  );
}

test("creates a revision-one local workspace and freezes the exact authored order", () => {
  const source = structuredClone(registry);
  const workspace = create({}, createRunManifestWorkspace());
  const manifest = workspace.manifests[0];
  source[1].title = "Changed elsewhere";

  assert.equal(workspace.version, 1);
  assert.equal(manifest.status, "draft");
  assert.equal(manifest.durationMinutes, null);
  assert.deepEqual(
    manifest.entries.map(({ itemId, contentRevision, judgeRevision, title, lane, order }) => ({
      itemId,
      contentRevision,
      judgeRevision,
      title,
      lane,
      order,
    })),
    [
      { itemId: "python:2", contentRevision: 2, judgeRevision: 12, title: "Problem 2", lane: "python", order: 0 },
      { itemId: "python:1", contentRevision: 1, judgeRevision: 11, title: "Problem 1", lane: "python", order: 1 },
    ],
  );
});

test("snapshots non-runnable built-ins without inventing a judge revision", () => {
  const workspace = create({ itemIds: ["builtin:3", "ios:arc"] });
  assert.equal(workspace.manifests[0].entries[0].lane, "swift");
  assert.equal(workspace.manifests[0].entries[1].lane, "ios");
  assert.equal("judgeRevision" in workspace.manifests[0].entries[0], false);
});

test("snapshots the implicit revision-one contract for runnable judges", () => {
  const implicitRegistry = [
    item(1, { verification: { cases: [] } }),
    item(2, { verification: { cases: [] } }),
  ];
  const workspace = createRunManifest(
    createRunManifestWorkspace(),
    {
      title: "Implicit judge revisions",
      source: "catalog",
      mode: "practice",
      itemIds: ["python:1", "python:2"],
    },
    implicitRegistry,
    { id: "implicit-revision", now: NOW },
  );
  assert.deepEqual(
    workspace.manifests[0].entries.map((entry) => entry.judgeRevision),
    [1, 1],
  );
});

test("snapshots the sealed judge revision for runnable Swift items", () => {
  const swiftRegistry = [
    item(1, {
      itemId: "swift:swift-two-sum",
      language: "swift",
      trustedChallengeKey: "swift-two-sum",
      trustedJudgeRevision: 7,
      verification: undefined,
    }),
    item(2, {
      itemId: "swift:swift-binary-search",
      language: "swift",
      trustedChallengeKey: "swift-binary-search",
      trustedJudgeRevision: 9,
      verification: undefined,
    }),
  ];
  const workspace = createRunManifest(
    createRunManifestWorkspace(),
    {
      title: "Swift sealed set",
      source: "catalog",
      mode: "practice",
      itemIds: ["swift:swift-two-sum", "swift:swift-binary-search"],
    },
    swiftRegistry,
    { id: "swift-sealed", now: NOW },
  );
  assert.deepEqual(
    workspace.manifests[0].entries.map((entry) => entry.judgeRevision),
    [7, 9],
  );
});

test("counts accepted Swift evidence linked through the practice session context", () => {
  const swiftRegistry = [
    item(1, {
      itemId: "swift:swift-two-sum",
      language: "swift",
      trustedChallengeKey: "swift-two-sum",
      trustedJudgeRevision: 7,
      verification: undefined,
    }),
    item(2, {
      itemId: "swift:swift-binary-search",
      language: "swift",
      trustedChallengeKey: "swift-binary-search",
      trustedJudgeRevision: 9,
      verification: undefined,
    }),
  ];
  let workspace = createRunManifest(
    createRunManifestWorkspace(),
    {
      title: "Swift solve set",
      source: "catalog",
      mode: "practice",
      itemIds: ["swift:swift-two-sum", "swift:swift-binary-search"],
      execution: { kind: "session", id: "swift-session-1" },
    },
    swiftRegistry,
    { id: "swift-context", now: NOW },
  );
  workspace = startRunManifest(workspace, "swift-context", {
    now: NOW,
    execution: { kind: "session", id: "swift-session-1" },
  });
  const report = deriveRunManifestReport(workspace.manifests[0], {
    submissions: [{
      itemId: "swift:swift-two-sum",
      itemRevision: 1,
      lifecycle: "settled",
      status: "accepted",
      passed: 6,
      total: 6,
      judge: { revision: 7 },
      context: { kind: "practice", sessionId: "swift-session-1" },
    }],
  }, swiftRegistry);
  assert.equal(report.currentAcceptedCount, 1);
  assert.equal(report.entries[0].status, "accepted-current");
});

test("requires 2-12 distinct entries and only current built-in non-transfer registry items", () => {
  assert.throws(() => create({ itemIds: ["python:1"] }), /between 2 and 12/i);
  assert.throws(() => create({ itemIds: Array.from({ length: 13 }, (_, index) => `x:${index}`) }), /between 2 and 12/i);
  assert.throws(() => create({ itemIds: ["python:1", "python:1"] }), /distinct/i);

  const hostileRegistry = [
    item(1),
    item(2, { source: "custom" }),
    item(3, { transfer: { id: "sealed" } }),
    item(4, { archivedAt: NOW }),
  ];
  for (const rejected of ["python:2", "python:3", "python:4", "missing"]) {
    assert.throws(
      () => createRunManifest(createRunManifestWorkspace(), {
        title: "Invalid",
        source: "catalog",
        mode: "practice",
        itemIds: ["python:1", rejected],
      }, hostileRegistry, { id: `reject-${rejected}`, now: NOW }),
      /built-in non-transfer/i,
    );
  }
});

test("practice omits duration while timed accepts only the fixed duration contract", () => {
  assert.deepEqual(RUN_MANIFEST_DURATIONS, [30, 45, 60, 75, 90, 105]);
  for (const durationMinutes of RUN_MANIFEST_DURATIONS) {
    const workspace = create({
      id: `timed-${durationMinutes}`,
      mode: "timed",
      durationMinutes,
      execution: { kind: "virtual-round", id: `round-${durationMinutes}` },
    });
    assert.equal(workspace.manifests[0].durationMinutes, durationMinutes);
  }
  assert.throws(() => create({ mode: "timed", durationMinutes: 40 }), /mode/i);
  assert.equal(create({ durationMinutes: 90 }).manifests[0].durationMinutes, null);
});

test("deterministic caller IDs are required, unique, and preserved", () => {
  const first = create({ id: "fixed-id" });
  assert.equal(first.manifests[0].id, "fixed-id");
  assert.throws(
    () => createRunManifest(first, {
      title: "Duplicate",
      source: "collection",
      mode: "practice",
      itemIds: ["python:1", "python:2"],
    }, registry, { id: "fixed-id", now: NOW }),
    /already exists/i,
  );
  assert.throws(
    () => createRunManifest(createRunManifestWorkspace(), {
      title: "Missing ID",
      source: "catalog",
      mode: "practice",
      itemIds: ["python:1", "python:2"],
    }, registry, { now: NOW }),
    /identity/i,
  );
});

test("start enforces one active manifest and permanently binds the matching engine adapter", () => {
  let workspace = create({ id: "first" });
  workspace = create({ id: "second", source: "collection" }, workspace);
  const original = structuredClone(workspace);
  workspace = startRunManifest(workspace, "first", {
    now: NOW,
    execution: { kind: "session", id: "session-fixed" },
  });
  assert.equal(original.manifests[0].status, "draft");
  assert.deepEqual(resumeRunManifest(workspace, "first").execution, {
    kind: "session",
    id: "session-fixed",
  });
  assert.throws(
    () => startRunManifest(workspace, "second", { now: NOW, execution: { kind: "session", id: "another" } }),
    /already active/i,
  );
  assert.throws(
    () => startRunManifest(create({ id: "wrong-engine" }), "wrong-engine", {
      now: NOW,
      execution: { kind: "virtual-round", id: "round" },
    }),
    /session execution/i,
  );
  const resumed = resumeRunManifest(workspace, "first");
  resumed.entries[0].title = "Caller mutation";
  resumed.execution.id = "caller-mutation";
  assert.equal(workspace.manifests[0].entries[0].title, "Problem 2");
  assert.equal(workspace.manifests[0].execution.id, "session-fixed");
});

test("execution supplied at creation cannot be replaced at start", () => {
  const workspace = create({ execution: { kind: "session", id: "original-session" } });
  assert.throws(
    () => startRunManifest(workspace, "manifest-1", {
      now: NOW,
      execution: { kind: "session", id: "replacement-session" },
    }),
    /immutable/i,
  );
  const started = startRunManifest(workspace, "manifest-1", { now: NOW });
  assert.equal(started.manifests[0].execution.id, "original-session");
});

test("finish and archive allow only the exact lifecycle transitions and retain snapshots", () => {
  const draft = create({ execution: { kind: "session", id: "session-1" } });
  assert.throws(() => finishRunManifest(draft, "manifest-1", "completed", { now: LATER }), /active/i);
  let workspace = startRunManifest(draft, "manifest-1", { now: NOW });
  assert.throws(() => archiveRunManifest(workspace, "manifest-1", { now: LATER }), /completed or ended/i);
  const before = structuredClone(workspace.manifests[0]);
  workspace = finishRunManifest(workspace, "manifest-1", "completed", { now: LATER });
  assert.equal(workspace.manifests[0].status, "completed");
  assert.deepEqual(workspace.manifests[0].entries, before.entries);
  assert.deepEqual(workspace.manifests[0].execution, before.execution);
  workspace = archiveRunManifest(workspace, "manifest-1", { now: "2026-07-30T12:00:00Z" });
  assert.equal(workspace.manifests[0].status, "archived");
  assert.equal(workspace.manifests[0].archivedFrom, "completed");
  assert.deepEqual(workspace.manifests[0].entries, before.entries);
  assert.throws(() => resumeRunManifest(workspace, "manifest-1"), /active/i);
});

test("ended is a distinct honest finish outcome", () => {
  let workspace = startRunManifest(create(), "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  });
  workspace = finishRunManifest(workspace, "manifest-1", "ended", { now: LATER });
  assert.equal(workspace.manifests[0].status, "ended");
  assert.throws(() => finishRunManifest(workspace, "manifest-1", "completed", { now: LATER }), /active/i);
});

test("lifecycle timestamps are monotonic in commands and normalization", () => {
  const draft = create();
  assert.throws(
    () => startRunManifest(draft, "manifest-1", {
      now: "2026-07-29T11:59:59.999Z",
      execution: { kind: "session", id: "session-1" },
    }),
    /predate creation/i,
  );
  const active = startRunManifest(draft, "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  });
  assert.throws(
    () => finishRunManifest(active, "manifest-1", "completed", {
      now: "2026-07-29T11:59:59.999Z",
    }),
    /predate its start/i,
  );
  const finished = finishRunManifest(active, "manifest-1", "completed", { now: LATER });
  assert.throws(
    () => archiveRunManifest(finished, "manifest-1", { now: NOW }),
    /predate its finish/i,
  );
  const impossible = structuredClone(finished);
  impossible.manifests[0].finishedAt = "2026-07-29T11:00:00.000Z";
  assert.deepEqual(
    normalizeRunManifestWorkspace(impossible, { registry, now: LATER }).manifests,
    [],
  );
});

test("normalization is bounded, canonical, strips unknown keys, and idempotent", () => {
  const manifest = create({ execution: { kind: "session", id: "session-1" } }).manifests[0];
  const raw = {
    version: 99,
    unknown: true,
    manifests: Array.from({ length: RUN_MANIFEST_LIMITS.maxManifests + 20 }, (_, index) => ({
      ...manifest,
      id: `manifest-${index}`,
      unknown: "drop",
      entries: manifest.entries.map((entry) => ({ ...entry, order: 99, unknown: true })),
    })),
  };
  const normalized = normalizeRunManifestWorkspace(raw, { registry, now: NOW });
  assert.equal(normalized.version, 1);
  assert.equal(normalized.manifests.length, RUN_MANIFEST_LIMITS.maxManifests);
  assert.equal("unknown" in normalized.manifests[0], false);
  assert.equal("unknown" in normalized.manifests[0].entries[0], false);
  assert.deepEqual(normalized.manifests[0].entries.map((entry) => entry.order), [0, 1]);
  assert.deepEqual(
    normalizeRunManifestWorkspace(structuredClone(normalized), { registry, now: NOW }),
    normalized,
  );
});

test("normalization rejects an over-limit manifest instead of truncating its immutable set", () => {
  const manifest = create({ execution: { kind: "session", id: "session-1" } })
    .manifests[0];
  const oversized = {
    manifests: [
      {
        ...manifest,
        entries: Array.from(
          { length: RUN_MANIFEST_LIMITS.maxEntries + 1 },
          (_, index) => ({
            ...manifest.entries[index % manifest.entries.length],
            itemId: `oversized:${index}`,
            order: index,
          }),
        ),
      },
    ],
  };
  const normalized = normalizeRunManifestWorkspace(oversized, {
    now: NOW,
  });
  assert.deepEqual(normalized.manifests, []);
});

test("normalization preserves stale historical snapshots and marks them ineligible", () => {
  let workspace = startRunManifest(create(), "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  });
  workspace = finishRunManifest(workspace, "manifest-1", "completed", { now: LATER });
  const originalEntries = structuredClone(workspace.manifests[0].entries);
  const revisedRegistry = registry.map((entry) =>
    entry.itemId === "python:2"
      ? { ...entry, title: "Rewritten title", contentRevision: 99, verification: { revision: 99 } }
      : entry,
  );
  const normalized = normalizeRunManifestWorkspace(structuredClone(workspace), {
    registry: revisedRegistry,
    now: LATER,
  });
  assert.equal(normalized.manifests[0].entries[0].title, originalEntries[0].title);
  assert.equal(normalized.manifests[0].entries[0].contentRevision, originalEntries[0].contentRevision);
  assert.equal(normalized.manifests[0].entries[0].currentEvidenceEligible, false);
  assert.equal(normalized.manifests[0].entries[1].currentEvidenceEligible, true);
});

test("an omitted registry preserves prior eligibility and stays idempotent", () => {
  const workspace = create();
  const normalized = normalizeRunManifestWorkspace(structuredClone(workspace));
  assert.equal(normalized.manifests[0].entries[0].currentEvidenceEligible, true);
  assert.deepEqual(normalizeRunManifestWorkspace(structuredClone(normalized)), normalized);

  const manifest = startRunManifest(workspace, "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  }).manifests[0];
  const report = deriveRunManifestReport(manifest, { submissions: [{
    itemId: "python:2",
    itemRevision: 2,
    lifecycle: "settled",
    status: "accepted",
    passed: 2,
    total: 2,
    judge: { revision: 12 },
    context: { sessionId: "session-1" },
  }] });
  assert.equal(report.currentAcceptedCount, 1);
});

test("normalization repairs multiple active records to one without discarding history", () => {
  const active = startRunManifest(create(), "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  }).manifests[0];
  const normalized = normalizeRunManifestWorkspace({
    manifests: [active, { ...active, id: "manifest-2", execution: { kind: "session", id: "session-2" } }],
  }, { registry, now: LATER });
  assert.equal(normalized.manifests.filter((manifest) => manifest.status === "active").length, 1);
  assert.equal(normalized.manifests[1].status, "ended");
  assert.equal(normalized.manifests[1].finishedAt, LATER);
});

test("report counts only evidence linked to this execution and exact frozen revisions", () => {
  let workspace = startRunManifest(create(), "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  });
  const manifest = workspace.manifests[0];
  const evidence = {
    attempts: [
      { id: "a-1", itemId: "python:2", itemRevision: 2, sessionId: "session-1" },
      { id: "unrelated", itemId: "python:1", itemRevision: 1, sessionId: "somewhere-else" },
      { id: "wrong-revision", itemId: "python:1", itemRevision: 999, sessionId: "session-1" },
    ],
    submissions: [
      {
        id: "s-1",
        itemId: "python:2",
        itemRevision: 2,
        lifecycle: "settled",
        status: "accepted",
        passed: 8,
        total: 8,
        judge: { revision: 12 },
        context: { sessionId: "session-1" },
      },
      {
        id: "pending",
        itemId: "python:1",
        itemRevision: 1,
        lifecycle: "pending",
        judge: { revision: 11 },
        context: { sessionId: "session-1" },
      },
    ],
  };
  const report = deriveRunManifestReport(manifest, evidence, registry);
  assert.deepEqual({
    attempted: report.attemptedCount,
    pending: report.pendingCount,
    accepted: report.acceptedCount,
    current: report.currentAcceptedCount,
  }, { attempted: 2, pending: 1, accepted: 1, current: 1 });
  assert.deepEqual(report.entries.map((entry) => entry.status), ["accepted-current", "pending"]);
  assert.equal(report.claimsMastery, false);
  assert.equal("score" in report, false);
});

test("stale or mismatched judge evidence stays visible but cannot count as current acceptance", () => {
  const manifest = startRunManifest(create(), "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  }).manifests[0];
  const submissions = [{
    itemId: "python:2",
    itemRevision: 2,
    lifecycle: "settled",
    status: "accepted",
    passed: 8,
    total: 8,
    judge: { revision: 999 },
    context: { sessionId: "session-1" },
  }];
  const mismatched = deriveRunManifestReport(manifest, { submissions }, registry);
  assert.equal(mismatched.acceptedCount, 1);
  assert.equal(mismatched.currentAcceptedCount, 0);
  assert.equal(mismatched.entries[0].status, "accepted-stale");

  const revised = registry.map((entry) => entry.itemId === "python:2" ? { ...entry, contentRevision: 20 } : entry);
  const stale = deriveRunManifestReport(manifest, { submissions }, revised);
  assert.equal(stale.entries[0].currentEvidenceEligible, false);
  assert.equal(stale.currentAcceptedCount, 0);
});

test("malformed accepted evidence never manufactures acceptance", () => {
  const manifest = startRunManifest(create(), "manifest-1", {
    now: NOW,
    execution: { kind: "session", id: "session-1" },
  }).manifests[0];
  const report = deriveRunManifestReport(manifest, { submissions: [{
    itemId: "python:2",
    itemRevision: 2,
    lifecycle: "settled",
    status: "accepted",
    passed: 0,
    total: 0,
    judge: { revision: 12 },
    context: { sessionId: "session-1" },
  }] }, registry);
  assert.equal(report.acceptedCount, 0);
  assert.equal(report.entries[0].status, "attempted");
});
