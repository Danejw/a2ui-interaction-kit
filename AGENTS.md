# Agent working agreement

Build a reusable and secure A2UI interaction extension, independent of any one app.

- `src/core.ts` is framework-independent; never import React or A2UI here.
- `src/react` owns gesture/accessible UI implementations; `src/a2ui` owns the A2UI v1.0 bridge.
- `catalog/catalog.json` must stay compatible with the TypeScript catalog's props and identifiers.
- Never execute function names or arbitrary code from agent-supplied JSON. Application-owned handlers authorize and perform effects.
- A backend action is complete only after the host verifies and updates its state.
- Dismissal hides an item only after a successful application update; dismissal is never implicit deletion.
- Any undo must have an actual, host-provided compensating action.
- Gestures need visible and keyboard-accessible equivalents.
- Keep API surface small. Add tests when adding capabilities and do not introduce persistence or network code into the package.
- Run `npm run check` before submitting changes. Report integration tests that could not be executed.

## UI quality gate (fixed rubric)

Use the 20/25/25/20/10 visual/usability/interactions/mobile/reliability scoring baseline; inspect desktop and mobile live screenshots before claiming a score. New variants must include an accessible keyboard path to secondary actions. Any gesture must have a visible control alternative. Keep the card/data explorer independent of project-specific state. Validate Playwright real-browser round trips rather than trusting typechecks alone.
