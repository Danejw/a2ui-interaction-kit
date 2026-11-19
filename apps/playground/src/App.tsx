import * as React from 'react';
import {A2uiSurface} from '@a2ui/react';
import {MessageProcessor} from '@a2ui/web_core';
import {basicCatalog} from '@a2ui/web_core/catalogs/basic/v1';
import {interactionCatalog} from '@danejw/a2ui-interaction-kit/a2ui/react';
import '@danejw/a2ui-interaction-kit/react/styles.css';
import {SCENARIOS, SimulatedAgent, replayRecording, validateRecording, type AgentEvent, type LabRecord, type LabTrace, type ScenarioId} from './lab';
import './styles.css';

const format = (value: unknown) => JSON.stringify(value, null, 2);
const describeEvent = (event: AgentEvent) => {
  if (event.type === 'ACTIVITY_SNAPSHOT') return 'A2UI surface update';
  if (event.type === 'STATE_SNAPSHOT') return 'State synchronization';
  if (event.type === 'RUN_STARTED') return 'Agent run started';
  if (event.type === 'RUN_FINISHED') return 'Agent run finished';
  if (event.type === 'RUN_ERROR') return 'Agent run failed';
  return event.type;
};

export default function App() {
  const [scenario, setScenario] = React.useState<ScenarioId>('mission');
  const [epoch, setEpoch] = React.useState(0);
  const [playback, setPlayback] = React.useState<LabRecord | null>(null);
  const selectScenario = (next: ScenarioId) => {setScenario(next); setPlayback(null); setEpoch(x => x + 1);};
  const reset = () => {setPlayback(null); setEpoch(x => x + 1);};
  const play = (record: LabRecord) => {setScenario(record.scenario); setPlayback(record); setEpoch(x => x + 1);};
  return <LabSession key={scenario + '-' + epoch} scenario={scenario} onSelectScenario={selectScenario}
    onReset={reset} playback={playback} onPlay={play}/>;
}

type SessionProps = {
  scenario: ScenarioId;
  onSelectScenario: (scenario: ScenarioId) => void;
  onReset: () => void;
  playback: LabRecord | null;
  onPlay: (record: LabRecord) => void;
};

function LabSession({scenario, onSelectScenario, onReset, playback, onPlay}: SessionProps) {
  const agent = React.useMemo(() => new SimulatedAgent(scenario), [scenario]);
  const [agentState, setAgentState] = React.useState(agent.snapshot);
  const [trace, setTrace] = React.useState<LabTrace[]>([]);
  const [surfaces, setSurfaces] = React.useState<ReturnType<typeof getSurfaces>>([]);
  const [selectedTrace, setSelectedTrace] = React.useState<number | null>(null);
  const [traceFilter, setTraceFilter] = React.useState('all');
  const [viewport, setViewport] = React.useState<'desktop' | 'mobile'>('desktop');
  const [mobilePanel, setMobilePanel] = React.useState<'preview' | 'trace'>('preview');
  const [scenarioSearch, setScenarioSearch] = React.useState('');
  const [traceSearch, setTraceSearch] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const step = React.useRef(0);
  const addTrace = React.useCallback((direction: LabTrace['direction'], payload: unknown) => {
    const sequence = ++step.current;
    setTrace(prev => [...prev, {sequence, direction, time: new Date().toLocaleTimeString(), payload}].slice(-500));
  }, []);

  const processor = React.useMemo(() => new MessageProcessor([basicCatalog, interactionCatalog], (action) => {
    addTrace('UI → agent', action);
    if (playback) {
      setMessage('Replay is read-only. Reset the scenario to try actions.');
      return;
    }
    void agent.submitAction(action).then(ok =>
      addTrace('host', {type: ok ? 'ACTION_ACK' : 'ACTION_REJECTED', action}));

  }), [agent, addTrace, playback]);

  React.useEffect(() => {
    let live = true;
    const sync = () => {if (live) setSurfaces(getSurfaces(processor));};
    const created = processor.onSurfaceCreated(sync);
    const deleted = processor.onSurfaceDeleted(sync);
    const offState = agent.subscribeState(state => {if (live) setAgentState(state);});
    const consume = (event: AgentEvent) => {
      if (!live) return;
      addTrace('agent → UI', event);
      if (event.type !== 'ACTIVITY_SNAPSHOT' || event.activityType !== 'a2ui-surface') return;
      const content = event.content;
      if (!content || typeof content !== 'object') return;
      const ops = (content as {a2ui_operations?: unknown}).a2ui_operations;
      if (!Array.isArray(ops)) return;
      try {
        processor.processMessages(ops as Parameters<typeof processor.processMessages>[0]);
        sync();
      } catch (error) {
        const cause = error instanceof Error ? error.message : 'A2UI processor rejected the event';
        setMessage(cause);
        addTrace('host', {error: cause, failedEvent: event});
      }
    };
    const offEvents = agent.subscribe(consume);
    if (playback) {
      setMessage('Replaying recorded AG-UI events. Actions are read-only.');
      void replayRecording(playback, consume, 50);
    } else {
      void agent.run();
    }
    return () => {live = false; offEvents(); offState(); created.unsubscribe(); deleted.unsubscribe(); agent.dispose();};
  }, [processor, agent, playback, addTrace]);

  const current = SCENARIOS.find(x => x.id === scenario)!;
  const active = agentState.items.filter(x => !x.dismissed);
  const selected = trace.find(x => x.sequence === selectedTrace) ?? trace.at(-1) ?? null;
  const filtered = trace.filter(x => {
    const categoryMatches = traceFilter === 'all' ||
      (traceFilter === 'events' && x.direction === 'agent → UI') ||
      (traceFilter === 'actions' && x.direction !== 'agent → UI');
    const query = traceSearch.trim().toLowerCase();
    return categoryMatches && (!query || format(x.payload).toLowerCase().includes(query));
  });
  const traceErrors = trace.filter(x => {
    const data = x.payload as AgentEvent;
    return data.type === 'RUN_ERROR' || data.type === 'ACTION_REJECTED' || x.direction === 'host' && Boolean(data.error);
  }).length;
  const traceSummary = (entry: LabTrace): string => {
    const data = entry.payload as AgentEvent;
    if (data.type === 'ACTIVITY_SNAPSHOT') {
      const operations = (data.content as {a2ui_operations?: unknown[]}|undefined)?.a2ui_operations;
      return (operations?.length ?? 0) + ' A2UI operations';
    }
    if (data.type === 'STATE_SNAPSHOT') {
      const items = ((data.snapshot as {items?: {dismissed: boolean}[]}|undefined)?.items ?? []);
      return items.length + ' items · ' + items.filter(x => x.dismissed).length + ' dismissed';
    }
    if (data.type === 'RUN_STARTED' || data.type === 'RUN_FINISHED') return String(data.runId ?? '');
    if (data.type === 'RUN_ERROR') return String(data.message ?? '');
    if (data.type === 'ACTION_ACK') return 'Host confirmed the mutation';
    if (data.type === 'ACTION_REJECTED') return 'Host rejected the mutation';
    const action = data.action as {name?: string}|undefined;
    return action?.name ?? 'Action submitted';
  };
  const stateDifference = (entry: LabTrace | null): string[] => {
    if (!entry || (entry.payload as AgentEvent).type !== 'STATE_SNAPSHOT') return [];
    const currentItems = ((entry.payload as AgentEvent).snapshot as {items?: Record<string, unknown>[]}|undefined)?.items ?? [];
    const preceding = trace.filter(x => x.sequence < entry.sequence && (x.payload as AgentEvent).type === 'STATE_SNAPSHOT').at(-1);
    const oldItems = ((preceding?.payload as AgentEvent|undefined)?.snapshot as {items?: Record<string, unknown>[]}|undefined)?.items ?? [];
    const previousById = new Map(oldItems.map(i => [String(i.id),i]));
    const differences: string[] = [];
    for (const item of currentItems) {
      const before = previousById.get(String(item.id));
      if (!before) { differences.push(String(item.title) + ': added'); continue; }
      for (const field of ['dismissed','selected','prioritized','completed']) {
        if (before[field] !== item[field]) differences.push(String(item.title) + ': ' + field + ' ' + String(before[field]) + ' → ' + String(item[field]));
      }
    }
    return differences;
  };
  const selectedDifference = stateDifference(selected);

  const exportRecording = () => {
    const json = JSON.stringify(playback ?? agent.recording, null, 2);
    const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    const element = document.createElement('a');
    element.href = url; element.download = 'interaction-lab-' + scenario + '.json';
    element.click(); window.setTimeout(() => URL.revokeObjectURL(url), 250);
  };

  const importRecording: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Recording exceeds the 2 MB file limit.');
      const record = validateRecording(JSON.parse(await file.text()) as unknown);
      onPlay(record);
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Could not open recording');}
    event.target.value = '';
  };

  return <div className={'lab-app mobile-show-' + mobilePanel}>
    <header className="topbar">
      <div className="identity">
        <div className="identity-mark">a<span>2</span></div>
        <div><strong>Interaction Lab</strong><small>Composable UI · protocol testing workspace</small></div>
      </div>
      <div className="top-actions">
        <span className="status-chip"><span className={agentState.running ? 'live-dot' : 'idle-dot'}/>
          {playback ? 'Replay mode' : agentState.running ? 'Agent running' : 'Simulator ready'}</span>
        <button className="button button-quiet" type="button" onClick={exportRecording}>Export trace</button>
        <button className="button button-primary" type="button" onClick={onReset}>↻ <span>Reset lab</span></button>
      </div>
    </header>

    <nav className="mobile-tabs" role="tablist" aria-label="Workspace panels">
      <button type="button" role="tab" aria-selected={mobilePanel === 'preview'}
        onClick={() => {setMobilePanel('preview'); window.scrollTo({top:0});}}>◇ Live preview</button>
      <button type="button" role="tab" aria-selected={mobilePanel === 'trace'}
        onClick={() => {setMobilePanel('trace'); window.scrollTo({top:0});}}>≡ Event trace <span>{trace.length}</span></button>
    </nav>
    <div className="workspace">
      <aside className="sidebar" aria-label="Scenarios">
        <div className="section-heading"><small>INTERACTION KIT</small><h2>Scenario library</h2>
          <p>Real components, simulated agents.</p></div>
        <label className="scenario-search"><span className="sr-only">Find scenario</span>
          <input type="search" placeholder="⌕ Search scenarios" value={scenarioSearch}
            onChange={e => setScenarioSearch(e.target.value)}/></label>
        <div className="scenario-list">
          {SCENARIOS.filter(s => (s.name + s.category).toLowerCase().includes(scenarioSearch.toLowerCase())).map((s, index) =>
          <button type="button" key={s.id} className={'scenario '+(scenario === s.id ? 'active' : '')}
            aria-pressed={scenario === s.id} onClick={() => onSelectScenario(s.id)}>
            <span className="scenario-index">{String(index+1).padStart(2,'0')}</span>
            <span className="scenario-name">{s.name}</span><small>{s.category}</small>
          </button>)}
        </div>
        <div className="sidebar-footer">
          <div className="mini-label">PROTOCOL STACK</div>
          <span>A2UI 1.0 <span className="connector">↔</span> AG-UI</span>
          <p>Every canvas component comes from the actual A2UI renderer.</p>
        </div>
      </aside>

      <main className="main-area">
        <section className="intro">
          <div><div className="eyebrow"><span className="eyebrow-dot"/> LIVE COMPONENT PREVIEW <span className="eyebrow-separator">/</span> SIMULATION</div>
            <h1>{current.name}</h1><p>{current.description}</p></div>
          <div className="metric-strip">
            <div><strong>{active.length.toString().padStart(2,'0')}</strong><span>Visible items</span></div>
            <div><strong>{surfaces.length.toString().padStart(2,'0')}</strong><span>A2UI surfaces</span></div>
            <div><strong>{trace.length.toString().padStart(2,'0')}</strong><span>Protocol events</span></div>
          </div>
        </section>

        <details className="control-panel" aria-label="Simulation controls">
          <summary className="controls-title"><span><span className="settings-icon">⚙</span><strong>Simulation settings</strong></span>
            <span className="controls-hint">Latency · failures · permissions <span aria-hidden="true">⌄</span></span></summary>
          <div className="controls-row">
            <label className="toggle"><input type="checkbox" checked={agentState.failNext} disabled={Boolean(playback)}
              onChange={e => agent.setOptions({failNext: e.target.checked})}/><span>Fail next action</span></label>
            <label className="toggle"><input type="checkbox" checked={agentState.denied} disabled={Boolean(playback)}
              onChange={e => agent.setOptions({denied: e.target.checked})}/><span>Deny writes</span></label>
            <label className="toggle"><input type="checkbox" checked={agentState.paused} disabled={Boolean(playback)}
              onChange={e => agent.setOptions({paused: e.target.checked})}/><span>Pause stream</span></label>
            <label className="latency">Latency
              <select aria-label="Simulated latency" disabled={Boolean(playback)} value={agentState.latency}
                onChange={e => agent.setOptions({latency: Number(e.target.value)})}>
                <option value={0}>Instant</option><option value={100}>100 ms</option><option value={400}>400 ms</option>
                <option value={900}>900 ms</option>
              </select>
            </label>
          </div>
          {agentState.lastError && <div role="alert" className="alert error"><strong>Action failed:</strong> {agentState.lastError}
            <button type="button" aria-label="Dismiss error" onClick={() => agent.clearError()}>×</button></div>}
          {message && <div role="status" className="alert">{message}
            <button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div>}
        </details>

        <section className="canvas-panel" aria-label="Rendered A2UI preview">
          <div className="canvas-toolbar">
            <div><strong>Agent-generated surface</strong><small><span className="preview-live-dot"/> A2UI v1.0 · Live simulation</small></div>
            <div className="canvas-tools">
              <span className="canvas-help">Try tapping, double-clicking, or swiping an item</span>
              <div role="group" aria-label="Preview viewport" className="viewport-switch">
                <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop</button>
                <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>Mobile</button>
              </div>
            </div>
          </div>
          <div className={'canvas-area '+(viewport === 'mobile' ? 'mobile-preview' : '')}>
            <div className="device-frame">
              <div className="device-header"><span className="window-dots">● ● ●</span><span>Agent Workspace</span><span className="window-side">SIMULATED RESPONSE</span></div>
              <div className="rendered-surfaces" data-testid="rendered-surfaces">
                {surfaces.length ? surfaces.map(surface => <div key={surface.id} className="surface" data-surface-id={surface.id}>
                  <A2uiSurface surface={surface as React.ComponentProps<typeof A2uiSurface>['surface']}/>
                </div>) : <div className="waiting"><div className="spinner"/><strong>Waiting for agent output</strong><span>AG-UI events will populate this surface.</span></div>}
              </div>
            </div>
          </div>
          {agent.canUndo && !playback && <div className="undo-toast" role="status" aria-live="polite">
            <span><span aria-hidden="true">✓</span> Item dismissed</span>
            <button type="button" onClick={() => void agent.undoLast()}>Undo dismiss ↶</button>
          </div>}
          <div className="canvas-footer"><span>◇ Actual A2UI renderer + Interaction Kit</span>
            <span>{playback ? 'Replay view · read-only' : '✓ Host-verified state updates'}</span></div>
        </section>
      </main>

      <aside className="inspector" aria-label="Event inspector">
        <div className="section-heading inspector-heading"><small>LIVE OBSERVABILITY</small>
          <h2>Protocol inspector <span className="trace-counter">{trace.length}</span></h2>
          <p>Follow the complete interaction lifecycle, from user input to host state.</p>
          <div className="inspector-stats"><span><i className="trace-indicator"/> {trace.length} events</span>
            <span className={traceErrors ? 'has-errors' : ''}>{traceErrors} errors</span></div></div>
        <div className="inspector-tabs" role="group" aria-label="Trace filter">
          {([['all','All'],['events','AG-UI'],['actions','Actions']] as const).map(([value,label]) =>
            <button type="button" aria-pressed={traceFilter === value} key={value}
              onClick={() => setTraceFilter(value)}>{label}</button>)}
        </div>
        <label className="trace-search"><span className="sr-only">Search event payloads</span>
          <input type="search" value={traceSearch} onChange={e => setTraceSearch(e.target.value)}
            placeholder="⌕ Search event payloads"/></label>
        <div className="event-feed" aria-label="Protocol events">
          {filtered.length === 0 ? <p className="empty-state">No events yet.</p> :
            filtered.map(t => {
              const payload = t.payload as AgentEvent;
              return <button type="button" key={t.sequence} className={'trace-row '+(selected?.sequence === t.sequence ? 'selected' : '')}
                onClick={() => setSelectedTrace(t.sequence)}>
                <span className={'trace-icon '+(t.direction === 'UI → agent' ? 'outgoing' : t.direction === 'host' ? 'host' : '')}>
                  {t.direction === 'UI → agent' ? '↗' : t.direction === 'host' ? '!' : '↙'}</span>
                <span className="trace-text"><strong>{payload?.type ? describeEvent(payload) : t.direction === 'host' ? 'Renderer error' : 'User interaction'}</strong>
                  <small>{traceSummary(t)} <span className="trace-time">· {t.time}</span></small></span>
                </button>;
            })}
        </div>
        <div className="json-inspector">
          <div className="json-heading"><strong>Event details</strong>
            <div className="json-actions">
              <button type="button" onClick={() => setSelectedTrace(null)}>Latest</button>
              <button type="button" onClick={() => {if (selected) void navigator.clipboard?.writeText(format(selected.payload));}}
                disabled={!selected}>Copy JSON</button>
            </div></div>
          {selectedDifference.length > 0 && <div className="state-diff">
            <strong>Verified state changes</strong>
            {selectedDifference.map((line,index) => <span key={index}>{line}</span>)}
          </div>}
          <pre data-testid="payload-json">{selected ? format(selected.payload) : '// Select a protocol event to inspect its payload.'}</pre>
        </div>
        <div className="inspector-footer">
          <button type="button" className="button button-quiet" onClick={() => fileInput.current?.click()}>Import recording</button>
          <button type="button" className="button button-quiet" onClick={onReset} disabled={agentState.running}>Run again</button>
          <input hidden ref={fileInput} type="file" accept="application/json,.json" onChange={importRecording}/>
        </div>
      </aside>
    </div>
  </div>;
}

function getSurfaces(processor: MessageProcessor) {
  return Array.from(processor.model.surfacesMap.values());
}
