/** Progressive enhancement for animated A2UI surface updates.
 * Works with native View Transitions where available and falls back to the
 * same synchronous update for SSR, reduced motion and unsupported browsers.
 */
export function withInteractionTransition(update: () => void): void {
  if (typeof document === 'undefined') {update(); return;}
  const doc = document as Document & {startViewTransition?: (callback: () => void) => {finished: Promise<void>}};
  if (!doc.startViewTransition || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    update();
    return;
  }
  try {
    void doc.startViewTransition(() => update()).finished.catch(() => {});
  } catch {
    update();
  }
}
