# A2UI Interaction Kit

Reusable semantic interactions for agent-generated interfaces. A small TypeScript interaction engine, an accessible React card, and an A2UI **v1.0** catalog extension.

**Status:** 0.1.0 starter. API and catalog are experimental and have not been published to npm. The engine is tested with Node's built-in test runner. React/A2UI integration requires dependency installation and an end-to-end test with your application.

## Why

AI agents can already generate layouts through A2UI. This package gives those layouts a consistent vocabulary of usable behaviors without reimplementing every button, swipe, and dispatch path per application.

The MVP provides `expandable`, `dismissible`, `prioritizable`, `selectable`, and `actionable` in `InteractiveItem`. Expand/collapse is local. External mutations require explicit application-owned handlers and their corresponding A2UI Action properties. The UI does **not** silently delete or commit changes.

## Quick start

```bash
npm install @danejw/a2ui-interaction-kit react
# For the A2UI adapter, also install versions of these packages supporting v1_0:
npm install @a2ui/react @a2ui/web_core zod
```

The npm package name is reserved here as a future target. Until published, install from a cloned directory using `npm install /path/to/a2ui-interaction-kit` after building it, or use the source directly in a workspace.

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
