/**
 * Describe one text edit without assuming the caret is at the end.
 * The unchanged prefix/suffix model handles insertion, deletion, selection
 * replacement, undo, and mobile IME replacement as one coherent operation.
 */
export function analyzeEdit(previous, proposed, target) {
  let prefix = 0;
  while (prefix < previous.length && prefix < proposed.length && previous[prefix] === proposed[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < proposed.length - prefix &&
    previous[previous.length - 1 - suffix] === proposed[proposed.length - 1 - suffix]
  ) suffix += 1;

  const removed = previous.slice(prefix, previous.length - suffix);
  const inserted = proposed.slice(prefix, proposed.length - suffix);
  let correctInserted = 0;
  for (let index = 0; index < inserted.length; index += 1) {
    if (inserted[index] === target[prefix + index]) correctInserted += 1;
  }

  return {
    prefix,
    removed,
    inserted,
    deletedCount: removed.length,
    insertedCount: inserted.length,
    correctInserted,
    incorrectInserted: inserted.length - correctInserted,
  };
}

export function correctPositionCount(value, target) {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === target[index]) count += 1;
  }
  return count;
}
