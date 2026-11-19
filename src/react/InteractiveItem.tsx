import * as React from 'react';

export type ItemCapability = 'expandable' | 'dismissible' | 'prioritizable' | 'selectable' | 'actionable';
export type ItemVariant = 'task' | 'approval' | 'notice' | 'incident' | 'report';
export type ItemCallback = () => void | Promise<void>;

export interface InteractiveItemProps {
  itemId: string;
  title: string;
  description?: string;
  details?: React.ReactNode;
  capabilities: readonly ItemCapability[];
  variant?: ItemVariant;
  status?: string;
  metadata?: string;
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

/** Semantic behavior shared across A2UI-generated task, approval, incident and notification surfaces. */
export function InteractiveItem({
  itemId, title, description, details, capabilities, variant = 'task', status, metadata,
  prioritized = false, selected = false, actionLabel = 'Open', onDismiss, onPrioritize,
  onSelect, onActivate, onExpand, className,
}: InteractiveItemProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [swipe, setSwipe] = React.useState(0);
  const origin = React.useRef<{x: number; y: number} | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const moreId = React.useId();
  const detailsPresent = details != null;
  const enabled = (capability: ItemCapability) => capabilities.includes(capability);
  const canDismiss = enabled('dismissible') && Boolean(onDismiss);
  const canPrioritize = enabled('prioritizable') && Boolean(onPrioritize);
  const canSelect = enabled('selectable') && Boolean(onSelect);
  const canActivate = enabled('actionable') && Boolean(onActivate);
  const hasMenu = canDismiss || canPrioritize;

  React.useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [menuOpen]);

  const invoke = React.useCallback(async (name: string, callback?: ItemCallback) => {
    if (!callback || busy !== null) return;
    setBusy(name);
    setError(null);
    setMenuOpen(false);
    try { await callback(); }
    catch { setError(name + ' failed. Try again.'); }
    finally { setBusy(null); }
  }, [busy]);

  const expand = () => {
    if (!enabled('expandable')) return;
    setExpanded(value => !value);
    if (onExpand) void invoke('Expand', onExpand);
  };
  const ignoredTarget = (target: EventTarget) =>
    Boolean((target as HTMLElement).closest('button, a, input, textarea, select, [role="menu"]'));
  const pointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!canDismiss || event.pointerType !== 'touch' || ignoredTarget(event.target)) return;
    origin.current = {x: event.clientX, y: event.clientY};
  };
  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!origin.current) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setSwipe(Math.max(-110, Math.min(0, dx)));
    }
  };
  const pointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = origin.current;
    origin.current = null;
    setSwipe(0);
    if (!start || !canDismiss) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX < -72 && Math.abs(deltaY) < 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      void invoke('Dismiss', onDismiss);
    }
  };
  const symbol = {task:'◇', approval:'✓', notice:'✦', incident:'!', report:'▤'}[variant];
  const label = {task:'Task', approval:'Approval', notice:'Notification', incident:'Incident', report:'Report'}[variant];

  return <article className={['a2ui-interaction-item', 'a2ui-interaction-item--' + variant,
      selected ? 'is-selected' : '', swipe < -50 ? 'is-swiping' : '', className ?? ''].join(' ')}
    data-item-id={itemId} style={{'--swipe-x': swipe + 'px'} as React.CSSProperties}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
    onPointerCancel={() => {origin.current = null; setSwipe(0);}}
    onDoubleClick={event => {
      if (canPrioritize && !ignoredTarget(event.target)) void invoke('Prioritize', onPrioritize);
    }}>
    <div className="a2ui-interaction-item__swipe-hint" aria-hidden="true">Dismiss →</div>
    <div className="a2ui-interaction-item__body">
      <div className="a2ui-interaction-item__topline">
        <span className={'a2ui-interaction-item__category a2ui-interaction-item__category--'+variant}>
          <span aria-hidden="true">{symbol}</span> {label}
        </span>
        {status && <span className="a2ui-interaction-item__badge">{status}</span>}
        {metadata && <span className="a2ui-interaction-item__meta">{metadata}</span>}
      </div>
      <div className="a2ui-interaction-item__heading">
        <div className="a2ui-interaction-item__copy"><strong>{title}</strong>
          {description && <p>{description}</p>}</div>
        <div className="a2ui-interaction-item__quick">
          {canSelect && <button type="button" className="a2ui-interaction-item__icon-button"
            aria-label={selected ? 'Selected' : 'Select'} title={selected ? 'Deselect' : 'Select'}
            aria-pressed={selected} disabled={busy !== null}
            onClick={() => void invoke('Select', onSelect)}>{selected ? '☑' : '□'}</button>}
          {canPrioritize && <button type="button" className={'a2ui-interaction-item__icon-button '+(prioritized?'is-prioritized':'')}
            aria-label={prioritized ? 'Prioritized' : 'Prioritize'} title="Toggle priority"
            aria-pressed={prioritized} disabled={busy !== null}
            onClick={() => void invoke('Prioritize', onPrioritize)}>{prioritized ? '★' : '☆'}</button>}
          {hasMenu && <div ref={menuRef} className="a2ui-interaction-item__menu-wrap">
            <button type="button" className="a2ui-interaction-item__icon-button"
              aria-label="Item actions" aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}>···</button>
            {menuOpen && <div className="a2ui-interaction-item__menu" role="menu"
              onKeyDown={event => {if (event.key === 'Escape') setMenuOpen(false);}}>
              {canPrioritize && <button type="button" role="menuitem" disabled={busy !== null}
                onClick={() => void invoke('Prioritize', onPrioritize)}>{prioritized ? 'Remove priority' : 'Prioritize'}</button>}
              {canDismiss && <button type="button" role="menuitem" className="is-danger" disabled={busy !== null}
                onClick={() => void invoke('Dismiss', onDismiss)}>Dismiss</button>}
            </div>}
          </div>}
        </div>
      </div>
      <div className="a2ui-interaction-item__footer">
        <div className="a2ui-interaction-item__actions">
          {enabled('expandable') && <button type="button" className="a2ui-interaction-item__text-button"
            aria-label={expanded ? 'Less' : 'More'} aria-expanded={expanded}
            aria-controls={detailsPresent ? moreId : undefined} onClick={expand}>
            {expanded ? 'Hide details ↑' : 'View details ↗'}
          </button>}
        </div>
        {canActivate && <button type="button" className="a2ui-interaction-item__primary"
          disabled={busy !== null} onClick={() => void invoke('Activate', onActivate)}>
          {busy === 'Activate' ? 'Working…' : actionLabel} <span aria-hidden="true">↗</span>
        </button>}
      </div>
      {enabled('expandable') && expanded && detailsPresent && <section id={moreId}
        className="a2ui-interaction-item__details">{details}</section>}
      <div className="a2ui-interaction-item__status" role="status" aria-live="polite">
        {busy ? busy + '…' : error ?? ''}
      </div>
    </div>
  </article>;
}
