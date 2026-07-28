import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRoute,
  resolveRouteItem,
  routeForItem,
  serializeRoute,
} from "../app/lib/routes.mjs";

test("study plans have a first-class reload-safe route", () => {
  const route = parseRoute("/?view=plans");
  assert.equal(route.view, "plans");
  assert.equal(
    serializeRoute(route, "https://example.test/swift-ghost/"),
    "/swift-ghost/?view=plans",
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
