# Swift Ghost

[Swift Ghost](https://kevinchen435.github.io/swift-ghost/) is a deliberate-practice trainer for rebuilding Python interview fluency while keeping Swift and iOS engineering fundamentals sharp. You type an original solution while its ghost text progressively fades through five passes:

1. Full ghost
2. Missing expressions
3. Missing lines
4. Signature and brace skeleton
5. Blank-editor recall

Transcription is treated as syntax practice, not algorithmic mastery. Pattern cues and invariants sit beside the editor, and the final stage asks you to reconstruct the solution independently.

## Current feature set

- 48 Python exercises: 8 language-fluency drills and 40 interview problems, including advanced Trie, Union-Find, graph, bit-manipulation, and 2D dynamic-programming work
- 50 original Swift implementations across 12 interview patterns
- 16 iOS and Swift fundamentals covering language semantics, concurrency, UIKit, SwiftUI, networking, testing, and accessibility
- A first-class Swift/iOS Concept Recall lane: answer privately, commit before reveal, compare against 48 authored reference answers, optionally type over the grey answer, then self-grade without automated semantic scoring
- A Today dashboard with a deterministic Daily Type, Python and iOS reactivation exercises, due recall, and resumable drafts
- An Adaptive Daily Coach that builds deterministic 15-, 30-, or 45-minute plans from overdue work, missing evidence, Python fluency, independent solves, and iOS maintenance
- Searchable, filterable, sortable problem library
- Strict and free-correction typing modes with selection-aware character feedback
- WPM, raw keystrokes, accuracy, corrections, peeks, timing, and consistency records
- Per-attempt pace timelines, line-level error forensics, and three-pass weak-line repair drills
- Real browser-side Python checks for every built-in Python solution, isolated in a fresh Web Worker with a pinned, self-hosted runtime and a catalog-wide 48/48 compatibility test
- A first-class Python Solve lane with a lazily loaded CodeMirror editor, Python syntax highlighting, indentation, bracket tools, search, history, practice-only fluency completions, source-bound verification, and solve evidence kept separate from typing records
- Five-stage per-problem recall ladder with honest mastery and qualified personal bests
- Post-attempt pace charts, missed-line forensics, same-stage retries, and exact item/revision/stage community benchmark previews
- Optional 30-second learning debriefs that record retrieval difficulty, cognitive friction, confidence, and an authored teach-back response; these stay local and feed the next Daily Coach plan
- A 30-day readiness evidence view that keeps hint-free verified solves, retrieval quality, debrief coverage, recurring friction, practice mix, and review burden separate instead of collapsing them into a misleading score
- Local attempt history, streaks, daily goals, pattern coverage, and progress charts
- Spaced review at 1, 3, 7, 14, and 30 days, with lapses returning tomorrow
- Device-local custom Python or Swift snippets with safe content revisions and learning milestones
- Persistent multi-problem sessions with independent track, source, category, difficulty, count, and recall-policy controls, plus mixed typing, concept-recall, and verified-solve tasks from the Daily Coach
- Reload-safe 30-, 45-, and 60-minute mock interviews with an exact one- or two-problem format, one absolute deadline, direct problem-to-problem advancement, and no interim coaching or reference-solution reveal; published prompt examples remain visible
- A private interview notebook for clarifications, approach, invariant, complexity, edge cases, and final explanation, plus first-write checkpoints for prompt, approach, coding, testing, completion, and explanation
- History-backed post-mock debriefs for completed, ended, and expired interviews, with both problem workspaces, bounded source snapshots, a five-dimension 0–2 rubric, mistake tags, and reflection prompts
- A self-contained Python Challenge Lab across all 48 exercises, with original task statements, callable contracts, parameters, constraints, public examples, persistent custom JSON cases, keyboard-first runs, and aggregate hidden-suite submissions
- A Hacker-style solve workbench with resizable Prompt/Notebook and Code panels on desktop, focused Problem/Notes/Code/Tests tabs on mobile, and independently scrolling panes
- A tabbed Testcases/Custom/Result/Submissions console with safe aggregate judge feedback, cancelable isolated runs, and a structured per-parameter testcase builder with Raw JSON fallback
- Bounded device-local submission history with lazy source inspection, current-draft comparison, prompt/judge revision warnings, and exact snapshot restore that is tracked as assisted practice
- Separate Python interview, Swift interview, and iOS catalog filtering, coverage, and persisted key-friction analytics
- Shareable query-string links for exact exercises, languages, stages, records tabs, and public profiles that work on GitHub Pages and the hosted edition
- An optional hosted community edition with ChatGPT identity, public profiles, recent qualifying runs, per-exercise records, and a shared daily benchmark
- Server-validated rankings that accept only current, built-in, strict, no-peek passes with at least 95% accuracy
- Favorites, random practice, focus mode, autosaved drafts, and JSON backup/restore
- Six themes, three code fonts, editor sizing, indentation, and an optional key-friction heatmap
- Responsive desktop and mobile layouts with a compact practice picker, restart/random controls, and library length/time filters

## Why it exists

Interview content and code-typing products usually exist separately. Swift Ghost combines a curated Python, Swift, and iOS curriculum with ghost-code typing and progressively removes support. It is designed for engineers who understand programming but need to restore syntax fluency and reliable recall.

## Privacy

The GitHub Pages edition is entirely local: it has no account requirement, telemetry, cookies, or network-backed progress. Practice history, interview notebooks, source snapshots, rubric responses, and settings stay in the browser's local storage, and a portable JSON export is available in Settings. Python checks execute only inside an isolated browser worker and never send source code to a server. The fast local interpreter covers every shipped exercise and common interview helpers, but it is intentionally labeled as a subset: CPython-only packages and some newer Python language features are outside its scope.

The hosted community edition uses ChatGPT identity. Community uploads are off by default and must be explicitly enabled. Only completed built-in attempt summaries can upload; custom snippets, drafts, source code, email addresses, and key-level telemetry are never public. Public profiles, activity sharing, and leaderboard participation each require a separate opt-in.

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

Interview problem names link to their public LeetCode pages; iOS fundamentals link to current Apple or Swift.org documentation. The cues, invariants, language notes, and implementations in this repository are original educational material. `ListNode` and `TreeNode` are supplied by LeetCode for corresponding problems. Swift Ghost is not affiliated with or endorsed by LeetCode or Apple.

## Roadmap

The local-first training core remains the priority. Planned work includes richer hidden boundary suites, authored semantic masks, longitudinal readiness trends, cold-transfer variants, executable Swift solving, and cross-device learning-state sync.

## License

MIT
