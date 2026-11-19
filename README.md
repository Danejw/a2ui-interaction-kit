# A2UI Interaction Kit

Reusable semantic interactions for agent-generated interfaces. A small TypeScript interaction engine, an accessible React card, and an A2UI **v1.0** catalog extension.

**Status:** 0.1.0 starter. API and catalog are experimental and have not been published to npm. The engine is tested with Node's built-in test runner. React/A2UI integration requires dependency installation and an end-to-end test with your application.

## Interaction Kit v0.3: host-confirmed feedback and natural motion

The reusable `InteractiveItem` now accepts optional `feedbackPhase` (`idle`, `pending`, `success`, `error`) and `feedbackMessage` props. These are supplied by the owning host through A2UI, so gestures never imply successful backend writes on their own. Pending actions disable conflicting controls; completed actions display host-confirmed feedback; failures remain visible with the item available to retry.

Motion is opt-in via progressive browser support: the kit exports `withInteractionTransition(update)` from `@danejw/a2ui-interaction-kit/react`. Hosts can wrap **synchronous React state updates** in it to animate insertion, dismissal and priority-based reordering using the native View Transitions API. Unsupported browsers and reduced-motion preferences get normal synchronous updates. Stable motion names are generated with `interactionMotionId(itemId)`, which requires item IDs to be unique among simultaneously displayed cards.

The lab now demonstrates gesture-follow and springback, expandable details, subtle priority feedback, host-side pending/rejection/acknowledgement, undo and reduced-motion behavior. These enhancements remain usable by other A2UI applications through the same catalog.

## Interaction Lab v2: composable interaction patterns

The lab now offers **nine deterministic scenarios** spanning task, approval, notification, incident, and report cards, plus a separate **InteractiveDataTable** component with local search, column sorting, row selection and detail expansion. InteractiveItem has a contextual primary action, accessible overflow menu, selection, priority toggle, swipe feedback and dismiss/undo support.

On narrow screens, **Live preview** and **Event trace** are switchable tabs so inspector access no longer requires scrolling past the generated UI. The inspector includes protocol filtering and search, explicit host acknowledgements/rejections, and before/after state changes for snapshot events.

The React components remain reusable independently from the lab. Agent-defined A2UI surfaces are still schema-validated, and all external mutations require host-owned handlers and authorization. The data table's local interactions do not claim backend persistence.

## Interaction Lab

A browser-based deterministic AG-UI + A2UI integration playground is available in `apps/playground/`. It uses real A2UI renderer components and the reusable Interaction Kit, with seven simulator scenarios, event/action inspection, recording and replay, desktop/mobile browser tests, and no provider keys.

```bash
npm install
npm run dev:lab
npm run check:lab
npx playwright install chromium
npm run test:e2e
```

See [the lab guide](docs/LAB.md) and [the implementation plan](docs/INTERACTION_LAB_PLAN.md). GitHub Pages deployment is configured but requires GitHub Pages to be enabled with GitHub Actions as the source. Live model integration through AG-UI is a later milestone.

## Why

AI agents can already generate layouts through A2UI. This package gives those layouts a consistent vocabulary of usable behaviors without reimplementing every button, swipe, and dispatch path per application.

The MVP provides `expandable`, `dismissible`, `prioritizable`, `selectable`, and `actionable` in `InteractiveItem`. Expand/collapse is local. External mutations require explicit application-owned handlers and their corresponding A2UI Action properties. The UI does **not** silently delete or commit changes.

## Quick start

```bash
npm install github:Danejw/a2ui-interaction-kit
# For A2UI integration, also install the renderer and its peer dependencies:
npm install react @a2ui/react @a2ui/web_core zod
```

The package is not yet published to npm. The GitHub install runs the package `prepare` script to build `dist` automatically. You can also clone this repository, run `npm install && npm run build`, and install it from a local directory.

### Standalone React card

```tsx
import {InteractiveItem} from '@danejw/a2ui-interaction-kit/react';
import '@danejw/a2ui-interaction-kit/react/styles.css';

<InteractiveItem
  itemId="task-123"
  title="Review agent output"
  description="An agent needs your approval"
  capabilities={['expandable', 'dismissible', 'prioritizable']}
  details={<p>Evidence and details go here</p>}
  onDismiss={() => api.dismissTask('task-123')}
  onPrioritize={() => api.prioritizeTask('task-123')}
/>
```

The host app re-renders its list after a successful API response. An A2UI agent may dispatch an event, but the event alone does not confirm persistence. The renderer's server-driven updates remain the source of truth.

### A2UI integration

Use A2UI v1.0 `@a2ui/react` and `@a2ui/web_core/v1_0`:

```ts
import {MessageProcessor, basicCatalog, type ActionPayload} from '@a2ui/web_core/v1_0';
import {interactionCatalog} from '@danejw/a2ui-interaction-kit/a2ui/react';

const onAction = (action: ActionPayload) => sendToAgent({version: '1.0', action});
const processor = new MessageProcessor([basicCatalog, interactionCatalog], onAction);
```

`sendToAgent` is your application-defined transport function. Register this processor with your A2UI React host and connect the A2UI transport/action handler for your agent. Give the agent `catalog/catalog.json` alongside the Basic Catalog. v1.0 allows per-component `@catalogId` on surfaces based on the Basic Catalog. See `examples/a2ui-surface.json`. Import the CSS in your app.

The adapter exports `interactionCatalog` and `INTERACTION_CATALOG_ID` and registers `InteractiveItem` using the documented `createComponentImplementation` + `Catalog` APIs. The package does not attempt to monkey-patch arbitrary A2UI Basic Catalog components; agents explicitly emit `InteractiveItem` when they want the universal behaviors.

**Security:** A2UI Action events are untrusted requests, not authority. Validate item IDs, permissions, and the action on the backend before invoking application code or MCP tools. The example's event names are illustrative and must be wired to the host application.

## Core engine

For apps that need direct, programmatic action dispatch outside an A2UI renderer:

```ts
import {InteractionEngine} from '@danejw/a2ui-interaction-kit';

const engine = new InteractionEngine({
  authorize: async ({itemId}) => canCurrentUserEdit(itemId),
  handlers: {
    dismiss: async ({itemId}) => {
      await api.dismiss(itemId);
      return {undo: () => api.restore(itemId)};
    },
  },
});

const result = await engine.dispatch({
  itemId: 'task-123', behavior: 'dismissible', action: 'dismiss'
});

if (result.ok && result.undoable) {
  // Show an Undo affordance and invoke engine.undoLast() on user activation.
}
```

The engine checks registered behavior/action pairs, optional authorization, and duplicate in-flight dispatch. An operation is undoable only when the host provides an actual compensating handler. Undo is in-memory, scoped to that engine instance. Host services must enforce authorization independently, including during undo.

### Extending capabilities

```ts
import {BehaviorRegistry, InteractionEngine} from '@danejw/a2ui-interaction-kit';

const registry = new BehaviorRegistry([{name: 'snoozable', actions: ['snooze']}]);
const engine = new InteractionEngine({
  registry,
  handlers: {snooze: ({itemId}) => api.snooze(itemId)},
});
```

This registers a custom **engine** capability. To make it visible in A2UI you also need a corresponding schema field, component control/gesture, and event handler in the catalog adapter. Future versions can automate that through declarative behavior definitions.

## Gesture/accessibility contract

- Tap **More** to expand details; use the same control to collapse.
- Swipe left on the body of a card on touch devices to request dismissal, or use the visible **Dismiss** button.
- Double-click the noninteractive area to prioritize, or use the **Prioritize** button.
- Use **Select** and the action button for the other capabilities. Keyboard users have standard `<button>` controls.
- Controls are only shown when both the semantic capability and the corresponding handler are present. Expanded content is UI-local; backend state is host-controlled.
- Busy and error states are reported via `aria-live`. Touch scrolling is preserved.

## Development

```bash
npm install
npm run check
```

`npm run check` typechecks, runs unit tests, and builds `dist`. On Node 22, `npm test` can run the dependency-free core tests without npm installation.

## Layout

```text
src/core.ts                 Framework-independent registry, dispatch, permission and undo logic
src/react/InteractiveItem.tsx  React card with controls and swipe/double-click gestures
src/react/styles.css        Small themeable stylesheet
src/a2ui/react.tsx          A2UI v1.0 React catalog adapter
catalog/catalog.json       Agent-discoverable A2UI catalog schema
examples/                  A2UI payload, app usage, processor setup
AGENTS.md                  Coding-agent implementation rules
```

## Next steps

Verify a live A2UI message round trip in a real app, add Playwright touch/keyboard interaction tests, add configurable native gestures for more capability types, and add collection-level selection/bulk action support. Keep persistent workflow state and authorization inside host applications.

## License

MIT
