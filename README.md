# Swift Ghost

Swift Ghost is a deliberate-practice typing trainer for rusty iOS engineers.
It starts with a complete Swift interview solution in muted “ghost” text, then
fades support through five passes:

1. Full ghost
2. Missing expressions
3. Missing lines
4. Signature and brace skeleton
5. Blank editor

The included set covers common interview patterns such as hash maps, two
pointers, sliding windows, stacks, binary search, intervals, linked lists,
tree BFS, and grid traversal.

## Why it exists

Swift interview content and code-typing products exist separately, but the
combination is missing: a curated Swift problem set, true ghost-code typing,
and support that progressively disappears. This project is intentionally small,
private-by-default, and focused on restoring syntax fluency without mistaking
transcription for mastery.

## Privacy

There are no accounts, analytics, cookies, or network-backed progress records.
Practice progress is stored in the browser’s local storage.

## Development

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Run the production checks with:

```sh
npm test
```

## Content note

Problem names link to their public LeetCode pages. The short summaries,
explanations, and Swift implementations in this repository are original
educational material. `ListNode` and `TreeNode` are supplied by LeetCode for
the corresponding problems.

## License

MIT
