export const TEST_DESIGN_VERSION = 2;
export const TEST_DESIGN_ATTEMPT_LIMIT = 180;
export const TEST_DESIGN_DRAFT_LIMIT = 6;
export const TEST_DESIGN_SPRINT_LIMIT = 3;
export const TEST_DESIGN_INTERVAL_DAYS = [1, 3, 7, 14, 30];
export const TEST_DESIGN_GRADES = ["again", "hard", "good", "easy"];
export const TEST_DESIGN_PURPOSES = [
  "baseline",
  "boundary",
  "adversarial",
  "regression",
];
export const TEST_DESIGN_SOURCES = [
  "academy",
  "today",
  "assessment",
  "weakness",
];
export const TEST_DESIGN_LANES = ["python", "swift", "ios"];
export const TEST_DESIGN_OBSERVATION_KINDS = [
  "value",
  "error",
  "lifetime",
  "event-sequence",
  "state-transition",
  "accessibility-tree",
];

const EPOCH = "1970-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function cleanIso(value, fallback = EPOCH) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}
function cleanText(value, limit = 1200) {
  return typeof value === "string"
    ? Array.from(value.trim()).slice(0, limit).join("")
    : "";
}
function cleanId(value) {
  const text = cleanText(value, 160);
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._:-]{0,158}[a-zA-Z0-9])?$/.test(text)
    ? text
    : "";
}
function bounded(value, fallback, min, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function canonicalTestValue(value) {
  const text = cleanText(value, 4000);
  if (!text) return undefined;
  try {
    return canonicalJson(JSON.parse(text));
  } catch {
    return undefined;
  }
}

function canonicalExpected(value, comparator) {
  const text = cleanText(value, 4000);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    if (
      comparator !== "unorderedNested" &&
      comparator !== "unorderedObjectArrays"
    )
      return canonicalJson(parsed);
    const normalize = (entry) =>
      Array.isArray(entry)
        ? entry
            .map(normalize)
            .sort((left, right) =>
              canonicalJson(left).localeCompare(canonicalJson(right)),
            )
        : entry && typeof entry === "object"
          ? Object.fromEntries(
              Object.entries(entry).map(([key, nested]) => [
                key,
                normalize(nested),
              ]),
            )
          : entry;
    return canonicalJson(normalize(parsed));
  } catch {
    return undefined;
  }
}

function classifyOracle(probe, input, expected) {
  const normalizedInput = canonicalTestValue(input);
  if (!normalizedInput || !canonicalTestValue(expected)) return "unverified";
  const inputMatches = probe.referenceCases.filter(
    (entry) => canonicalTestValue(entry.input) === normalizedInput,
  );
  if (!inputMatches.length) return "unverified";
  return inputMatches.some(
    (entry) =>
      canonicalExpected(entry.expected, entry.comparator) ===
      canonicalExpected(expected, entry.comparator),
  )
    ? "confirmed"
    : "contradicted";
}

function probeRegistry(probes, items) {
  const revisions = new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      item.itemId,
      item.contentRevision,
    ]),
  );
  return new Map(
    (Array.isArray(probes) ? probes : []).flatMap((probe) =>
      revisions.get(probe.itemId) === probe.itemRevision &&
      TEST_DESIGN_LANES.includes(probe.lane)
        ? [[probe.id, probe]]
        : [],
    ),
  );
}

export function createTestDesignWorkspace(now = EPOCH) {
  return {
    version: TEST_DESIGN_VERSION,
    revision: 0,
    updatedAt: cleanIso(now),
    attempts: [],
    drafts: [],
  };
}

export function normalizeTestDesignWorkspace(value, options = {}) {
  const probes = probeRegistry(options.probes, options.items);
  const knownProbes = new Map(
    (Array.isArray(options.probes) ? options.probes : [])
      .filter((probe) => probe?.id && TEST_DESIGN_LANES.includes(probe.lane))
      .map((probe) => [probe.id, probe]),
  );
  if (!isRecord(value) || ![1, TEST_DESIGN_VERSION].includes(value.version))
    return createTestDesignWorkspace(options.now);
  const byId = new Map();
  for (const raw of Array.isArray(value.attempts) ? value.attempts : []) {
    if (!isRecord(raw)) continue;
    const id = cleanId(raw.id),
      sprintId = cleanId(raw.sprintId),
      probeId = cleanId(raw.probeId),
      currentProbe = probes.get(probeId),
      knownProbe = knownProbes.get(probeId),
      probeRevision = bounded(raw.probeRevision, 0, 1, 1_000_000),
      itemId = cleanId(raw.itemId),
      itemRevision = bounded(raw.itemRevision, 0, 1, 1_000_000),
      current = Boolean(
        currentProbe &&
          probeRevision === currentProbe.revision &&
          itemId === currentProbe.itemId &&
          itemRevision === currentProbe.itemRevision,
      ),
      lane = current
        ? currentProbe.lane
        : TEST_DESIGN_LANES.includes(raw.lane)
          ? raw.lane
          : knownProbe?.lane,
      skillId = current ? currentProbe.skillId : cleanId(raw.skillId),
      observationKind = current
        ? currentProbe.observationKind
        : TEST_DESIGN_OBSERVATION_KINDS.includes(raw.observationKind)
          ? raw.observationKind
          : "value",
      staleCompleted = Boolean(
        !current &&
          raw.revealedAt &&
          TEST_DESIGN_GRADES.includes(raw.grade) &&
          raw.completedAt,
      );
    if (
      !id ||
      !sprintId ||
      !probeId ||
      !probeRevision ||
      !itemId ||
      !itemRevision ||
      !lane ||
      !skillId ||
      (!current && !staleCompleted)
    )
      continue;
    const purpose = TEST_DESIGN_PURPOSES.includes(raw.purpose)
      ? raw.purpose
      : undefined;
    const assumption = cleanText(raw.assumption, 800),
      input = cleanText(raw.input, 4000),
      expected = cleanText(raw.expected, 4000),
      defectCaught = cleanText(raw.defectCaught, 1000);
    if (!purpose || !assumption || !input || !expected || !defectCaught)
      continue;
    const committedAt = cleanIso(raw.committedAt),
      revealedAt = raw.revealedAt
        ? cleanIso(raw.revealedAt, committedAt)
        : undefined;
    const grade =
      revealedAt && TEST_DESIGN_GRADES.includes(raw.grade)
        ? raw.grade
        : undefined;
    const completedAt = grade
      ? cleanIso(raw.completedAt, revealedAt)
      : undefined;
    const attempt = {
      id,
      sprintId,
      source: TEST_DESIGN_SOURCES.includes(raw.source) ? raw.source : "academy",
      probeId,
      probeRevision,
      lane,
      itemId,
      itemRevision,
      skillId,
      observationKind,
      executionPolicy: "design-only",
      purpose,
      assumption,
      input,
      expected,
      defectCaught,
      assisted: Boolean(raw.assisted),
      wasDue: Boolean(raw.wasDue),
      purposeMatch: current
        ? purpose === currentProbe.primaryPurpose
        : Boolean(raw.purposeMatch),
      oracleStatus: current
        ? classifyOracle(currentProbe, input, expected)
        : ["confirmed", "contradicted", "unverified"].includes(raw.oracleStatus)
          ? raw.oracleStatus
          : "unverified",
      committedAt,
      ...(revealedAt ? { revealedAt } : {}),
      ...(grade ? { grade } : {}),
      ...(completedAt
        ? {
            completedAt,
            dueAt: cleanIso(raw.dueAt, completedAt),
            levelAfter: bounded(
              raw.levelAfter,
              0,
              0,
              TEST_DESIGN_INTERVAL_DAYS.length,
            ),
            lapseCount: bounded(raw.lapseCount, 0, 0, 1_000_000),
          }
        : {}),
      updatedAt: cleanIso(
        raw.updatedAt,
        completedAt ?? revealedAt ?? committedAt,
      ),
      ...(!current ? { retired: true } : {}),
    };
    const prior = byId.get(id);
    if (!prior || prior.updatedAt <= attempt.updatedAt) byId.set(id, attempt);
  }
  const attempts = [...byId.values()]
    .sort(
      (a, b) =>
        a.committedAt.localeCompare(b.committedAt) || a.id.localeCompare(b.id),
    )
    .slice(-TEST_DESIGN_ATTEMPT_LIMIT);
  const drafts = (Array.isArray(value.drafts) ? value.drafts : [])
    .flatMap((raw) => {
      if (!isRecord(raw)) return [];
      const sprintId = cleanId(raw.sprintId),
        probe = probes.get(raw.probeId);
      if (!sprintId || !probe || Number(raw.probeRevision) !== probe.revision)
        return [];
      return [
        {
          sprintId,
          probeId: probe.id,
          probeRevision: probe.revision,
          purpose: TEST_DESIGN_PURPOSES.includes(raw.purpose)
            ? raw.purpose
            : "",
          assumption: cleanText(raw.assumption, 800),
          input: cleanText(raw.input, 4000),
          expected: cleanText(raw.expected, 4000),
          defectCaught: cleanText(raw.defectCaught, 1000),
          assisted: Boolean(raw.assisted),
          updatedAt: cleanIso(raw.updatedAt, options.now),
        },
      ];
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(-TEST_DESIGN_DRAFT_LIMIT);
  let activeSprint;
  if (isRecord(value.activeSprint)) {
    const raw = value.activeSprint,
      id = cleanId(raw.id),
      rawEntries = Array.isArray(raw.entries) ? raw.entries : [],
      seen = new Set();
    const entries = rawEntries
      .flatMap((entry) => {
        const probe = isRecord(entry) ? probes.get(entry.probeId) : undefined;
        if (
          !probe ||
          seen.has(probe.id) ||
          Number(entry.probeRevision) !== probe.revision
        )
          return [];
        seen.add(probe.id);
        return [{ probeId: probe.id, probeRevision: probe.revision }];
      })
      .slice(0, TEST_DESIGN_SPRINT_LIMIT);
    const entryLanes = new Set(
      entries.map((entry) => probes.get(entry.probeId)?.lane).filter(Boolean),
    );
    const lane =
      TEST_DESIGN_LANES.includes(raw.lane) && entryLanes.has(raw.lane)
        ? raw.lane
        : entryLanes.size === 1
          ? [...entryLanes][0]
          : undefined;
    if (
      id &&
      lane &&
      rawEntries.length > 0 &&
      rawEntries.length <= TEST_DESIGN_SPRINT_LIMIT &&
      entries.length === rawEntries.length
    ) {
      const cursor = bounded(raw.cursor, 0, 0, entries.length),
        completed = raw.status === "completed" || cursor >= entries.length;
      activeSprint = {
        id,
        lane,
        source: TEST_DESIGN_SOURCES.includes(raw.source)
          ? raw.source
          : "academy",
        entries,
        cursor: completed ? entries.length : cursor,
        status: completed ? "completed" : "active",
        startedAt: cleanIso(raw.startedAt, options.now),
        ...(completed
          ? { completedAt: cleanIso(raw.completedAt, raw.updatedAt) }
          : {}),
        updatedAt: cleanIso(raw.updatedAt, options.now),
      };
    }
  }
  const activeProbeIds = new Set(
    activeSprint?.status === "active"
      ? activeSprint.entries.map((entry) => entry.probeId)
      : [],
  );
  const activeDrafts = activeSprint?.status === "active"
    ? drafts.filter(
        (draft) =>
          draft.sprintId === activeSprint.id &&
          activeProbeIds.has(draft.probeId),
      )
    : [];
  return {
    version: TEST_DESIGN_VERSION,
    revision: bounded(value.revision, 0, 0, 1_000_000),
    updatedAt: cleanIso(value.updatedAt, options.now),
    attempts,
    drafts: activeDrafts,
    ...(activeSprint ? { activeSprint } : {}),
  };
}

function mutable(workspace, options = {}) {
  return normalizeTestDesignWorkspace(workspace, options);
}
function currentEntry(workspace) {
  const sprint = workspace.activeSprint;
  return sprint?.status === "active"
    ? sprint.entries[sprint.cursor]
    : undefined;
}
function completedForSkill(workspace, lane, skillId, excludedId) {
  return workspace.attempts
    .filter(
      (entry) =>
        entry.lane === lane &&
        entry.skillId === skillId &&
        !entry.retired &&
        entry.completedAt &&
        entry.id !== excludedId,
    )
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function deriveTestDesignState(
  skillId,
  workspace,
  probes,
  options = {},
) {
  const lane = TEST_DESIGN_LANES.includes(options.lane)
    ? options.lane
    : [...new Set(
        (Array.isArray(probes) ? probes : [])
          .filter((probe) => probe.skillId === skillId)
          .map((probe) => probe.lane),
      )].length === 1
      ? probes.find((probe) => probe.skillId === skillId)?.lane
      : undefined;
  const valid = new Map(
    (Array.isArray(probes) ? probes : []).map((probe) => [
      probe.id,
      probe.revision,
    ]),
  );
  const completed = workspace.attempts.filter(
    (attempt) =>
      attempt.skillId === skillId &&
      (!lane || attempt.lane === lane) &&
      !attempt.retired &&
      attempt.completedAt &&
      valid.get(attempt.probeId) === attempt.probeRevision,
  );
  const latest = completed.at(-1),
    dueAt = latest?.dueAt,
    due = !latest || Date.parse(dueAt) <= Date.parse(cleanIso(options.now));
  const retainedProbeCount = new Set(
    completed
      .filter(
        (entry) =>
          entry.wasDue &&
          !entry.assisted &&
          entry.purposeMatch &&
          entry.oracleStatus === "confirmed" &&
          (entry.grade === "good" || entry.grade === "easy"),
      )
      .map((entry) => entry.probeId),
  ).size;
  return {
    skillId,
    level: latest?.levelAfter ?? 0,
    lapseCount: latest?.lapseCount ?? 0,
    dueAt,
    due,
    isNew: !latest,
    retained: retainedProbeCount >= 2,
    retainedProbeCount,
    completedAttempts: completed.length,
    lastAttemptAt: latest?.completedAt,
  };
}

export function deriveTestDesignOverview(probes, workspace, options = {}) {
  const eligible = TEST_DESIGN_LANES.includes(options.lane)
    ? probes.filter((probe) => probe.lane === options.lane)
    : probes;
  const skills = [...new Set(eligible.map((probe) => probe.skillId))];
  const states = skills.map((skillId) =>
    deriveTestDesignState(skillId, workspace, eligible, options),
  );
  return {
    newCount: states.filter((s) => s.isNew).length,
    dueCount: states.filter((s) => !s.isNew && s.due).length,
    readyCount: states.filter((s) => s.due).length,
    retainedCount: states.filter((s) => s.retained).length,
    totalSkills: states.length,
    states,
  };
}

export function selectTestDesignProbes(probes, workspace, options = {}) {
  const count = bounded(options.count, 3, 1, TEST_DESIGN_SPRINT_LIMIT),
    attempts = workspace.attempts ?? [],
    eligible = TEST_DESIGN_LANES.includes(options.lane)
      ? probes.filter((probe) => probe.lane === options.lane)
      : probes;
  const skills = [...new Set(eligible.map((probe) => probe.skillId))]
    .map((skillId) => ({
      skillId,
      state: deriveTestDesignState(skillId, workspace, probes, options),
    }))
    .sort(
      (a, b) =>
        Number(b.state.due) - Number(a.state.due) ||
        (a.state.dueAt ?? EPOCH).localeCompare(b.state.dueAt ?? EPOCH) ||
        a.skillId.localeCompare(b.skillId),
    );
  return skills.slice(0, count).flatMap(({ skillId }) => {
    const candidates = eligible.filter((probe) => probe.skillId === skillId),
      history = attempts
        .filter(
          (attempt) =>
            !attempt.retired &&
            attempt.skillId === skillId &&
            (!options.lane || attempt.lane === options.lane),
        )
        .sort((a, b) => a.committedAt.localeCompare(b.committedAt)),
      last = history.at(-1)?.probeId;
    return candidates
      .sort(
        (a, b) =>
          Number(a.id === last) - Number(b.id === last) ||
          history.filter((x) => x.probeId === a.id).length -
            history.filter((x) => x.probeId === b.id).length ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 1);
  });
}

export function startTestDesignSprint(workspace, probes, items, options = {}) {
  const normalized = mutable(workspace, { probes, items, now: options.now });
  if (normalized.activeSprint?.status === "active") return normalized;
  const id = cleanId(options.id),
    lane = TEST_DESIGN_LANES.includes(options.lane) ? options.lane : "python",
    selected = selectTestDesignProbes(
      probes.filter((probe) =>
        items.some(
          (item) =>
            item.itemId === probe.itemId &&
            item.contentRevision === probe.itemRevision,
        ),
      ),
      normalized,
      { ...options, lane },
    );
  if (!id || !selected.length) return normalized;
  const now = cleanIso(options.now);
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    drafts: [],
    activeSprint: {
      id,
      lane,
      source: TEST_DESIGN_SOURCES.includes(options.source)
        ? options.source
        : "academy",
      entries: selected.map((probe) => ({
        probeId: probe.id,
        probeRevision: probe.revision,
      })),
      cursor: 0,
      status: "active",
      startedAt: now,
      updatedAt: now,
    },
  };
}

export function saveTestDesignDraft(workspace, probe, input, options = {}) {
  const normalized = mutable(workspace, {
      probes: options.probes,
      items: options.items,
      now: options.now,
    }),
    current = currentEntry(normalized);
  if (
    !current ||
    current.probeId !== probe.id ||
    current.probeRevision !== probe.revision
  )
    return normalized;
  const now = cleanIso(options.now),
    draft = {
      sprintId: normalized.activeSprint.id,
      probeId: probe.id,
      probeRevision: probe.revision,
      purpose: TEST_DESIGN_PURPOSES.includes(input.purpose)
        ? input.purpose
        : "",
      assumption: cleanText(input.assumption, 800),
      input: cleanText(input.input, 4000),
      expected: cleanText(input.expected, 4000),
      defectCaught: cleanText(input.defectCaught, 1000),
      assisted: Boolean(input.assisted),
      updatedAt: now,
    };
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    drafts: [
      ...normalized.drafts.filter(
        (entry) =>
          !(
            entry.sprintId === draft.sprintId && entry.probeId === draft.probeId
          ),
      ),
      draft,
    ].slice(-TEST_DESIGN_DRAFT_LIMIT),
  };
}

export function commitTestDesignAttempt(workspace, probe, input, options = {}) {
  const normalized = mutable(workspace, {
      probes: options.probes,
      items: options.items,
      now: options.now,
    }),
    current = currentEntry(normalized),
    id = cleanId(options.id),
    purpose = TEST_DESIGN_PURPOSES.includes(input.purpose)
      ? input.purpose
      : undefined,
    assumption = cleanText(input.assumption, 800),
    rawInput = cleanText(input.input, 4000),
    expected = cleanText(input.expected, 4000),
    defectCaught = cleanText(input.defectCaught, 1000);
  if (
    !id ||
    !current ||
    current.probeId !== probe.id ||
    current.probeRevision !== probe.revision ||
    !purpose ||
    !assumption ||
    !rawInput ||
    !expected ||
    !defectCaught ||
    normalized.attempts.some(
      (a) =>
        a.sprintId === normalized.activeSprint.id &&
        a.probeId === probe.id &&
        !a.completedAt,
    )
  )
    return normalized;
  const now = cleanIso(options.now),
    prior = completedForSkill(normalized, probe.lane, probe.skillId).at(-1),
    wasDue = Boolean(
      prior?.dueAt && Date.parse(prior.dueAt) <= Date.parse(now),
    );
  const attempt = {
    id,
    sprintId: normalized.activeSprint.id,
    source: normalized.activeSprint.source,
    probeId: probe.id,
    probeRevision: probe.revision,
    lane: probe.lane,
    itemId: probe.itemId,
    itemRevision: probe.itemRevision,
    skillId: probe.skillId,
    observationKind: probe.observationKind,
    executionPolicy: "design-only",
    purpose,
    assumption,
    input: rawInput,
    expected,
    defectCaught,
    assisted: Boolean(input.assisted),
    wasDue,
    purposeMatch: purpose === probe.primaryPurpose,
    oracleStatus: classifyOracle(probe, rawInput, expected),
    committedAt: now,
    updatedAt: now,
  };
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    attempts: [...normalized.attempts, attempt].slice(
      -TEST_DESIGN_ATTEMPT_LIMIT,
    ),
    drafts: normalized.drafts.filter(
      (d) =>
        !(d.sprintId === attempt.sprintId && d.probeId === attempt.probeId),
    ),
  };
}

export function revealTestDesignAttempt(workspace, attemptId, options = {}) {
  const normalized = mutable(workspace, options),
    current = currentEntry(normalized),
    index = normalized.attempts.findIndex((a) => a.id === attemptId),
    existing = normalized.attempts[index];
  if (
    !existing ||
    existing.revealedAt ||
    existing.completedAt ||
    !current ||
    existing.sprintId !== normalized.activeSprint.id ||
    existing.probeId !== current.probeId
  )
    return normalized;
  const now = cleanIso(options.now),
    attempts = [...normalized.attempts];
  attempts[index] = { ...existing, revealedAt: now, updatedAt: now };
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    attempts,
  };
}

export function gradeTestDesignAttempt(
  workspace,
  attemptId,
  grade,
  options = {},
) {
  if (!TEST_DESIGN_GRADES.includes(grade)) return workspace;
  const normalized = mutable(workspace, options),
    current = currentEntry(normalized),
    index = normalized.attempts.findIndex((a) => a.id === attemptId),
    existing = normalized.attempts[index];
  if (
    !existing?.revealedAt ||
    existing.completedAt ||
    !current ||
    existing.sprintId !== normalized.activeSprint.id ||
    existing.probeId !== current.probeId
  )
    return normalized;
  const now = cleanIso(options.now),
    prior = completedForSkill(
      normalized,
      existing.lane,
      existing.skillId,
      existing.id,
    ).at(-1),
    priorLevel = prior?.levelAfter ?? 0,
    strong = grade === "good" || grade === "easy",
    qualifies =
      !existing.assisted &&
      existing.purposeMatch &&
      existing.oracleStatus === "confirmed" &&
      strong;
  let levelAfter = priorLevel,
    lapseCount = prior?.lapseCount ?? 0,
    dueAt;
  if (existing.wasDue && qualifies) {
    const interval =
      TEST_DESIGN_INTERVAL_DAYS[
        Math.min(priorLevel, TEST_DESIGN_INTERVAL_DAYS.length - 1)
      ];
    levelAfter = Math.min(TEST_DESIGN_INTERVAL_DAYS.length, priorLevel + 1);
    dueAt = new Date(Date.parse(now) + interval * DAY_MS).toISOString();
  } else if (!existing.wasDue && qualifies && prior?.dueAt)
    dueAt = cleanIso(prior.dueAt, now);
  else {
    levelAfter = Math.max(0, priorLevel - 1);
    if (
      grade === "again" ||
      !existing.purposeMatch ||
      existing.oracleStatus === "contradicted"
    )
      lapseCount += 1;
    dueAt = new Date(Date.parse(now) + DAY_MS).toISOString();
  }
  const attempts = [...normalized.attempts];
  attempts[index] = {
    ...existing,
    grade,
    completedAt: now,
    dueAt,
    levelAfter,
    lapseCount,
    updatedAt: now,
  };
  const cursor = normalized.activeSprint.cursor + 1,
    completed = cursor >= normalized.activeSprint.entries.length;
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    attempts,
    activeSprint: {
      ...normalized.activeSprint,
      cursor,
      status: completed ? "completed" : "active",
      ...(completed ? { completedAt: now } : {}),
      updatedAt: now,
    },
  };
}
