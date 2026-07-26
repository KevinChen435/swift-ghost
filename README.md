# Swift Ghost

[Swift Ghost](https://kevinchen435.github.io/swift-ghost/) is a deliberate-practice trainer for rebuilding Swift interview fluency. You type an original Swift solution while its ghost text progressively fades through five passes:

1. Full ghost
2. Missing expressions
3. Missing lines
4. Signature and brace skeleton
5. Blank-editor recall

Transcription is treated as syntax practice, not algorithmic mastery. Pattern cues and invariants sit beside the editor, and the final stage asks you to reconstruct the solution independently.

## Current feature set

- 50 original Swift implementations across 12 interview patterns
- A Today dashboard with a deterministic Daily Type, due recall, and resumable drafts
- Searchable, filterable, sortable problem library
- Strict and free-correction typing modes with selection-aware character feedback
- WPM, raw keystrokes, accuracy, corrections, peeks, timing, and consistency records
- Five-stage per-problem recall ladder with honest mastery and qualified personal bests
- Local attempt history, streaks, daily goals, pattern coverage, and progress charts
- Spaced review at 1, 3, 7, 14, and 30 days, with lapses returning tomorrow
- Device-local custom Swift snippets and learning milestones
- Favorites, random practice, focus mode, autosaved drafts, and JSON backup/restore
- Six themes, three code fonts, editor sizing, indentation, and an optional key-friction heatmap
- Responsive desktop and mobile layouts

## Why it exists

Swift interview content and code-typing products usually exist separately. Swift Ghost combines a curated Swift curriculum with ghost-code typing and progressively removes support. It is designed for engineers who understand programming but need to restore syntax fluency and reliable recall.

## Privacy

There are no accounts, analytics, cookies, or network-backed progress records. Practice history and settings stay in the browser's local storage. A portable JSON export is available in Settings.

## Development

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Run both validation paths before publishing:

```sh
npm run lint
npm test
npm run build:pages
```

## Content note

Problem names link to their public LeetCode pages. The pattern cues, invariants, Swift notes, and implementations in this repository are original educational material. `ListNode` and `TreeNode` are supplied by LeetCode for corresponding problems. Swift Ghost is not affiliated with or endorsed by LeetCode.

## Roadmap

The local-first training core is the priority. Planned work includes a larger 75-problem catalog, authored semantic masks, executable Swift test cases, session queues, editable custom snippets, optional account sync, and privacy-preserving community benchmarks.

## License

MIT
