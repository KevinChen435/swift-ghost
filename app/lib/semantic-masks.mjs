const MASK_STAGES = Object.freeze([2, 3, 4]);

/**
 * Authored semantic masks are intentionally small, closed data. They are
 * local teaching aids, not executable code or judge input.
 */
export const SEMANTIC_MASK_LIMITS = Object.freeze({
  maxCharacters: 20_000,
  maxBytes: 80_000,
});

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizedCode(value) {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trimEnd()
    : "";
}

function keepsLineShape(value, code) {
  if (value.length !== code.length) return false;
  for (let index = 0; index < code.length; index += 1) {
    if ((value[index] === "\n") !== (code[index] === "\n")) return false;
  }
  return true;
}

/** Normalize one mask while keeping editor geometry identical to the source. */
export function normalizeSemanticMask(value, code) {
  const source = normalizedCode(code);
  if (typeof value !== "string") return null;
  const mask = value.replace(/\r\n?/g, "\n");
  if (!mask || mask.length > SEMANTIC_MASK_LIMITS.maxCharacters) return null;
  if (byteLength(mask) > SEMANTIC_MASK_LIMITS.maxBytes) return null;
  return keepsLineShape(mask, source) ? mask : null;
}

/**
 * Import only stage 2/3/4 masks that match the normalized reference exactly.
 * Invalid fields are dropped independently so one malformed import does not
 * discard an otherwise useful custom item.
 */
export function normalizeSemanticMasks(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const masks = {};
  for (const stage of MASK_STAGES) {
    const mask = normalizeSemanticMask(value[stage], code);
    if (mask !== null) masks[stage] = mask;
  }
  return Object.keys(masks).length ? masks : undefined;
}

function maskLine(line) {
  return line.replace(/\S/g, " ");
}

function isStructural(line, language) {
  const trimmed = line.trim();
  if (language === "python")
    return /^(class |def |async def |if |elif |else:|for |while |try:|except |finally:)/.test(
      trimmed,
    );
  return /^(class |struct |func |}|\{)/.test(trimmed) || trimmed.endsWith("{");
}

function semanticStageTwo(line, language) {
  const keywords =
    language === "python"
      ? /\b(?:def|class|if|elif|else|for|while|return|in|not|and|or|None|True|False)\b|(?<=[=\[(, ])\w+(?=[\], ):=+\-])/g
      : /\b(?:var|let|if|else|for|while|return|guard)\b|(?<=[=\[(, ])\w+(?=[\], ):=+\-])/g;
  return line.replace(keywords, (match) => "_".repeat(match.length));
}

/** Generate useful starting masks for a new Swift/iOS recall drill. */
export function generateSemanticMasks(code, language = "swift") {
  const source = normalizedCode(code);
  if (!source) return undefined;
  const lines = source.split("\n");
  const stageTwo = lines
    .map((line) => semanticStageTwo(line, language))
    .join("\n");
  const stageThree = lines
    .map((line, index) =>
      index === 0 || index % 3 === 0 || isStructural(line, language)
        ? line
        : maskLine(line),
    )
    .join("\n");
  const stageFour = lines
    .map((line) =>
      /^(class |def |async def |func |struct )/.test(line.trim())
        ? line
        : maskLine(line),
    )
    .join("\n");
  const masks = { 2: stageTwo, 3: stageThree, 4: stageFour };
  return normalizeSemanticMasks(masks, source);
}

export function semanticMasksEqual(left, right, code) {
  const normalizeRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const record = {};
    for (const stage of MASK_STAGES) {
      if (typeof value[stage] !== "string") continue;
      const mask = value[stage].replace(/\r\n?/g, "\n");
      if (
        mask &&
        mask.length <= SEMANTIC_MASK_LIMITS.maxCharacters &&
        byteLength(mask) <= SEMANTIC_MASK_LIMITS.maxBytes
      )
        record[stage] = mask;
    }
    return record;
  };
  const a = code === undefined ? normalizeRecord(left) : normalizeSemanticMasks(left, code) ?? {};
  const b = code === undefined ? normalizeRecord(right) : normalizeSemanticMasks(right, code) ?? {};
  return MASK_STAGES.every((stage) => a[stage] === b[stage]);
}
