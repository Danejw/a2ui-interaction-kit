import {EventType} from '@ag-ui/core';

export const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
export const INTERACTION_CATALOG_ID = 'https://github.com/Danejw/a2ui-interaction-kit/blob/main/catalog/catalog.json';

export type Capability = 'expandable' | 'dismissible' | 'prioritizable' | 'selectable' | 'actionable';
export type ScenarioId = 'mission' | 'approvals' | 'recovery' | 'permissions' | 'streaming' | 'multi' | 'stress';
export type Scenario = {id: ScenarioId; name: string; description: string; category: string};
export type Item = {
  id: string; title: string; description: string; details: string; surface: string;
  capabilities: Capability[]; prioritized: boolean; selected: boolean; dismissed: boolean; completed: boolean;
};
export type AgentEvent = {type: string; [key: string]: unknown};
export type LabTrace = {sequence: number; direction: 'agent → UI' | 'UI → agent' | 'host'; time: string; payload: unknown};
export type LabRecord = {format: 'interaction-lab-recording'; version: 1; scenario: ScenarioId; events: AgentEvent[]};
export type LabState = {items: Item[]; lastError: string | null; denied: boolean; failNext: boolean; latency: number; running: boolean; paused: boolean};

export const SCENARIOS: Scenario[] = [
  {id: 'mission', name: 'Mission Control', description: 'Expand, select, prioritize, dismiss and undo agent tasks.', category: 'Core'},
  {id: 'approvals', name: 'Approval Queue', description: 'Review and approve requests through real A2UI actions.', category: 'Actions'},
  {id: 'recovery', name: 'Error & Recovery', description: 'Force a failed operation, then retry safely.', category: 'Resilience'},
  {id: 'permissions', name: 'Permission Denied', description: 'Reject unauthorized mutations without changing the UI state.', category: 'Security'},
  {id: 'streaming', name: 'Streaming Updates', description: 'Create an A2UI surface, then send incremental component and data updates.', category: 'Protocol'},
  {id: 'multi', name: 'Multiple Surfaces', description: 'Independent surface IDs, cards, actions, and state.', category: 'Protocol'},
  {id: 'stress', name: 'Stress Test', description: '30 interactive items and repeated dispatch protection.', category: 'Performance'},
];

const baseCapabilities: Capability[] = ['expandable', 'dismissible', 'prioritizable', 'selectable', 'actionable'];
const item = (id: string, title: string, description: string, details: string, surface = 'main'): Item =>
  ({id, title, description, details, surface, capabilities: [...baseCapabilities],
    prioritized: false, selected: false, dismissed: false, completed: false});

export function initialItems(scenario: ScenarioId): Item[] {
  switch (scenario) {
    case 'mission': return [
      item('match-01', 'Contractor match review', '3 candidates need approval', 'Compare qualifications, license classification and project fit.'),
      item('ingest-02', 'Document ingestion', 'A worker needs your attention', 'Inspect download attempts, HTTP responses and evidence.'),
      item('plan-03', 'Website migration plan', 'Ready for your review', 'Review scope, migration checklist and deployment strategy.'),
      item('agent-04', 'Outreach follow-up', '12 replies reviewed', 'Check follow-up drafts before scheduling the next outreach batch.'),
    ];
    case 'approvals': return [
      item('approval-01', 'Approve shortlist', 'Three candidates are ready', 'Approval only changes this simulated task.'),
      item('approval-02', 'Approve implementation plan', 'Awaiting sign-off', 'Review the scope and expected outcomes.'),
    ];
    case 'recovery': return [item('retry-01', 'Retry document download', 'First attempt will fail', 'The simulator fails the next operation so the UI can demonstrate recovery.')];
    case 'permissions': return [item('restricted-01', 'Restricted operation', 'Authorization denied by the host', 'The UI can request an action, but the host must still reject it.')];
    case 'streaming': return [
      item('stream-01', 'Collect agent outputs', 'First step', 'Additional items arrive after the initial A2UI surface.'),
      item('stream-02', 'Summarize verified results', 'Second step', 'Added through an incremental updateComponents message.'),
      item('stream-03', 'Request final review', 'Third step', 'Added after an additional AG-UI activity snapshot.'),
    ];
    case 'multi': return [
      item('left-01', 'Agent Alpha', 'Research is complete', 'This item belongs to its own A2UI surface.', 'alpha'),
      item('left-02', 'Agent Alpha report', 'Ready to review', 'Actions only affect this item.', 'alpha'),
      item('right-01', 'Agent Beta', 'Awaiting approval', 'This is a separate A2UI surface.', 'beta'),
    ];
    case 'stress': return Array.from({length: 30}, (_, n) =>
      item('stress-' + String(n + 1).padStart(2, '0'), 'Task ' + (n + 1),
        n % 3 === 0 ? 'Needs review' : 'Running in simulation', 'Scenario item ' + (n + 1)));
  }
}

/** Stable A2UI UAX #31 identifiers, independent of arbitrary business item IDs. */
export function componentId(kind: 'item' | 'detail', itemId: string): string {
  return kind + Array.from(new TextEncoder().encode(itemId),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

export function parseAction(raw: unknown): {name: string; itemId: string; surfaceId?: string} | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Record<string, unknown>;
  const action = (payload.action && typeof payload.action === 'object' ? payload.action : payload) as Record<string, unknown>;
  const context = action.context && typeof action.context === 'object' ? action.context as Record<string, unknown> : {};
  if (typeof action.name !== 'string' || typeof context.itemId !== 'string') return null;
  return {name: action.name, itemId: context.itemId, surfaceId: typeof action.surfaceId === 'string' ? action.surfaceId : undefined};
}

type EventListener = (event: AgentEvent) => void;
type StateListener = (state: LabState) => void;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Emits normal AG-UI 1.0 event envelopes; no model or network connection required. */
export class SimulatedAgent {
  readonly scenario: ScenarioId;
  private events: AgentEvent[] = [];
  private listeners = new Set<EventListener>();
  private stateListeners = new Set<StateListener>();
  private runNumber = 0;
  private surfaceIds = new Set<string>();
  private inFlight = new Set<string>();
  private disposed = false;
  private previousDismissedId: string | null = null;
  private state: LabState;

  constructor(scenario: ScenarioId) {
    this.scenario = scenario;
    this.state = {items: initialItems(scenario), lastError: null,
      denied: scenario === 'permissions', failNext: scenario === 'recovery',
      latency: 100, running: false, paused: false};
  }

  get snapshot(): LabState { return clone(this.state); }
  get recording(): LabRecord {return {format: 'interaction-lab-recording', version: 1, scenario: this.scenario, events: clone(this.events)};}
  get canUndo(): boolean {return this.previousDismissedId !== null;}
  clearError(): void {this.state.lastError = null; this.notify();}
  subscribe(listener: EventListener): () => void {this.listeners.add(listener); return () => this.listeners.delete(listener);}
  subscribeState(listener: StateListener): () => void {this.stateListeners.add(listener); return () => this.stateListeners.delete(listener);}
  dispose(): void {this.disposed = true; this.listeners.clear(); this.stateListeners.clear();}
  setOptions(options: Partial<Pick<LabState, 'denied' | 'failNext' | 'latency' | 'paused'>>): void {
    this.state = {...this.state, ...options};
    this.notify();
  }
  private notify(): void {if (!this.disposed) for (const listener of this.stateListeners) listener(this.snapshot);}
  private emit(event: AgentEvent): void {
    if (this.disposed) return;
    this.events.push(clone(event));
    for (const listener of this.listeners) listener(event);
  }
  private async wait(): Promise<void> {
    while (this.state.paused && !this.disposed) await delay(40);
    if (this.state.latency > 0 && !this.disposed) await delay(this.state.latency);
    while (this.state.paused && !this.disposed) await delay(40);
  }
  private start(): string {
    const runId = 'sim-run-' + (++this.runNumber);
    this.state.running = true;
    this.state.lastError = null;
    this.notify();
    this.emit({type: EventType.RUN_STARTED, threadId: 'interaction-lab-' + this.scenario, runId});
    return runId;
  }
  private finish(runId: string): void {
    this.emit({type: EventType.RUN_FINISHED, threadId: 'interaction-lab-' + this.scenario, runId});
    this.state.running = false;
    this.notify();
  }
  private fail(runId: string, message: string): void {
    this.state.lastError = message;
    this.emit({type: EventType.RUN_ERROR, message});
    this.state.running = false;
    this.notify();
  }
  private surfaceNames(): string[] {
    return this.scenario === 'multi' ? ['alpha', 'beta'] : ['main'];
  }
  private component(itemData: Item): Record<string, unknown> {
    const {id, title, description, details, capabilities, prioritized, selected, completed} = itemData;
    const makeAction = (name: string) => ({event: {name, context: {itemId: id}}});
    return {
      id: componentId('item', id),
      component: 'InteractiveItem',
      'catalogId': INTERACTION_CATALOG_ID,
      itemId: id, title, description: completed ? 'Approved in simulator' : description,
      actionLabel: 'Approve',
      capabilities, prioritized, selected,
      children: [componentId('detail', id)],
      onDismiss: makeAction('dismiss_item'),
      onPrioritize: makeAction('prioritize_item'),
      onSelect: makeAction('select_item'),
      onActivate: makeAction('activate_item'),
    };
  }
  private components(surface: string, limit = Number.POSITIVE_INFINITY): Record<string, unknown>[] {
    const visible = this.state.items.filter(x => x.surface === surface && !x.dismissed).slice(0, limit);
    return [
      {id: 'root', component: 'Column', children: ['heading', ...visible.map(x => componentId('item', x.id))]},
      {id: 'heading', component: 'Text', text: surface === 'main' ? SCENARIOS.find(x => x.id === this.scenario)?.name ?? 'Interaction Lab' : 'Agent ' + surface},
      ...visible.flatMap(x => [this.component(x), {id: componentId('detail', x.id), component: 'Text', text: x.details}]),
    ];
  }
  private activity(operations: Record<string, unknown>[], surface: string): void {
    this.emit({
      type: EventType.ACTIVITY_SNAPSHOT, messageId: 'a2ui-surface-' + surface,
      activityType: 'a2ui-surface', replace: true, content: {a2ui_operations: operations},
    });
  }
  private stateEvent(): void {
    this.emit({type: EventType.STATE_SNAPSHOT, snapshot: {scenario: this.scenario, items: clone(this.state.items)}});
  }
  async run(): Promise<void> {
    const runId = this.start();
    for (const surface of this.surfaceNames()) {
      await this.wait();
      if (this.disposed) return;
      const available = this.state.items.filter(x => x.surface === surface);
      const initialLimit = this.scenario === 'streaming' ? 1 : available.length;
      const ops: Record<string, unknown>[] = [
        {version: '1.0', createSurface: {surfaceId: surface, catalogId: BASIC_CATALOG_ID}},
        {version: '1.0', updateComponents: {surfaceId: surface, components: this.components(surface, initialLimit)}},
      ];
      this.activity(ops, surface);
      this.surfaceIds.add(surface);
      if (this.scenario === 'streaming') {
        for (let count = 2; count <= available.length; count++) {
          await this.wait();
          if (this.disposed) return;
          this.activity([{version: '1.0', updateComponents: {surfaceId: surface, components: this.components(surface, count)}}], surface);
        }
      }
    }
    this.stateEvent();
    this.finish(runId);
  }
  /** ActionPayload originates in the real A2UI renderer, then enters an AG-UI run. */
  async submitAction(payload: unknown): Promise<boolean> {
    const action = parseAction(payload);
    if (!action) {this.state.lastError = 'Malformed A2UI action'; this.notify(); return false;}
    const itemData = this.state.items.find(x => x.id === action.itemId);
    if (!itemData || itemData.dismissed || (action.surfaceId && itemData.surface !== action.surfaceId)) {
      this.state.lastError = 'Unknown item or surface'; this.notify(); return false;
    }
    const behavior = {
      dismiss_item: 'dismissible', prioritize_item: 'prioritizable',
      select_item: 'selectable', activate_item: 'actionable',
    }[action.name] as Capability | undefined;
    if (!behavior || !itemData.capabilities.includes(behavior)) {
      this.state.lastError = 'Action is not permitted by this item'; this.notify(); return false;
    }
    if (this.inFlight.has(itemData.id)) {this.state.lastError = 'An action is already pending'; this.notify(); return false;}
    this.inFlight.add(itemData.id);
    const runId = this.start();
    try {
      await this.wait();
      if (this.disposed) return false;
      if (this.state.denied) throw new Error('Permission denied by simulated host');
      if (this.state.failNext) {
        this.state.failNext = false;
        throw new Error('Simulated backend failure. Retry the action.');
      }
      if (action.name === 'dismiss_item') {itemData.dismissed = true; this.previousDismissedId = itemData.id;}
      if (action.name === 'prioritize_item') itemData.prioritized = !itemData.prioritized;
      if (action.name === 'select_item') itemData.selected = !itemData.selected;
      if (action.name === 'activate_item') itemData.completed = !itemData.completed;
      this.activity([{version: '1.0', updateComponents: {surfaceId: itemData.surface, components: this.components(itemData.surface)}}], itemData.surface);
      this.stateEvent();
      this.finish(runId);
      return true;
    } catch (error) {
      this.fail(runId, error instanceof Error ? error.message : 'Unknown simulator failure');
      return false;
    } finally {this.inFlight.delete(itemData.id);}
  }
  async undoLast(): Promise<boolean> {
    if (!this.previousDismissedId) return false;
    const found = this.state.items.find(x => x.id === this.previousDismissedId);
    if (!found) return false;
    const runId = this.start();
    await this.wait();
    if (this.disposed) return false;
    if (this.state.denied) {this.fail(runId, 'Permission denied for undo'); return false;}
    found.dismissed = false;
    this.previousDismissedId = null;
    this.activity([{version: '1.0', updateComponents: {surfaceId: found.surface, components: this.components(found.surface)}}], found.surface);
    this.stateEvent();
    this.finish(runId);
    return true;
  }
}

export function validateRecording(input: unknown): LabRecord {
  if (!input || typeof input !== 'object') throw new Error('Invalid recording');
  const record = input as Partial<LabRecord>;
  if (record.format !== 'interaction-lab-recording' || record.version !== 1 ||
    !SCENARIOS.some(x => x.id === record.scenario) || !Array.isArray(record.events) || record.events.length > 1000 ||
    !record.events.every(x => x && typeof x === 'object' && typeof x.type === 'string')) {
    throw new Error('Unrecognized or oversized recording');
  }
  return clone(record as LabRecord);
}

/** Replays the actual recorded protocol envelopes to the same A2UI event consumer. */
export async function replayRecording(record: LabRecord, emit: EventListener, pauseMs = 0): Promise<void> {
  const verified = validateRecording(record);
  for (const event of verified.events) {
    if (pauseMs) await delay(pauseMs);
    emit(event);
  }
}
