import * as React from 'react';

export type ItemCapability = 'expandable' | 'dismissible' | 'prioritizable' | 'selectable' | 'actionable';
export type ItemVariant = 'task' | 'approval' | 'notice' | 'incident' | 'report';
export type ItemCallback = () => void | Promise<void>;
export type ItemFeedbackPhase = 'idle' | 'pending' | 'success' | 'error';

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
  /** Authoritative outcome from the host. Never inferred from a gesture alone. */
  feedbackPhase?: ItemFeedbackPhase;
  feedbackMessage?: string;
  onDismiss?: ItemCallback;
  onPrioritize?: ItemCallback;
  onSelect?: ItemCallback;
  onActivate?: ItemCallback;
  onExpand?: ItemCallback;
  className?: string;
}

const SWIPE_COMMIT_PX = 72;
const SWIPE_PREVIEW_PX = 110;

/** CSS-safe, stable identity used for native View Transitions without injecting arbitrary CSS. */
export function interactionMotionId(id: string): string {
  return 'a2ui-item-' + Array.from(new TextEncoder().encode(id), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The component owns interaction affordances and short gestures. The host owns
 * permissions, mutation results, error messages and removal from the collection.
 */
export function InteractiveItem({
  itemId, title, description, details, capabilities, variant = 'task', status, metadata,
  prioritized = false, selected = false, actionLabel = 'Open', feedbackPhase = 'idle',
  feedbackMessage, onDismiss, onPrioritize, onSelect, onActivate, onExpand, className,
}: InteractiveItemProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [swipe, setSwipe] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const origin = React.useRef<{x: number; y: number} | null>(null);
  const releaseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);
  const moreId = React.useId();
  const enabled = (capability: ItemCapability) => capabilities.includes(capability);
  const locked = feedbackPhase === 'pending' || busy !== null;
  const canDismiss = enabled('dismissible') && Boolean(onDismiss);
  const canPrioritize = enabled('prioritizable') && Boolean(onPrioritize);
  const canSelect = enabled('selectable') && Boolean(onSelect);
  const canActivate = enabled('actionable') && Boolean(onActivate);
  const hasMenu = canDismiss || canPrioritize;

  React.useEffect(() => () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [menuOpen]);

  const invoke = React.useCallback(async (name: string, callback?: ItemCallback) => {
    if (!callback || locked) return;
    setBusy(name);
    setLocalError(null);
    setMenuOpen(false);
    try {
      // A2UI callbacks may return void immediately. Only feedbackPhase from the
      // host can confirm completion; do not show a false local success toast.
      await callback();
    } catch {
      setLocalError(name + ' failed. Try again.');
    } finally {
      setBusy(null);
    }
  }, [locked]);

  const expand = () => {
    if (!enabled('expandable')) return;
    setExpanded(value => !value);
    if (onExpand) void invoke('Expand', onExpand);
  };
  const ignoredTarget = (target: EventTarget) =>
    Boolean((target as HTMLElement).closest('button, a, input, textarea, select, [role="menu"]'));
  const cancelGesture = () => {
    origin.current = null;
    setDragging(false);
    setSwipe(0);
  };
  const pointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!canDismiss || locked || event.pointerType !== 'touch' || ignoredTarget(event.target)) return;
    origin.current = {x: event.clientX, y: event.clientY};
  };
  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!origin.current || committing) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      cancelGesture();
      return;
    }
    if (dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      setDragging(true);
      setSwipe(Math.max(-SWIPE_PREVIEW_PX, Math.min(0, dx)));
    }
  };
  const pointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = origin.current;
    origin.current = null;
    setDragging(false);
    if (!start || !canDismiss || locked) {setSwipe(0); return;}
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (dx < -SWIPE_COMMIT_PX && Math.abs(dy) < 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setSwipe(-SWIPE_PREVIEW_PX);
      setCommitting(true);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => {
        setSwipe(0);
        setCommitting(false);
        releaseTimer.current = null;
      }, 260);
      void invoke('Dismiss', onDismiss);
    } else {
      setSwipe(0);
    }
  };
  const symbol = {task:'◇', approval:'✓', notice:'✦', incident:'!', report:'▤'}[variant];
  const label = {task:'Task', approval:'Approval', notice:'Notification', incident:'Incident', report:'Report'}[variant];
  const displayedMessage = feedbackMessage || (feedbackPhase === 'pending' ? 'Working…'
    : feedbackPhase === 'success' ? 'Saved' : feedbackPhase === 'error' ? 'Action failed' : '');
  const feedback = localError || (feedbackPhase !== 'idle' ? displayedMessage : '');
  const feedbackError = Boolean(localError) || feedbackPhase === 'error';

  return <article className={[
      'a2ui-interaction-item', 'a2ui-interaction-item--' + variant,
      selected ? 'is-selected' : '', prioritized ? 'is-prioritized' : '',
      dragging ? 'is-dragging' : '', committing ? 'is-committing' : '',
      locked ? 'is-pending' : '', className ?? '',
    ].join(' ')}
    data-item-id={itemId}
    data-feedback-phase={feedbackPhase}
    aria-busy={feedbackPhase === 'pending'}
    style={{'--swipe-x': swipe + 'px', viewTransitionName: interactionMotionId(itemId)} as React.CSSProperties}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
    onPointerCancel={cancelGesture}
    onDoubleClick={event => {
      if (canPrioritize && !ignoredTarget(event.target)) void invoke('Prioritize', onPrioritize);
    }}>
    <div className="a2ui-interaction-item__swipe-hint" aria-hidden="true">{swipe < -SWIPE_COMMIT_PX ? 'Release to dismiss' : 'Swipe to dismiss'}</div>
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
            aria-pressed={selected} disabled={locked}
            onClick={() => void invoke('Select', onSelect)}>{selected ? '☑' : '□'}</button>}
          {canPrioritize && <button type="button" className={'a2ui-interaction-item__icon-button '+(prioritized?'is-prioritized':'')}
            aria-label={prioritized ? 'Prioritized' : 'Prioritize'} title="Toggle priority"
            aria-pressed={prioritized} disabled={locked}
            onClick={() => void invoke('Prioritize', onPrioritize)}>{prioritized ? '★' : '☆'}</button>}
          {hasMenu && <div ref={menuRef} className="a2ui-interaction-item__menu-wrap">
            <button ref={menuTriggerRef} type="button" className="a2ui-interaction-item__icon-button"
              aria-label="Item actions" aria-haspopup="menu" aria-expanded={menuOpen} disabled={locked}
              onClick={() => setMenuOpen(open => !open)}>···</button>
            {menuOpen && <div className="a2ui-interaction-item__menu" role="menu"
              onKeyDown={event => {
                if (event.key === 'Escape') {setMenuOpen(false); menuTriggerRef.current?.focus(); return;}
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
                  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  const delta = event.key === 'ArrowDown' ? 1 : -1;
                  buttons[(current + delta + buttons.length) % buttons.length]?.focus();
                }
              }}>
              {canPrioritize && <button type="button" role="menuitem" disabled={locked}
                onClick={() => void invoke('Prioritize', onPrioritize)}>{prioritized ? 'Remove priority' : 'Prioritize'}</button>}
              {canDismiss && <button type="button" role="menuitem" className="is-danger" disabled={locked}
                onClick={() => void invoke('Dismiss', onDismiss)}>Dismiss</button>}
            </div>}
          </div>}
        </div>
      </div>
      <div className="a2ui-interaction-item__footer">
        <div className="a2ui-interaction-item__actions">
          {enabled('expandable') && <button type="button" className="a2ui-interaction-item__text-button"
            aria-label={expanded ? 'Less' : 'More'} aria-expanded={expanded}
            aria-controls={details != null ? moreId : undefined} onClick={expand}>
            {expanded ? 'Hide details ↑' : 'View details ↗'}
          </button>}
        </div>
        {canActivate && <button type="button" className="a2ui-interaction-item__primary"
          disabled={locked} onClick={() => void invoke('Activate', onActivate)}>
          {locked ? 'Working…' : actionLabel} <span aria-hidden="true">↗</span>
        </button>}
      </div>
      {enabled('expandable') && expanded && details != null && <section id={moreId}
        className="a2ui-interaction-item__details">{details}</section>}
      {feedback && <div className={'a2ui-interaction-item__feedback ' + (feedbackError ? 'is-error' : 'is-' + feedbackPhase)}
        role={feedbackError ? 'alert' : 'status'} aria-live={feedbackError ? 'assertive' : 'polite'}>
        {feedbackPhase === 'pending' && !localError && <span className="a2ui-interaction-item__spinner" aria-hidden="true"/>}
        {feedbackPhase === 'success' && !localError && <span aria-hidden="true">✓</span>}
        {feedbackError && <span aria-hidden="true">!</span>}
        <span>{feedback}</span>
      </div>}
      <div className="a2ui-interaction-item__status" role="status" aria-live="polite">{busy && feedbackPhase === 'idle' ? busy + '…' : ''}</div>
    </div>
  </article>;
}
