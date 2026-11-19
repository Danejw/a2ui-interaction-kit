# Interaction Lab

An interactive Vite/React sandbox for the real A2UI v1.0 renderer, the Interaction Kit catalog, and deterministic AG-UI v1.0 protocol events.

## Run locally

```bash
npm install
npm run dev:lab
# http://localhost:4173
```

Run the automated checks:

```bash
npm run check
npm run check:lab
npx playwright install chromium
npm run test:e2e
```

## Architecture

The in-memory `SimulatedAgent` emits AG-UI `RUN_STARTED`, `ACTIVITY_SNAPSHOT` with `activityType: a2ui-surface` and `content.a2ui_operations`, `STATE_SNAPSHOT`, and `RUN_FINISHED` or `RUN_ERROR`. The actual A2UI `MessageProcessor` processes the operations, and `A2uiSurface` renders with the registered Basic and Interaction catalogs. Outbound A2UI action payloads return to the simulated agent, which validates the item, capability, surface and permissions before changing host state and emitting an updated surface.

The lab has nine scenarios: Mission Control, Approval Queue, Error & Recovery, Permission Denied, Streaming Updates, Multiple Surfaces, and Stress Test. Controls can simulate latency, host errors, denied permissions, and paused event delivery. The right-hand inspector exposes live protocol envelopes. Exported recordings can be imported and replayed read-only through the same A2UI processor.

## Deployment

`pages.yml` builds the static site to `site-dist/` with the repository base path. Enable GitHub Pages for this repository and select **GitHub Actions** as the source, then run `Deploy Interaction Lab` or merge to `main`. The intended site URL is `https://danejw.github.io/a2ui-interaction-kit/`. Do not consider the site deployed until the workflow reports success and the URL responds.

## Future live AI

Keep AG-UI as the stream and run protocol, and supply an AG-UI-compatible remote agent instead of this deterministic event source. The agent backend chooses model and provider, owns secrets and tool permissions, and produces validated A2UI operations. No live model integration, credentials, actual MCP mutations, or production user data are included in the current milestone.

## Safety and limitations

Only registered components and actions are allowed; A2UI never executes arbitrary JS. The simulator is browser-local and is not a secure production backend. Dismissal hides and can be undone; permanent deletion is absent. Recording import is size-limited and structurally validated, but recordings should be reviewed before sharing. E2E uses Chromium and mobile emulation, so a physical Android smoke test is still valuable.
## Enhanced interaction experience

`InteractiveItem` supports five semantic variants: task, approval, notice, incident and report. Its primary button uses the agent-declared `actionLabel`, while optional priority and selection shortcuts stay visible and dismissal lives in the accessible secondary-action menu. Touch swipe-to-dismiss has progressive visual feedback; double-click toggles priority; all gestures have button equivalents.

`InteractiveDataTable` is a second, independently reusable A2UI custom-catalog component. It accepts a title, list of column keys/labels and typed row data. Row searching, sorting, local selection and detail expansion happen inside the renderer. These local read-only interactions never imply a backend write. See the **Review Board** scenario.

On mobile, use the sticky **Live preview** and **Event trace** tabs. The inspector supports payload search, state-difference annotations and explicit host ACK/REJECT events. Run all scenarios before publishing changes.

### Repeatable UX evaluation

The original review baseline was **75/100 (B-)** using these categories: visual design (20), usability/navigation (25), interaction experience (25), mobile responsiveness (20), and reliability/testing (10). Each subsequent review must retain the same weighting, verify the deployed page on desktop and mobile, and distinguish results observed through actual browser interactions from assumptions. A 100/100 score is a quality target, never automatically claimed from test success.
