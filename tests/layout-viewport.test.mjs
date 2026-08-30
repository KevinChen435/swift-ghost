import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root layout declares a device-width safe-area viewport", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /import type \{ Metadata, Viewport \} from "next"/);
  assert.match(
    layout,
    /export const viewport: Viewport = \{\s*width: "device-width",\s*initialScale: 1,\s*viewportFit: "cover",\s*\}/,
  );
});
