## 0.3.0

- Added host-authoritative pending, success and error A2UI feedback properties, with accessible status and errors.
- Added reusable motion helpers with native View Transitions and reduced-motion fallback.
- Added tactile swipe tracking, cancellation, transition, contextual press feedback, item entrance, details and priority animations.
- Simulator now publishes pending and acknowledgement/rejection updates through actual A2UI operations and reorders prioritized items after host confirmation.
- Added accessible lab notifications, reduced duplicate error announcements and made Undo signal its in-flight state.
- Expanded E2E coverage for gesture cancellation, pending/error/retry, priority ordering and reduced-motion behavior.
- Maintained deterministic simulation, provider-neutral protocol architecture and permission checks.

# Changelog

## 0.2.0

- Redesigned InteractiveItem with task, approval, notice, incident and report variants, contextual primary action, secondary-action menu, touch swipe feedback, priority and selection shortcuts.
- Added independently reusable InteractiveDataTable component with local row search, column sorting, multi-selection, and details.
- Expanded deterministic A2UI/AG-UI lab to nine realistic scenarios.
- Added dedicated mobile Preview and Event Trace tabs, event filtering/search, explicit action acknowledgements/rejections, and verified before/after state diffs.
- Improved accessible menu focus handling, keyboard and mobile tests, and failure diagnostic screenshots.
- Preserved host authorization, schema-driven actions, provider-neutral protocol boundary, and read-only simulation.
- Live model connections remain a separate future milestone.

## 0.1.0

- Initial Interaction Kit, A2UI catalog, AG-UI deterministic simulator, interactive lab and CI.
