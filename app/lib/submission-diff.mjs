const MAX_LCS_CELLS = 100_000;
const MAX_RENDER_ROWS = 600;
const CONTEXT_LINES = 3;

function parseSource(source) {
  if (typeof source !== "string") {
    throw new TypeError("Submission diff sources must be strings.");
  }

  // A CR that belongs to CRLF is a line-ending detail, not source content.
  // Lone CR characters remain part of the line and therefore compare normally.
  const normalized = source.replace(/\r\n/g, "\n");
  const hasFinalNewline = normalized.endsWith("\n");
  const lines = normalized === "" ? [] : normalized.split("\n");
  if (hasFinalNewline) lines.pop();
  return { lines, hasFinalNewline };
}

function makeRow(type, text, submittedLine, currentLine) {
  return { type, text, submittedLine, currentLine };
}

function makeOmittedRow(count, reason) {
  return {
    type: "omitted",
    text:
      reason === "context"
        ? `${count} unchanged ${count === 1 ? "line" : "lines"} omitted`
        : `${count} diff ${count === 1 ? "row" : "rows"} omitted`,
    submittedLine: null,
    currentLine: null,
    omitted: count,
    reason,
  };
}

function commonEdgeLengths(submittedLines, currentLines) {
  const sharedLimit = Math.min(submittedLines.length, currentLines.length);
  let prefix = 0;
  while (
    prefix < sharedLimit &&
    submittedLines[prefix] === currentLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < sharedLimit - prefix &&
    submittedLines[submittedLines.length - 1 - suffix] ===
      currentLines[currentLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return { prefix, suffix };
}

function lcsMiddleOperations(submittedLines, currentLines) {
  const submittedCount = submittedLines.length;
  const currentCount = currentLines.length;
  const stride = currentCount + 1;
  const lengths = new Uint32Array((submittedCount + 1) * stride);

  for (let submittedIndex = submittedCount - 1; submittedIndex >= 0; submittedIndex -= 1) {
    const rowOffset = submittedIndex * stride;
    const nextRowOffset = rowOffset + stride;
    for (let currentIndex = currentCount - 1; currentIndex >= 0; currentIndex -= 1) {
      lengths[rowOffset + currentIndex] =
        submittedLines[submittedIndex] === currentLines[currentIndex]
          ? lengths[nextRowOffset + currentIndex + 1] + 1
          : Math.max(
              lengths[nextRowOffset + currentIndex],
              lengths[rowOffset + currentIndex + 1],
            );
    }
  }

  const operations = [];
  let submittedIndex = 0;
  let currentIndex = 0;
  while (submittedIndex < submittedCount && currentIndex < currentCount) {
    if (submittedLines[submittedIndex] === currentLines[currentIndex]) {
      operations.push({ type: "context", text: submittedLines[submittedIndex] });
      submittedIndex += 1;
      currentIndex += 1;
      continue;
    }

    const removeScore = lengths[(submittedIndex + 1) * stride + currentIndex];
    const addScore = lengths[submittedIndex * stride + currentIndex + 1];
    if (removeScore >= addScore) {
      // Removing first on a tie makes repeated-line diffs stable across runs.
      operations.push({ type: "remove", text: submittedLines[submittedIndex] });
      submittedIndex += 1;
    } else {
      operations.push({ type: "add", text: currentLines[currentIndex] });
      currentIndex += 1;
    }
  }
  while (submittedIndex < submittedCount) {
    operations.push({ type: "remove", text: submittedLines[submittedIndex] });
    submittedIndex += 1;
  }
  while (currentIndex < currentCount) {
    operations.push({ type: "add", text: currentLines[currentIndex] });
    currentIndex += 1;
  }
  return operations;
}

function changedMiddleOperations(submittedLines, currentLines, useLcs) {
  if (useLcs) return lcsMiddleOperations(submittedLines, currentLines);
  return [
    ...submittedLines.map((text) => ({ type: "remove", text })),
    ...currentLines.map((text) => ({ type: "add", text })),
  ];
}

function numberOperations(operations) {
  let submittedLine = 1;
  let currentLine = 1;
  return operations.map((operation) => {
    if (operation.type === "context") {
      const row = makeRow("context", operation.text, submittedLine, currentLine);
      submittedLine += 1;
      currentLine += 1;
      return row;
    }
    if (operation.type === "remove") {
      const row = makeRow("remove", operation.text, submittedLine, null);
      submittedLine += 1;
      return row;
    }
    const row = makeRow("add", operation.text, null, currentLine);
    currentLine += 1;
    return row;
  });
}

function collapseContext(rows) {
  const firstChange = rows.findIndex((row) => row.type !== "context");
  if (firstChange === -1) return [];

  let lastChange = rows.length - 1;
  while (rows[lastChange]?.type === "context") lastChange -= 1;

  const compact = [];
  let index = 0;
  while (index < rows.length) {
    if (rows[index].type !== "context") {
      compact.push(rows[index]);
      index += 1;
      continue;
    }

    const runStart = index;
    while (index < rows.length && rows[index].type === "context") index += 1;
    const runEnd = index;
    const runLength = runEnd - runStart;
    const beforeFirstChange = runEnd <= firstChange;
    const afterLastChange = runStart > lastChange;

    if (beforeFirstChange) {
      const shownStart = Math.max(runStart, runEnd - CONTEXT_LINES);
      if (shownStart > runStart) {
        compact.push(makeOmittedRow(shownStart - runStart, "context"));
      }
      compact.push(...rows.slice(shownStart, runEnd));
      continue;
    }

    if (afterLastChange) {
      const shownEnd = Math.min(runEnd, runStart + CONTEXT_LINES);
      compact.push(...rows.slice(runStart, shownEnd));
      if (shownEnd < runEnd) {
        compact.push(makeOmittedRow(runEnd - shownEnd, "context"));
      }
      continue;
    }

    if (runLength <= CONTEXT_LINES * 2) {
      compact.push(...rows.slice(runStart, runEnd));
    } else {
      compact.push(...rows.slice(runStart, runStart + CONTEXT_LINES));
      compact.push(makeOmittedRow(runLength - CONTEXT_LINES * 2, "context"));
      compact.push(...rows.slice(runEnd - CONTEXT_LINES, runEnd));
    }
  }
  return compact;
}

function rowWeight(row) {
  return row.type === "omitted" ? row.omitted : 1;
}

function capRows(rows) {
  if (rows.length <= MAX_RENDER_ROWS) {
    return { rows, truncated: false };
  }

  const headCount = Math.floor((MAX_RENDER_ROWS - 1) / 2);
  const tailCount = MAX_RENDER_ROWS - headCount - 1;
  const omittedCount = rows
    .slice(headCount, rows.length - tailCount)
    .reduce((total, row) => total + rowWeight(row), 0);
  return {
    rows: [
      ...rows.slice(0, headCount),
      makeOmittedRow(omittedCount, "render-cap"),
      ...rows.slice(rows.length - tailCount),
    ],
    truncated: true,
  };
}

export function buildSubmissionDiff(submittedSource, currentSource) {
  const submitted = parseSource(submittedSource);
  const current = parseSource(currentSource);
  const { prefix, suffix } = commonEdgeLengths(submitted.lines, current.lines);
  const submittedMiddle = submitted.lines.slice(
    prefix,
    submitted.lines.length - suffix,
  );
  const currentMiddle = current.lines.slice(prefix, current.lines.length - suffix);
  const lcsCells = submittedMiddle.length * currentMiddle.length;
  const useLcs = lcsCells <= MAX_LCS_CELLS;

  const operations = [
    ...submitted.lines.slice(0, prefix).map((text) => ({ type: "context", text })),
    ...changedMiddleOperations(submittedMiddle, currentMiddle, useLcs),
    ...submitted.lines
      .slice(submitted.lines.length - suffix)
      .map((text) => ({ type: "context", text })),
  ];
  const numberedRows = numberOperations(operations);
  const summary = numberedRows.reduce(
    (totals, row) => {
      if (row.type === "add") totals.added += 1;
      else if (row.type === "remove") totals.removed += 1;
      else totals.unchanged += 1;
      return totals;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );
  const finalNewline = {
    submitted: submitted.hasFinalNewline,
    current: current.hasFinalNewline,
    changed: submitted.hasFinalNewline !== current.hasFinalNewline,
  };
  const hasLineChanges = summary.added > 0 || summary.removed > 0;
  const compactRows = collapseContext(numberedRows);
  const capped = capRows(compactRows);

  return {
    rows: capped.rows,
    summary,
    finalNewline,
    identical: !hasLineChanges && !finalNewline.changed,
    algorithm: useLcs ? "lcs" : "fallback",
    lcsCells,
    truncated: capped.truncated,
  };
}

export const SUBMISSION_DIFF_LIMITS = Object.freeze({
  maxLcsCells: MAX_LCS_CELLS,
  maxRenderRows: MAX_RENDER_ROWS,
  contextLines: CONTEXT_LINES,
});
