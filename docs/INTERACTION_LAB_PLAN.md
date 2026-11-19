# Interaction Lab implementation plan

Status: Planned, not implemented.
Target: A browser-based, deterministic integration and regression test application for the existing A2UI Interaction Kit v0.1.0.
Scope boundary: Live model/provider connections are a subsequent milestone.

## Purpose

Prove the real end-to-end experience of A2UI-generated surfaces using the published repository's React renderer/catalog adapter and interaction engine, while keeping the agent transport compatible with AG-UI. The lab must be useful on desktop and mobile, without API keys, paid services, or an application database.

## Verified starting point

- Repository `Danejw/a2ui-interaction-kit` exposes core, React, and A2UI v1.0 React adapter entrypoints.
- Core currently declares five capabilities: `expandable`, `dismissible`, `prioritizable`, `selectable`, `actionable`.
- Existing unit tests, catalog validation, TypeScript build, and GitHub Actions passed for the repository's initial release.
- `apps/playground/`, AG-UI support, deployed demo, browser E2E tests, and real agent/provider integration are not yet implemented.
- The current React/A2UI adapter must be tested in a running renderer. Do not assume that passing TypeScript alone proves the A2UI action round trip.

## Architecture

```text
apps/playground (Vite + React)
  ├─ scenario picker, viewport controls, canvas, event/action inspector
  ├─ AG-UI-compatible agent client abstraction
  │    └─ deterministic simulated agent (this milestone)
  │         ↕ typed AG-UI events, run input, simulated acknowledgement
  ├─ A2UI event bridge: AG-UI activity/surface operations → A2UI v1.0 MessageProcessor
  ├─ A2UI Basic Catalog + Interaction Kit custom catalog
  └─ @danejw/a2ui-interaction-kit React components/core (package boundary)
Future:
  └─ AG-UI HttpAgent endpoint(s) → agent runtime → any supported model provider
```

Responsibilities:

- A2UI owns declarative UI surfaces, components, and bound data.
- The Interaction Kit owns reusable interaction behavior, controls/gestures, and dispatch.
- AG-UI owns agent runs, event transport, messages, and shared-state events.
- The simulated host/back-end owns authoritative task state, permissions, action outcomes, and compensating undo operations.
- The host is responsible for mapping validated A2UI outbound actions to AG-UI run input. The model may request available capabilities but cannot grant them.

## Technical decisions

1. Keep the package source and exports in `src/` unchanged except for verified integration fixes. Add `apps/playground/` as a consumer of the built package. Use npm workspaces or a simple local package dependency, whichever is compatible with the existing npm scripts and produces a real package-boundary test.
2. Use the official A2UI v1.0 `MessageProcessor` and React renderer with both Basic and Interaction catalogs. Do not replace the renderer with hand-authored look-alike cards.
3. Implement a deterministic AG-UI source using the official AG-UI event types/interfaces; runs must emit `RUN_STARTED`, appropriate message/activity/state events, and `RUN_FINISHED` or `RUN_ERROR`.
4. Send A2UI operations through the documented AG-UI integration shape, ideally `a2ui-surface` activity snapshots containing `a2ui_operations`, after verifying compatibility with the repository's **A2UI v1.0** renderer and installed versions. Use official middleware where useful; do not implement a second competing renderer or invent a private wire protocol. If the current bridge lacks v1.0 support, isolate a small, documented adapter and test it.
5. Actions must traverse the actual outbound A2UI action path, enter the simulator via the AG-UI agent input boundary, pass authorization and action validation, then return an AG-UI event carrying the new A2UI data/surface state.
6. Use in-memory simulator data, with optional local JSON fixture import/export. No persistence server or secrets required.
7. Define a single swappable agent interface compatible with `@ag-ui/client` / `AbstractAgent` input and event streams so a later HTTP-backed AG-UI agent does not change the component/rendering code. A protocol adapter does not, by itself, implement model-provider adapters; that happens in the future agent backend.
8. Keep the repo usable as a direct GitHub npm dependency. Confirm the package works when consumed from its built exports, not only via a source alias.

## Lab layout

- **Scenario Gallery**: select a scenario, reset it, see expected capabilities and instructions.
- **Canvas**: A2UI-rendered interactive surface. Responsive desktop/mobile viewports.
- **Inspector**: chronological AG-UI events, A2UI envelopes, outbound user actions, permission checks, action results, and current host state. Inspect and copy sanitized JSON.
- **Controls**: run/pause/reset, seeded randomization only where helpful, simulated latency, fail next action, permission denied, stream disconnect, and state re-sync.
- **Replay**: load deterministic JSON fixture recordings and replay using the same path; export a redacted local recording for bug reproduction. Only export user-activated, sanitized test fixtures.
- **Docs**: usage instructions, extension recipe, supported behaviors, integration contract, and limitations.

## Initial scenarios

1. Agent task dashboard: expandable details, prioritization, selection, and dismiss with undo.
2. Approval queue: actions accepted, rejected, and awaiting confirmation; clearly distinguish dismiss from delete.
3. Error and recovery: failing action, visible error, retry, and no misleading success state.
4. Permission denial: capability displayed only when authorized or rejected securely on dispatch; compare disabled affordance against backend enforcement.
5. Streaming surface lifecycle: start, create surface, incremental data/component updates, finish; tolerate delays and transient ordering issues permitted by the protocols.
6. Multiple surfaces and item identity: per-surface IDs, mixed catalogs, independent state, and reset.
7. Stress: many items, repeated gestures, duplicate dispatch, busy states, and interrupted runs.
8. Accessibility: keyboard-only controls, reduced motion, touch gesture fallback, screen-reader status, and focus preservation.

Each scenario is a typed, versioned fixture with seeded starting state, expected A2UI outputs, simulated action handlers, deterministic outcomes, and assertions.

## Implementation sequence with acceptance gates

### Phase A: Baseline verification and workspace

- Re-run package checks; inspect actual installed A2UI/AG-UI APIs and version compatibility.
- Add `apps/playground/` and root scripts `dev:playground`, `build:playground`, `test:e2e`.
- Create a minimal app importing built library exports.
- **Gate:** package checks pass and at least one real custom-catalog `InteractiveItem` renders in browser.

### Phase B: AG-UI simulator and A2UI bridge

- Implement in-memory typed AG-UI producer, event subscription, lifecycle and replay.
- Wire AG-UI A2UI activity/surface payloads to v1.0 `MessageProcessor`.
- Wire outbound A2UI user action back to simulator input and emit state update after validated simulated mutation.
- **Gate:** automated full round trip: agent run → AG-UI event → A2UI surface → user gesture/button → outbound action → simulator handler → AG-UI update → rendered state.

### Phase C: Lab user experience

- Build gallery, canvas, inspector, scenario controls, responsive layout, and seeded scenarios.
- Add explicit loading/failure/undo behavior. Use realistic interactions on touch and desktop with accessible button alternatives.
- **Gate:** users can run all initial scenarios and inspect meaningful traces without a provider key.

### Phase D: Automated tests and public demo

- Unit tests for simulator fixtures and action mapping.
- Integration tests for the A2UI message processor + catalog + action bridge.
- Playwright browser tests for keyboard, click, swipe/touch, state update, undo, denial, failures, lifecycle, and reset; test mobile emulation and Chromium at minimum. Include basic accessibility checks.
- GitHub Actions runs package tests, playground build, and browser tests on PR/push.
- Publish static playground to GitHub Pages only after successful CI; configure Vite base for the repository URL and keep simulated mode entirely browser-based.
- **Gate:** reproducible passing CI and usable static demo on phone and desktop.

### Phase E: Integration-ready packaging and documentation

- Verify `npm install github:Danejw/a2ui-interaction-kit` in a clean external test consumer, including CSS, package exports, type declarations, and optional peer dependencies.
- Document how a consumer registers the catalog and backend action handlers, with minimal runnable examples.
- Update README with lab link, tests, and extension recipe.
- **Gate:** fresh project can install and render an interactive A2UI item without copying internal source files.

## Future milestone: live agent, model- and provider-agnostic

Keep a provider-independent frontend and select a remote AG-UI-compatible endpoint at runtime. The backend agent/runtime, outside the Interaction Kit, owns model/provider selection, credentials, tool connections, output validation, and billing. Prefer existing AG-UI/A2UI integration middleware and verified dynamic-generation tooling rather than inventing a new agent protocol. Real-mode implementation requires its own design and security review.

Future acceptance: connect two different model providers through compatible AG-UI agent backends, generate custom A2UI surfaces from the registered catalog, handle multiple turns and action round trips, and replay captured/redacted streams deterministically.

## Explicit non-goals of this milestone

- No OpenAI/Gemini/other model calls, API-key form, model secrets, or AI-generated arbitrary code.
- No database, user accounts, cloud worker, real MCP execution, or third-party action side effects.
- No custom A2UI renderer or private AG-UI protocol fork.
- No claim that simulation proves quality of model-generated A2UI instructions.
- No need to implement every brainstormed capability before the lab is useful.

## Security and correctness rules

- Agent-provided component JSON and actions are untrusted.
- Use registered catalog schemas and allowlisted handlers; no evaluation of arbitrary JS/code.
- Check permissions at dispatch and again for any compensating undo.
- Never optimistically imply a persisted success before the simulated host acknowledges the operation; where optimism is deliberate, show pending and rollback.
- Dismiss means remove from visible collection, not permanent deletion.
- Prevent duplicate in-flight mutations; isolate state by scenario, surface, and stable item ID.
- Keep exported traces free of secrets or sensitive user data.

## Definition of done

A new developer can clone the repository, install dependencies, run the lab, select an agent scenario, watch real AG-UI protocol events produce valid A2UI components, interact with them on a phone or desktop, observe the action/acknowledgement/state update, replay failures, and see tests pass in CI. The future live-agent integration is isolated behind an AG-UI-compatible agent interface and requires no UI rewrite.

## Primary references

- https://ag-ui.com/
- https://github.com/ag-ui-protocol/ag-ui/blob/main/skills/ag-ui-a2ui-integration/SKILL.md
- https://github.com/ag-ui-protocol/ag-ui/blob/main/docs/concepts/events.mdx
- https://a2ui.org/concepts/messages/
- https://a2ui.org/guides/client-integration/
- https://a2ui.org/guides/defining-a-catalog/
