import * as React from 'react';

export type ItemCapability = 'expandable' | 'dismissible' | 'prioritizable' | 'selectable' | 'actionable';
export type ItemCallback = () => void | Promise<void>;

export interface InteractiveItemProps {
  itemId: string;
  title: string;
  description?: string;
  details?: React.ReactNode;
  capabilities: readonly ItemCapability[];
  prioritized?: boolean;
  selected?: boolean;
  actionLabel?: string;
  onDismiss?: ItemCallback;
  onPrioritize?: ItemCallback;
  onSelect?: ItemCallback;
  onActivate?: ItemCallback;
  onExpand?: ItemCallback;
  className?: string;
}

/**
 * Local expansion, accessible button equivalents, swipe-to-dismiss and double-click
 * to prioritize. App-specific callbacks are required for external mutations.
 * The host owns persisted state and updates prioritized/selected/removed items.
 */
export function InteractiveItem({
  itemId, title, description, details, capabilities, prioritized = false, selected = false,
  actionLabel = 'Open', onDismiss, onPrioritize, onSelect, onActivate, onExpand, className,
}: InteractiveItemProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const touchOrigin = React.useRef<{x: number; y: number} | null>(null);
  const enabled = (capability: ItemCapability) => capabilities.includes(capability);
  const canDismiss = enabled('dismissible') && Boolean(onDismiss);
  const canPrioritize = enabled('prioritizable') && Boolean(onPrioritize);
  const canSelect = enabled('selectable') && Boolean(onSelect);
  const canActivate = enabled('actionable') && Boolean(onActivate);

  const invoke = React.useCallback(async (name: string, callback?: ItemCallback) => {
    if (!callback || busy !== null) return;
    setBusy(name);
    setError(null);
    try {await callback();}
    catch {setError(`${name} failed. Try again.`);}
    finally {setBusy(null);}
  }, [busy]);

  const expand = () => {
    if (!enabled('expandable')) return;
    setExpanded(value => !value);
    if (onExpand) void invoke('Expand', onExpand);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!canDismiss || event.pointerType !== 'touch') return;
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    touchOrigin.current = {x: event.clientX, y: event.clientY};
  };
  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const origin = touchOrigin.current;
    touchOrigin.current = null;
    if (!origin || !canDismiss) return;
    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;
    if (deltaX < -72 && Math.abs(deltaY) < 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      void invoke('Dismiss', onDismiss);
    }
  };

  const moreId = React.useId();
  const hasDetails = details != null;
  return (
    <article className={`a2ui-interaction-item ${className ?? ''}`} data-item-id={itemId}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => {touchOrigin.current = null;}}
      onDoubleClick={event => {
        if (canPrioritize && !(event.target as HTMLElement).closest('button, a, input')) void invoke('Prioritize', onPrioritize);
      }}>
      <div className="a2ui-interaction-item__heading">
        <div className="a2ui-interaction-item__copy">
          <strong>{title}</strong>
          {description && <p>{description}</p>}
        </div>
        {canSelect && <button type="button" className="a2ui-interaction-item__button" aria-pressed={selected}
          disabled={busy !== null} onClick={() => void invoke('Select', onSelect)}>{selected ? 'Selected' : 'Select'}</button>}
      </div>
      <div className="a2ui-interaction-item__actions">
        {enabled('expandable') && <button type="button" className="a2ui-interaction-item__button"
          aria-expanded={expanded} aria-controls={hasDetails ? moreId : undefined}
          onClick={expand}>{expanded ? 'Less' : 'More'}</button>}
        {canPrioritize && <button type="button" className="a2ui-interaction-item__button" disabled={busy !== null}
          aria-pressed={prioritized} onClick={() => void invoke('Prioritize', onPrioritize)}>{prioritized ? 'Prioritized' : 'Prioritize'}</button>}
        {canActivate && <button type="button" className="a2ui-interaction-item__button" disabled={busy !== null}
          onClick={() => void invoke('Activate', onActivate)}>{actionLabel}</button>}
        {canDismiss && <button type="button" className="a2ui-interaction-item__button" disabled={busy !== null}
          onClick={() => void invoke('Dismiss', onDismiss)}>Dismiss</button>}
      </div>
      {enabled('expandable') && expanded && hasDetails && <section id={moreId} className="a2ui-interaction-item__details">{details}</section>}
      <div className="a2ui-interaction-item__status" role="status" aria-live="polite">{busy ? `${busy}…` : error ?? ''}</div>
    </article>
  );
}
