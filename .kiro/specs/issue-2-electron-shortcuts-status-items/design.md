# Design Doc: Issue #2 Electron Shortcuts and Status Items

Status: Implemented locally, pending review/ship/release
Date: 2026-06-19
Issue: https://github.com/laststance/mac-mcp-server/issues/2
Repo: laststance/mac-mcp-server
Branch reviewed: main

## Problem

`mac-mcp-server` works for most native Electron QA flows, but Issue #2 exposes two concrete automation gaps on macOS 26.5.1:

1. `key_combination({ modifiers: ["command"], key: "3" })` does not trigger Electron `globalShortcut.register("CommandOrControl+3", ...)` handlers. The current implementation uses AppleScript `System Events`, so it reaches focused-window shortcuts and menu key equivalents, not OS-global hotkeys.
2. `list_status_bar_items` and `click_status_bar_item` can abort before their fallback path runs because `menu bar 1 of process "SystemUIServer"` is invalid on macOS 26. Electron `Tray` items also live under the owning app process, not only under `SystemUIServer` or `ControlCenter`.

The user-visible result is that an agent can drive windows, text, screenshots, and menus, then gets stuck on two common Electron surfaces: global command hotkeys and tray/status-menu actions.

## Goals

- Document the exact contract of `key_combination`: focused app shortcuts and app/menu key equivalents are supported; OS-global hotkeys are not guaranteed.
- Keep the mainline keyboard implementation boring: no native helper and no CGEvent backend in this PR.
- Make status bar discovery resilient when `SystemUIServer` has no `menu bar 1`.
- Enumerate and click app-owned status items, especially Electron `Tray` items exposed as `menu bar 2` on the owning process.
- Preserve existing MCP tool names, input schemas, response shape, and AppleScript execution model.
- Add tests that catch the macOS 26 abort path without requiring macOS 26 in CI.

## Non-Goals

- Guarantee delivery to Electron `globalShortcut` or Carbon `RegisterEventHotKey` from `key_combination`.
- Add a native Swift/Objective-C/CGEvent helper.
- Redesign the whole menu subsystem.
- Add cross-platform support.
- Change package distribution, release automation, or MCP protocol wiring.

## Sources Checked

- Issue #2 body and reproduction environment.
- `src/tools/keyboard.ts:5` says keyboard tools use AppleScript via System Events.
- `src/tools/keyboard.ts:410-422` posts either `key code` or `keystroke` through `System Events`.
- `src/tools/menu.ts:695-721`, `834-848`, and `949-981` query `SystemUIServer` without a local `try`.
- `src/tools/menu.ts:723-752`, `851-867`, and `985-1003` already have guarded `ControlCenter` fallbacks.
- Electron docs via Context7: `globalShortcut.register` registers a shortcut that works even when the app is out of focus; `Tray` creates a system tray/status item with menu support.
- MCP TypeScript SDK docs via Context7: current handler return shape remains `content: [{ type: "text", text }]`, so protocol shape changes are not required.

## What Already Exists

| Existing piece | Reuse decision |
| --- | --- |
| `executeAppleScript` timeout/error wrapper | Reuse. Status bar scripts stay behind the same timeout and response path. |
| `checkAccessibility` gate | Reuse. All affected tools already check Accessibility before scripting. |
| `sanitizeString` | Reuse for user-provided identifiers and menu paths. Add JSON escaping for OS-provided item descriptions inside generated AppleScript. |
| `list_menu_items` / `click_menu_item` | Reuse as the recommended workaround for commands available through app menus. |
| `get_menu_bar_structure` | Reuse as a diagnostic surface for app menu hierarchy, not as the primary status item click path. |
| `tests/tools/keyboard.test.ts` | Extend for the documented keyboard contract. |
| `src/tools/menu.test.ts` | Extend for status item script behavior and macOS 26 fallback behavior. |
| `.github/workflows/release.yml` | No change. It already publishes npm releases from tagged release commits. |

## Scope Challenge

Minimum complete change:

1. Update keyboard docs/tool descriptions so users stop expecting global hotkey delivery from `key_combination`.
2. Harden all status bar entry points, not only `list_status_bar_items`, because `click_status_bar_item` and `click_status_bar_menu_item` have the same unguarded `SystemUIServer` read.
3. Add app-owned status menu bar traversal so Electron `Tray` items can be found.
4. Add tests that inspect behavior without depending on the local machine's status menu layout.

Complexity check: expected implementation touches 5-6 files and adds 0 new classes/services. This stays under the skill smell threshold of 8 files or 2 new classes/services.

Search check:

- [Layer 1] Electron already documents `globalShortcut` as global/out-of-focus. Treat it as a different OS event path, not a stronger form of `key_combination`.
- [Layer 1] Existing AppleScript + Accessibility architecture should be preserved for status items.
- [Layer 3] First-principles call: a reliable agent should use an observable command surface (`click_menu_item`, UI element, or status item) rather than pretending a synthetic focused-key event can always reach an OS-level global shortcut.

Distribution check: this remains the existing npm CLI package. No new artifact type is introduced.

TODOS cross-reference: no `TODOS.md` exists. No deferred TODO blocks this plan.

## Proposed Architecture

### Keyboard Contract

Do not introduce a second keyboard backend in the main implementation. Instead, tighten the contract in README and MCP tool descriptions:

```text
key_combination
  |
  |-- AppleScript System Events: key code / keystroke
  |
  |-- reaches focused app shortcut
  |-- reaches menu key equivalent when the app/menu accepts it
  |
  `-- does not promise OS-global hotkey delivery
       Electron globalShortcut / RegisterEventHotKey live here
```

Why: the MCP tool currently has no observable way to know whether an Electron `globalShortcut` did or did not fire. Returning success from AppleScript remains true for the synthetic key event, but docs must say what surface was actually exercised.

Reliable alternatives to document:

- Use `click_menu_item` when the command is exposed in the app menu.
- Use an in-window shortcut after `activate_app` when the shortcut is scoped to the focused renderer/window.
- Use `click_status_bar_item` or `click_status_bar_menu_item` after the status item work below lands.
- Create app-side test hooks only in the target app, not in `mac-mcp-server`, when the command is only reachable through a global shortcut.

### Status Bar Discovery And Click Flow

Unify status item lookup around three independent scopes. A failure in one scope must not abort the others.

```text
list_status_bar_items / click_status_bar_item / click_status_bar_menu_item
  |
  |-- check Accessibility
  |
  |-- try scope: SystemUIServer menu bar 1
  |     `-- missing on macOS 26 is a scoped miss, not a tool failure
  |
  |-- try scope: ControlCenter menu bar 1
  |     `-- existing guarded fallback keeps working
  |
  `-- try scope: app-owned status menu bars
        |
        |-- iterate application processes
        |-- when a process has at least 2 menu bars, inspect menu bar 2
        |-- match by description/name/title/process name
        `-- stop after configured process/item caps
```

Implementation shape:

- Keep changes in `src/tools/menu.ts`.
- Add shared AppleScript subroutines or shared script-fragment builders for:
  - scoped status item enumeration
  - JSON string escaping
  - item identifier fallback
  - click-by-identifier traversal
- Apply the same scope order to:
  - `listStatusBarItems`
  - `clickStatusBarItem`
  - `clickStatusBarMenuItem`
- Keep `SystemUIServer` and `ControlCenter` behavior first for backwards compatibility.
- Add app-owned process scanning after those existing scopes so old behavior wins where it still works.

### JSON Safety

Current `listStatusBarItems` builds JSON by concatenating `itemDesc` directly:

```text
src/tools/menu.ts:711
set resultJson to resultJson & quote & "description" & quote & ":" & quote & itemDesc & quote & ","
```

If an OS-provided description contains a quote or backslash, parsing can fail. The status item fix should add AppleScript-local JSON escaping before appending any OS-provided string. This is part of the same feature, not a separate refactor, because app-owned item descriptions are more likely to include product names and arbitrary tooltip text.

## Data Flow

```text
MCP Client
  |
  v
registerAllTools()
  |
  +-- key_combination
  |     |
  |     +-- checkAccessibility()
  |     +-- build System Events key script
  |     +-- executeAppleScript()
  |     `-- return pressed-message or AppleScript error
  |
  `-- status bar tools
        |
        +-- checkAccessibility()
        +-- build shared status item script
        +-- executeAppleScript(timeout: MENU_TIMEOUT)
        +-- parse output prefix / JSON
        `-- return items, clicked message, or not-found error
```

## Detailed Implementation Plan

1. Update keyboard contract docs.
   - `README.md`: add a limitation note near `key_combination`.
   - `src/lib/register-tools.ts`: clarify tool description so MCP clients see the same contract.
   - `src/tools/keyboard.ts`: update JSDoc near `keyCombination`.

2. Harden status item scopes.
   - Wrap `SystemUIServer` reads in local `try ... end try`.
   - Keep `ControlCenter` guarded and reachable.
   - Add app-owned `menu bar 2` traversal after existing scopes.
   - Apply the same traversal to list, click, and click-menu-item tools.

3. Deduplicate status item script logic.
   - Avoid three hand-copied traversal blocks.
   - Prefer a small set of local helper functions or AppleScript subroutines inside `src/tools/menu.ts`.
   - Do not introduce a new module unless the file becomes hard to read.

4. Add tests.
   - Verify generated status item scripts contain local `try` blocks around `SystemUIServer`.
   - Verify app-owned `menu bar 2` traversal is present.
   - Verify `listStatusBarItems` still parses a successful JSON array.
   - Verify the macOS 26 `SystemUIServer` failure does not prevent `ControlCenter` or app-owned fallback output.
   - Verify `key_combination` docs/tool description state the non-global contract.

5. Verify locally.
   - `pnpm test:run`
   - `pnpm typecheck`
   - `pnpm lint`
   - Manual macOS QA when possible:
     - call `list_status_bar_items` on macOS 26
     - call `click_status_bar_item({ identifier: "Electron" })` against an Electron Tray app
     - confirm `key_combination` docs point to app menu/in-window alternatives for global-only commands

## Implementation Notes

- Added shared status bar script builders in `src/tools/menu.ts` so list/click/menu-click use the same scope order.
- Added `src/tools/constants.ts` for explicit menu timeouts and status item scan caps.
- Documented the `key_combination` contract in README, runtime schema text, and MCP tool registration.
- Added deterministic regression tests under `tests/tools/` for macOS 26 fallback behavior, app-owned tray scans, JSON escaping, bounded lazy-menu polling, and keyboard contract wording.

## Local Verification

- `pnpm test:run tests/tools/menu-status-bar-regression.test.ts tests/tools/keyboard-contract.test.ts`: passed, 10/10.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `pnpm format:check`: passed after adding `.serena/` to `.prettierignore`.
- `pnpm test:run`: failed locally with 42 existing macOS integration timeouts around Accessibility/Automation, Finder/window operations, keyboard input, and screenshot capture; the new deterministic tests passed within the full run.

## Failure Modes

| Codepath | Production failure | Covered by plan | User result |
| --- | --- | --- | --- |
| `key_combination` focused shortcut | Accessibility denied | Existing permission check and tests | Clear permission guidance |
| `key_combination` Electron globalShortcut | AppleScript succeeds but global handler does not fire | Docs/test for contract | User is told to use menu/UI/status item route |
| `list_status_bar_items` SystemUIServer scope | `menu bar 1` invalid on macOS 26 | New scoped-try test | Tool continues to ControlCenter/app scopes |
| `list_status_bar_items` app-owned scope | App has no second menu bar | New traversal test | Scoped miss, not whole-tool failure |
| `list_status_bar_items` JSON output | Status item text contains quote/backslash | New JSON escaping test | Parsed result remains valid |
| `click_status_bar_item` matching | Identifier is only process name, not description | New app-owned matching test | Electron Tray can be clicked by process name |
| `click_status_bar_menu_item` menu load | Lazy menu items do not populate immediately | Existing wait pattern retained | Clear not-found error after bounded wait |
| app process scan | Too many processes/items slow script | Constants/caps and timeout retained | Bounded failure instead of hang |

Critical silent gaps after this plan: none. The current silent-ish gap is the keyboard global shortcut mismatch, and the plan turns it into an explicit documented contract.

## Test Coverage Diagram

```text
CODE PATHS                                            USER FLOWS
[+] src/tools/keyboard.ts                             [+] Electron QA command trigger
  +-- keyCombination()                                  +-- [GAP] Docs say focused/menu shortcut only
      +-- [EXISTING] permission denied                  +-- [GAP] Guide user to click_menu_item fallback
      +-- [EXISTING] special key via key code            +-- [GAP] Guide user to status item fallback
      +-- [EXISTING] single char via keystroke
      `-- [GAP] non-global contract documented

[+] src/tools/menu.ts                                 [+] Electron Tray QA
  +-- listStatusBarItems()                              +-- [GAP] [->E2E/manual] list Electron tray item
  |   +-- [GAP] SystemUIServer missing menu bar 1        +-- [GAP] [->E2E/manual] click Electron tray item
  |   +-- [EXISTING] ControlCenter enumeration           +-- [GAP] click tray menu item after lazy load
  |   +-- [GAP] app-owned menu bar 2 enumeration
  |   `-- [GAP] JSON escaping for item text
  +-- clickStatusBarItem()
  |   +-- [GAP] SystemUIServer miss continues
  |   +-- [GAP] ControlCenter match still clicks
  |   `-- [GAP] app-owned process/name match clicks
  `-- clickStatusBarMenuItem()
      +-- [GAP] SystemUIServer miss continues
      +-- [GAP] app-owned menu item click
      `-- [EXISTING] bounded lazy-load wait pattern

COVERAGE NOW: roughly 6/18 relevant paths tested (33%)
TARGET AFTER IMPLEMENTATION: 18/18 relevant paths tested (100%)
QUALITY TARGET: unit tests for generated behavior + manual macOS 26 QA for real AX surfaces
```

Legend: `[->E2E/manual]` means the real OS behavior must be checked on macOS with an Electron Tray app because CI cannot reliably synthesize another app's status item.

## Engineering Review

### Step 0: Scope Challenge

Scope accepted as-is. The minimal plan fixes the user-visible status item breakage completely while documenting the keyboard boundary instead of spending an innovation token on a native event backend.

### Architecture Review

1. `[P1] (confidence: 9/10) src/tools/menu.ts:695` - `SystemUIServer` status item lookup can abort the whole status item flow before `ControlCenter` fallback runs.
   - Recommendation: wrap each status scope independently and add app-owned `menu bar 2` traversal in the same pass.
   - Why: fixing only `listStatusBarItems` leaves click tools broken; fixing only `SystemUIServer` leaves Electron Tray undiscoverable.

2. `[P2] (confidence: 8/10) src/tools/keyboard.ts:410` - `keyCombination` reports a successful synthetic key event but cannot promise Electron `globalShortcut` delivery.
   - Recommendation: document the boundary and keep the implementation unchanged in this PR.
   - Why: a native event backend is a separate architecture bet with uncertain payoff and more permission/debug surface.

### Code Quality Review

1. `[P2] (confidence: 8/10) src/tools/menu.ts:710-714` - manual JSON building repeats and does not escape OS-provided strings.
   - Recommendation: add one shared JSON escape path for status item descriptions/process names.
   - Why: app-owned status items introduce more arbitrary strings, so the parser must be protected now.

2. `[P2] (confidence: 8/10) src/tools/menu.ts:694-752, 833-867, 948-1003` - status item traversal is duplicated across list/click/click-menu paths.
   - Recommendation: share the scope traversal or script fragments inside `menu.ts`.
   - Why: adding app-owned traversal three times by hand is the fastest route to drift.

### Test Review

Gaps identified: 12. Every gap is included in the implementation plan above.

Required tests:

- Add AAA-style tests for keyboard docs/tool description wording if descriptions remain testable through `registerAllTools` or exported metadata.
- Add tests that assert status item scripts isolate `SystemUIServer` failures.
- Add tests that assert `ControlCenter` and app-owned paths remain reachable after a scoped failure.
- Add tests for JSON escaping of status item descriptions.
- Add tests for matching by description and process name.
- Keep existing macOS smoke tests, but do not rely on them as the only regression shield.

### Performance Review

1. `[P2] (confidence: 7/10) src/tools/menu.ts:688` - app-owned status traversal can become slow if it blindly scans every process and every menu bar item.
   - Recommendation: use explicit caps for process and item scans, keep `MENU_TIMEOUT`, and stop once a click target is found.
   - Why: status item tools are interactive agent operations; bounded latency matters more than exhaustive metadata.

## NOT In Scope

- CGEventPost backend spike - deferred because global shortcut delivery is not guaranteed and requires a separate native-event investigation.
- Native helper binary - deferred because this package currently ships as TypeScript/AppleScript over npm.
- Changing MCP SDK registration style to `registerTool` - deferred because package uses SDK 1.25.2 and current `server.tool` style is still aligned with installed dependency.
- Full status item metadata model - deferred because the issue needs discovery and clicking, not a richer status-item database.
- Release version bump - deferred until implementation lands and CI passes.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
| --- | --- | --- |
| Keyboard contract docs | README, src/lib, src/tools | none |
| Status bar implementation | src/tools | none |
| Unit/regression tests | src/tools, tests/tools | status bar implementation |
| Manual QA | running MCP server, Electron test app | implementation and build |

Lane A: Keyboard contract docs.
Lane B: Status bar implementation.
Lane C: Tests after Lane B.
Execution order: Lane A and Lane B can run in parallel worktrees. Merge both, then run Lane C and manual QA.
Conflict flags: Lane B and Lane C both touch `src/tools/menu.ts` or adjacent tests, so run tests after implementation to avoid merge churn.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P2, human: ~30min / CC: ~5min)** - Keyboard docs - Document `key_combination` as focused/menu shortcut input, not OS-global shortcut input.
  - Surfaced by: Architecture Review - `keyCombination` cannot promise Electron `globalShortcut` delivery.
  - Files: `README.md`, `src/lib/register-tools.ts`, `src/tools/keyboard.ts`, `tests/tools/keyboard.test.ts`
  - Verify: `pnpm test:run tests/tools/keyboard.test.ts && pnpm typecheck`

- [ ] **T2 (P1, human: ~2h / CC: ~20min)** - Status bar resilience - Isolate `SystemUIServer` failures and keep fallbacks reachable.
  - Surfaced by: Architecture Review - unguarded `menu bar 1` access aborts status item tools on macOS 26.
  - Files: `src/tools/menu.ts`, `src/tools/menu.test.ts`
  - Verify: `pnpm test:run src/tools/menu.test.ts && pnpm typecheck`

- [ ] **T3 (P1, human: ~3h / CC: ~30min)** - Electron Tray support - Enumerate and click app-owned status menu bars.
  - Surfaced by: Architecture Review - Electron `Tray` items can live under the owning process's second menu bar.
  - Files: `src/tools/menu.ts`, `src/tools/menu.test.ts`
  - Verify: unit tests plus manual `click_status_bar_item({ identifier: "Electron" })` against an Electron Tray app.

- [ ] **T4 (P2, human: ~1h / CC: ~10min)** - JSON safety - Escape OS-provided status item strings before JSON construction.
  - Surfaced by: Code Quality Review - manual JSON concatenation can break parsing.
  - Files: `src/tools/menu.ts`, `src/tools/menu.test.ts`
  - Verify: test with description containing quote and backslash.

- [ ] **T5 (P2, human: ~1h / CC: ~10min)** - Bounded scan - Add process/item caps for app-owned status traversal.
  - Surfaced by: Performance Review - app scan can become slow without caps.
  - Files: `src/tools/menu.ts`, `src/tools/menu.test.ts`
  - Verify: tests assert caps appear in generated script or helper output.

## Completion Summary

- Step 0: Scope Challenge - scope accepted as-is.
- Architecture Review: 2 issues found, both folded into tasks.
- Code Quality Review: 2 issues found, both folded into tasks.
- Test Review: diagram produced, 12 gaps identified.
- Performance Review: 1 issue found, folded into tasks.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 items proposed; no `TODOS.md` exists and no follow-up is required for the core fix.
- Failure modes: 0 critical gaps remain after planned tasks.
- Outside voice: skipped; no subagent or cross-model review was requested.
- Parallelization: 3 lanes, 2 parallel / 1 sequential.
- Lake Score: 5/5 recommendations chose the complete option for this issue.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | Not needed for backend/tooling bug fix |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | skipped | No outside voice requested |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 5 issues, 0 critical gaps, all folded into implementation tasks |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | No UI surface changes |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | Docs and tests cover developer-facing behavior |

- **VERDICT:** ENG CLEARED - ready to implement Issue #2.

NO UNRESOLVED DECISIONS
