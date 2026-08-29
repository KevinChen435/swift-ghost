import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorSource = readFile(
  new URL("../app/components/SolveCodeEditor.tsx", import.meta.url),
  "utf8",
);

test("SolveCodeEditor provides a real Swift syntax extension", async () => {
  const source = await editorSource;

  assert.match(source, /StreamLanguage\.define<SwiftStreamState>/);
  assert.match(source, /name: "swift"/);
  assert.match(source, /swiftSyntax\.extension/);
  assert.match(source, /blockCommentDepth/);
  assert.match(source, /stringDelimiter/);
  assert.match(source, /SWIFT_KEYWORDS/);
  assert.match(source, /SWIFT_TYPES/);
  assert.match(source, /SWIFT_BUILTINS/);
  assert.doesNotMatch(source, /language === "swift" \? \[\]/);
});

test("SolveCodeEditor keeps Python dynamic loading and highlighting intact", async () => {
  const source = await editorSource;

  assert.match(source, /import\("@codemirror\/lang-python"\)/);
  assert.match(source, /initialProps\.language === "swift"[\s\S]*?python\.python\(\)/);
  assert.match(source, /configuration\.language === "swift"[\s\S]*?python\.python\(\)/);
  assert.match(source, /completionExtension\(\s*initialProps\.isMock,\s*initialProps\.language/);
});
