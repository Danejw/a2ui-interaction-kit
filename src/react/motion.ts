/** Progressive enhancement for animated, host-authoritative A2UI surface updates.
 * Browser view transitions are document-scoped: overlapping transitions are
 * handled as ordinary synchronous updates instead of interrupting one another.
 * Unsupported browsers, SSR and reduced-motion preferences use the same fallback.
 */
let activeTransition = false;

export function withInteractionTransition(update: () => void): void {
  if (typeof document === 'undefined') {update(); return;}
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      ready: Promise<void>;
      finished: Promise<void>;
    };
  };
  if (activeTransition || !doc.startViewTransition ||
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    update();
    return;
  }
  activeTransition = true;
  try {
    const transition = doc.startViewTransition(update);
    // The View Transitions API rejects ready when superseded; consume both
    // promises to avoid unhandled browser errors and preserve the UI fallback.
    void transition.ready.catch(() => {});
    void transition.finished.catch(() => {}).finally(() => { activeTransition = false; });
  } catch {
    activeTransition = false;
    update();
  }
}
