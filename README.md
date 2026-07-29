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
- A routeable Pattern Academy with 12 authored playbooks covering recognition cues, rejection rules, confusable patterns, invariants, worked state traces, incomplete Python and Swift skeletons, commit-before-reveal retrieval checks, and explicit handoffs from guided exposure to local solve and sealed transfer practice
- A mixed Pattern Decision Review for Arrays & Hashing, Two Pointers, and Sliding Window: six unlabeled micro-prompts, explicit cue/invariant/rejected-alternative commitments, authored comparisons, objective pattern-choice matches, 1/3/7/14/30-day scheduling, distinct-prompt retention, reload-safe sprints, Today and assessment entry points, and repeated-miss handoffs to Weakness Lab without inflating solve evidence
- A Python-first Test Design / Counterexample Lab with six original contract prompts, reload-safe committed drafts, explicit baseline/boundary/adversarial/regression purposes, conservative reference-oracle confirmation that never marks novel cases wrong, delayed distinct-probe retention, blank-solve handoffs, and boundary/verification evidence routed to Weakness Lab without pretending the designed case was executed
- A first-class Swift/iOS Concept Recall lane: answer privately, commit before reveal, compare against 48 authored reference answers, optionally type over the grey answer, then self-grade without automated semantic scoring
- A Today dashboard with a deterministic Daily Type, Python and iOS reactivation exercises, due recall, and resumable drafts
- An Adaptive Daily Coach that builds deterministic 15-, 30-, or 45-minute plans from overdue work, missing evidence, Python fluency, independent solves, and iOS maintenance
- Reusable Study Plans with four evidence-based templates, fixed personal collections, 15/30/45-minute focus blocks, due-review priority, rolling Python/Swift/iOS allocation, and honest assisted-versus-independent progress
- A unified Weakness Lab that turns recurring debrief, solution-review, assessment, mock, and transfer signals into ranked Python, Swift, and iOS remediation cases, targeted three-context practice queues, exact evidence trails, and delayed transfer-based resolution
- Plan-linked Python and Swift/iOS Interview Studio capstones, with plan structure and session links preserved without turning typing passes into solving mastery
- Searchable, filterable, sortable problem library
- Strict and free-correction typing modes with selection-aware character feedback
- WPM, raw keystrokes, accuracy, corrections, peeks, timing, and consistency records
- Per-attempt pace timelines, line-level error forensics, and three-pass weak-line repair drills
- Real browser-side Python checks for every built-in Python solution, isolated in a fresh Web Worker with a pinned, self-hosted runtime and compatibility tests covering all 48 core exercises plus all 8 transfer variants
- A first-class Python Solve lane with a lazily loaded CodeMirror editor, Python syntax highlighting, indentation, bracket tools, search, history, practice-only fluency completions, source-bound verification, and solve evidence kept separate from typing records
- Five-stage per-problem recall ladder with honest mastery and qualified personal bests
- Post-attempt pace charts, missed-line forensics, same-stage retries, and exact item/revision/stage community benchmark previews
- Optional 30-second typing and concept debriefs that record retrieval difficulty, cognitive friction, confidence, and an authored teach-back response; these stay local and feed the next Daily Coach plan
- A 30-day readiness evidence view that keeps hint-free verified solves, retrieval quality, debrief coverage, recurring friction, practice mix, and review burden separate instead of collapsing them into a misleading score
- A dedicated 90-day readiness timeline with 13 chronological activity blocks, current-versus-prior 30-day evidence comparisons, Python/Swift/iOS time balance, sparse-data disclosure, and no composite readiness score
- Local attempt history, streaks, daily goals, pattern coverage, and progress charts
- Spaced review at 1, 3, 7, 14, and 30 days, with lapses returning tomorrow
- Device-local custom Python or Swift snippets with safe content revisions and learning milestones
- Persistent multi-problem sessions with independent track, source, category, difficulty, count, and recall-policy controls, plus mixed typing, concept-recall, and verified-solve tasks from the Daily Coach
- Routeable practice-session recaps with frozen queue order, attempt-ID-bound per-item evidence, honest legacy-history disclosure, current-revision replay, and targeted weak-item retries
- Reload-safe 30-, 45-, and 60-minute mock interviews with an exact one- or two-problem format, one absolute deadline, direct problem-to-problem advancement, and no interim coaching or reference-solution reveal; published prompt examples remain visible
- A private interview notebook for clarifications, approach, invariant, complexity, edge cases, and final explanation, plus first-write checkpoints for prompt, approach, coding, testing, completion, and explanation
- History-backed post-mock debriefs for completed, ended, and expired interviews, with both problem workspaces, bounded source snapshots, a five-dimension 0–2 rubric, mistake tags, and reflection prompts
- A guided Interview Studio for both Python coding and Swift/iOS technical screens, with clarification, approach, implementation, testing, complexity, follow-up, and closing phases
- Separate mock and coach modes: mock interviews lock hints, while coach-mode hints are progressively revealed and permanently recorded in the local transcript
- Reload-safe local interview transcripts, Python runner evidence, accepted-submission requirements, authored review criteria, and replayable interview history without automated semantic or pass/fail scoring
- A self-contained Python Challenge Lab across all 48 exercises, with original task statements, callable contracts, parameters, constraints, public examples, persistent custom JSON cases, keyboard-first runs, and aggregate unshown-check submissions; those checks ship in the local client and are not a security boundary
- A separate, fail-closed Verified Python checkpoint lane with server-selected prompt revisions, transient source upload, immutable pending receipts, signed asynchronous settlement, and aggregate-only results; it appears as unavailable until a VM-backed judge gateway is explicitly connected
- A device-local Transfer Lab with 8 original concealed-identity Python variants, exact-revision prompt and hint exposure tracking, independent/assisted/proven/due evidence, conservative 1/3/7/14/30-day rechecks, and post-attempt contrastive debriefs; sealed variants stay out of generic sessions, and revealed reconstructions are recorded as assisted
- Device-local Virtual Rounds with fixed 45/75/105-minute two-to-four problem formats, free problem switching and flags, per-problem source preservation, partial local scoring, five-minute solved-problem penalties, deadline-safe pending submissions, and immutable round reports without rank or readiness claims
- A Hacker-style solve workbench with resizable Prompt/Notebook and Code panels on desktop, focused Problem/Notes/Code/Tests tabs on mobile, and independently scrolling panes
- A tabbed Testcases/Custom/Result/Submissions console with safe aggregate judge feedback, cancelable isolated runs, and a structured per-parameter testcase builder with Raw JSON fallback
- Bounded device-local submission history with lazy source inspection, current-draft comparison, prompt/judge revision warnings, and exact snapshot restore that is tracked as assisted practice
- Reload-safe accepted-solve reviews with an explain-first gate, 56 revision-matched project-authored guides, exact receipt-to-attempt source comparison, structured mistake capture, committed teach-back, honest self-rating, and a deterministic local follow-up date
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

The GitHub Pages edition is entirely local: it has no account requirement, telemetry, cookies, or network-backed progress. Pattern Academy retrieval responses, Pattern Decision Review history and due dates, Test Design drafts/history/due dates, practice history, interview notebooks, virtual-round reports, source snapshots, solution-review explanations and notes, rubric responses, and settings stay in the browser's local storage, and a portable JSON export is available in Settings. Test Design reference cases are original teaching examples, not hidden judge payloads; learner cases are not executed or copied into solves. Python checks execute only inside an isolated browser worker and never send source code to a server. The fast local interpreter covers every shipped exercise and common interview helpers, but it is intentionally labeled as a subset: CPython-only packages and some newer Python language features are outside its scope.

Browser persistence is designed for one active tab per profile. Concurrent edits to the same profile in multiple tabs are unsupported and resolve last-write-wins; bounded append-only attempt records are deduplicated by ID during normalization, and portable v30 backups remain the recovery path.

The hosted community edition uses ChatGPT identity. Signed-in learners can privately sync bounded Study Plan structure, collection membership, and plan/session links between devices. Code, transcripts, notebooks, custom testcases, solution-review records, reference answers, and custom practice-item contents are excluded from plan sync. Community uploads are off by default and must be explicitly enabled. Only completed built-in attempt summaries can upload; custom challenges and snippets, prompts, judge cases, drafts, source code, email addresses, and key-level telemetry are never public. Public profiles, activity sharing, and leaderboard participation each require a separate opt-in.

The optional Verified Python lane is the one explicit exception to local source handling: pressing its sealed-test Submit button uploads that checkpoint source to the configured judge. The application keeps a transient retry copy only until the gateway durably accepts the queued job (or until the signed result settles) and persists only a source hash plus aggregate receipt. Browser-local assessments and ordinary practice never silently use this path or inherit its verified label.

Custom Python challenge studio: Library → Build practice item can now create a complete local challenge with a problem statement, function or class-method contract, typed parameters, visible samples, hidden submission cases, starter code, and a reference solution. The reference must pass the complete local judge before the item can be saved. Editing prompt or code content creates a new content revision; editing the callable or judge cases also creates a new judge revision while older attempt and submission evidence remains in Records.

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

The hosted Verified Python lane also requires the independently deployed
`judge-gateway/` service and four server-only environment variables:

```text
TRUSTED_JUDGE_URL=https://<gateway>/v1/submissions
TRUSTED_JUDGE_TOKEN=<32+ byte ingress service token>
TRUSTED_JUDGE_CALLBACK_SECRET=<32+ byte callback HMAC secret>
TRUSTED_JUDGE_CALLBACK_URL=https://<host>/api/internal/judge-results
```

The callback secret must match the gateway's `CALLBACK_HMAC_SECRET`, and the
callback origin must be present in its exact allowlist. Do not set placeholder
values: the capability stays off unless every value passes validation. Complete
the Docker/Linux, paid Cloudflare Sandbox, Queue/DLQ, secret, and deployed
egress/callback smoke-test checklist in `judge-gateway/README.md` before enabling
the lane for learners.

## Content note

Interview problem names link to their public LeetCode pages; iOS fundamentals link to current Apple or Swift.org documentation. The cues, invariants, language notes, and implementations in this repository are original educational material. `ListNode` and `TreeNode` are supplied by LeetCode for corresponding problems. Swift Ghost is not affiliated with or endorsed by LeetCode or Apple.

## Roadmap

The local-first training core remains the priority. Planned work includes richer boundary suites, authored semantic masks, server-assigned private transfer judging, executable Swift solving through an isolated server-side toolchain, and private cross-device sync for learning evidence beyond the current Study Plan structure.

## License

MIT
