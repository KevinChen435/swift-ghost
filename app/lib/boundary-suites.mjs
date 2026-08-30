const MAX_SUITES = 12;
const MAX_PACKS_PER_SUITE = 3;
const MAX_CASES_PER_PACK = 4;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function currentContract(item) {
  if (!isRecord(item) || item.language !== "python" || !isRecord(item.verification))
    return null;
  const itemId = typeof item.itemId === "string" ? item.itemId : "";
  const contentRevision = Number.isInteger(item.contentRevision)
    ? item.contentRevision
    : null;
  const verificationRevision = Number.isInteger(item.verification.revision)
    ? item.verification.revision
    : 1;
  const cases = Array.isArray(item.verification.cases)
    ? item.verification.cases
    : [];
  if (!itemId || !contentRevision || !isRecord(item.verification.entrypoint))
    return null;
  return { itemId, contentRevision, verificationRevision, cases };
}

export function validateBoundaryDrillRegistry(registry) {
  if (!Array.isArray(registry) || registry.length > MAX_SUITES)
    throw new Error(`Boundary drill registry supports at most ${MAX_SUITES} suites.`);
  const suiteIds = new Set();
  for (const suite of registry) {
    if (!isRecord(suite) || typeof suite.itemId !== "string" || suiteIds.has(suite.itemId))
      throw new Error("Boundary drill suites need unique item ids.");
    suiteIds.add(suite.itemId);
    if (
      !Number.isInteger(suite.contentRevision) ||
      !Number.isInteger(suite.verificationRevision) ||
      !Array.isArray(suite.packs) ||
      suite.packs.length < 1 ||
      suite.packs.length > MAX_PACKS_PER_SUITE
    ) throw new Error(`${suite.itemId} has an invalid boundary drill contract.`);
    const packIds = new Set();
    for (const pack of suite.packs) {
      if (
        !isRecord(pack) ||
        typeof pack.id !== "string" ||
        packIds.has(pack.id) ||
        ![pack.title, pack.purpose, pack.kind, pack.rationale].every(
          (value) => typeof value === "string" && value.trim().length > 0,
        ) ||
        !Array.isArray(pack.caseIds) ||
        pack.caseIds.length < 1 ||
        pack.caseIds.length > MAX_CASES_PER_PACK ||
        new Set(pack.caseIds).size !== pack.caseIds.length ||
        pack.caseIds.some((caseId) => typeof caseId !== "string" || !caseId)
      ) throw new Error(`${suite.itemId} has an invalid boundary drill pack.`);
      packIds.add(pack.id);
    }
  }
  return registry;
}

export function resolveBoundaryDrillSuite(item, registry) {
  const contract = currentContract(item);
  if (!contract) return null;
  const suites = validateBoundaryDrillRegistry(registry);
  const descriptor = suites.find((suite) => suite.itemId === contract.itemId);
  if (
    !descriptor ||
    descriptor.contentRevision !== contract.contentRevision ||
    descriptor.verificationRevision !== contract.verificationRevision
  ) return null;
  const casesById = new Map(
    contract.cases.flatMap((testCase) =>
      isRecord(testCase) && typeof testCase.id === "string"
        ? [[testCase.id, testCase]]
        : [],
    ),
  );
  const packs = descriptor.packs.map((pack) => ({
    ...pack,
    cases: pack.caseIds.map((caseId) => casesById.get(caseId)).filter(Boolean),
  }));
  if (packs.some((pack, index) => pack.cases.length !== descriptor.packs[index].caseIds.length))
    return null;
  return Object.freeze({
    itemId: descriptor.itemId,
    contentRevision: descriptor.contentRevision,
    verificationRevision: descriptor.verificationRevision,
    packs: Object.freeze(packs),
  });
}

export function buildBoundaryDrillVerification(item, suite, packId, caseId) {
  const contract = currentContract(item);
  if (
    !contract ||
    !suite ||
    suite.itemId !== contract.itemId ||
    suite.contentRevision !== contract.contentRevision ||
    suite.verificationRevision !== contract.verificationRevision
  ) throw new Error("Boundary drill pack does not match this problem revision.");
  const pack = suite.packs.find((candidate) => candidate.id === packId);
  if (!pack) throw new Error("Boundary drill pack is unavailable.");
  const cases = caseId
    ? pack.cases.filter((testCase) => testCase.id === caseId)
    : [...pack.cases];
  if (cases.length < 1 || (caseId && cases.length !== 1))
    throw new Error("Boundary drill case is unavailable.");
  return {
    pack,
    caseIds: cases.map((testCase) => testCase.id),
    expectedValues: cases.map((testCase) => testCase.expected),
    verification: {
      revision: contract.verificationRevision,
      entrypoint: item.verification.entrypoint,
      cases,
    },
  };
}

export const BOUNDARY_DRILL_LIMITS = Object.freeze({
  maxSuites: MAX_SUITES,
  maxPacksPerSuite: MAX_PACKS_PER_SUITE,
  maxCasesPerPack: MAX_CASES_PER_PACK,
});

