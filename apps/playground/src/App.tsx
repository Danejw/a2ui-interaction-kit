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
    void agent.submitAction(action);
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
  const filtered = trace.filter(x => traceFilter === 'all' ||
    (traceFilter === 'events' && x.direction === 'agent → UI') ||
    (traceFilter === 'actions' && x.direction !== 'agent → UI'));

  const exportRecording = () => {
    const json = JSON.stringify(agent.recording, null, 2);
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

  return <div className="lab-app">
    <header className="topbar">
      <div className="identity">
        <div className="identity-mark">a<span>2</span></div>
        <div><strong>Interaction Lab</strong><small>A2UI + AG-UI / deterministic simulator</small></div>
      </div>
      <div className="top-actions">
        <span className="status-chip"><span className={agentState.running ? 'live-dot' : 'idle-dot'}/>
          {playback ? 'Replay mode' : agentState.running ? 'Agent running' : 'Simulator ready'}</span>
        <button className="button button-quiet" type="button" onClick={exportRecording}>Export trace</button>
        <button className="button button-primary" type="button" onClick={onReset}>Reset lab</button>
      </div>
    </header>

    <div className="workspace">
      <aside className="sidebar" aria-label="Scenarios">
        <div className="section-heading"><small>WORKSPACE</small><h2>Test scenarios</h2></div>
        <div className="scenario-list">
          {SCENARIOS.map(s => <button type="button" key={s.id} className={'scenario '+(scenario === s.id ? 'active' : '')}
            aria-pressed={scenario === s.id} onClick={() => onSelectScenario(s.id)}>
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
          <div><div className="eyebrow">DETERMINISTIC AGENT SIMULATOR</div>
            <h1>{current.name}</h1><p>{current.description}</p></div>
          <div className="metric-strip">
            <div><strong>{active.length}</strong><span>Visible items</span></div>
            <div><strong>{surfaces.length}</strong><span>A2UI surfaces</span></div>
            <div><strong>{trace.length}</strong><span>Trace entries</span></div>
          </div>
        </section>

        <section className="control-panel" aria-label="Simulation controls">
          <div className="controls-title"><strong>Simulation controls</strong><small>No model keys or paid APIs</small></div>
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
            <button type="button" aria-label="Dismiss error" onClick={() => setMessage(null)}>×</button></div>}
          {message && <div role="status" className="alert">{message}
            <button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div>}
        </section>

        <section className="canvas-panel" aria-label="Rendered A2UI preview">
          <div className="canvas-toolbar">
            <div><strong>Rendered surface</strong><small>Live A2UI v1.0 output</small></div>
            <div className="canvas-tools">
              <button className="button button-quiet" type="button" disabled={!agent.canUndo || Boolean(playback)}
                onClick={() => void agent.undoLast()}>Undo dismiss</button>
              <div role="group" aria-label="Preview viewport" className="viewport-switch">
                <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop</button>
                <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>Mobile</button>
              </div>
            </div>
          </div>
          <div className={'canvas-area '+(viewport === 'mobile' ? 'mobile-preview' : '')}>
            <div className="device-frame">
              <div className="device-header"><span className="window-dots">● ● ●</span><span>Agent Workspace</span><span className="window-side">SIMULATED</span></div>
              <div className="rendered-surfaces" data-testid="rendered-surfaces">
                {surfaces.length ? surfaces.map(surface => <div key={surface.id} className="surface" data-surface-id={surface.id}>
                  <A2uiSurface surface={surface}/>
                </div>) : <div className="waiting"><div className="spinner"/><strong>Waiting for agent output</strong><span>AG-UI events will populate this surface.</span></div>}
              </div>
            </div>
          </div>
          <div className="canvas-footer"><span>Interactive controls dispatch actual A2UI actions</span>
            <span>{playback ? 'Replay view · read-only' : 'Host-verified state updates'}</span></div>
        </section>
      </main>

      <aside className="inspector" aria-label="Event inspector">
        <div className="section-heading inspector-heading"><small>DEVELOPER TOOLS</small><h2>Protocol inspector</h2>
          <p>Inspect the actual event envelopes and action payloads.</p></div>
        <div className="inspector-tabs" role="group" aria-label="Trace filter">
          {([['all','All'],['events','AG-UI'],['actions','Actions']] as const).map(([value,label]) =>
            <button type="button" aria-pressed={traceFilter === value} key={value}
              onClick={() => setTraceFilter(value)}>{label}</button>)}
        </div>
        <div className="event-feed" aria-label="Protocol events">
          {filtered.length === 0 ? <p className="empty-state">No events yet.</p> :
            filtered.map(t => {
              const payload = t.payload as AgentEvent;
              return <button type="button" key={t.sequence} className={'trace-row '+(selected?.sequence === t.sequence ? 'selected' : '')}
                onClick={() => setSelectedTrace(t.sequence)}>
                <span className={'trace-icon '+(t.direction === 'UI → agent' ? 'outgoing' : t.direction === 'host' ? 'host' : '')}>
                  {t.direction === 'UI → agent' ? '↗' : t.direction === 'host' ? '!' : '↙'}</span>
                <span className="trace-text"><strong>{payload?.type ? describeEvent(payload) : t.direction === 'host' ? 'Renderer error' : 'User interaction'}</strong>
                  <small>{t.time} · {t.direction}</small></span>
                </button>;
            })}
        </div>
        <div className="json-inspector">
          <div className="json-heading"><strong>Payload</strong>
            <button type="button" onClick={() => {if (selected) void navigator.clipboard?.writeText(format(selected.payload));}}
              disabled={!selected}>Copy JSON</button></div>
          <pre data-testid="payload-json">{selected ? format(selected.payload) : '// Select a protocol event to inspect its payload.'}</pre>
        </div>
        <div className="inspector-footer">
          <button type="button" className="button button-quiet" onClick={() => fileInput.current?.click()}>Import recording</button>
          <button type="button" className="button button-quiet" onClick={() => void agent.run()} disabled={agentState.running || Boolean(playback)}>Run again</button>
          <input hidden ref={fileInput} type="file" accept="application/json,.json" onChange={importRecording}/>
        </div>
      </aside>
    </div>
  </div>;
}

function getSurfaces(processor: MessageProcessor) {
  return Array.from(processor.model.surfacesMap.values());
}
