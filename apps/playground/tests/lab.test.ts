import test from 'node:test';
import assert from 'node:assert/strict';
import {EventType} from '@ag-ui/core';
import {initialItems, parseAction, replayRecording, SimulatedAgent, validateRecording, SCENARIOS} from '../src/lab.ts';

const validAction = (name: string, itemId: string, surfaceId = 'main') =>
  ({version: '1.0', action: {name, surfaceId, sourceComponentId: 'item-' + itemId,
    timestamp: new Date(0).toISOString(), context: {itemId}}});

test('all scenarios have distinct fixture IDs', () => {
  assert.equal(new Set(SCENARIOS.map(x => x.id)).size, SCENARIOS.length);
  for (const scenario of SCENARIOS) assert.equal(new Set(initialItems(scenario.id).map(x => x.id)).size, initialItems(scenario.id).length);
});

test('an agent run emits official AG-UI lifecycle and actual A2UI operations', async () => {
  const agent = new SimulatedAgent('mission');
  agent.setOptions({latency: 0});
  const events: Record<string, unknown>[] = [];
  agent.subscribe(x => events.push(x));
  await agent.run();
  assert.equal(events[0]?.type, EventType.RUN_STARTED);
  const activity = events.find(x => x.type === EventType.ACTIVITY_SNAPSHOT)!;
  assert.equal(activity.activityType, 'a2ui-surface');
  const operations = (activity.content as {a2ui_operations: Record<string, unknown>[]}).a2ui_operations;
  assert.equal(operations[0]?.version, '1.0');
  assert.ok(operations[0]?.createSurface);
  assert.ok(operations[1]?.updateComponents);
  assert.ok(events.some(x => x.type === EventType.STATE_SNAPSHOT));
  assert.equal(events.at(-1)?.type, EventType.RUN_FINISHED);
});

test('round trip priority action produces a new A2UI surface update and host state', async () => {
  const agent = new SimulatedAgent('mission');
  agent.setOptions({latency: 0});
  const events: Record<string, unknown>[] = [];
  agent.subscribe(x => events.push(x));
  await agent.run();
  assert.equal(await agent.submitAction(validAction('prioritize_item', 'match-01')), true);
  assert.equal(agent.snapshot.items.find(x => x.id === 'match-01')?.prioritized, true);
  assert.equal(events.at(-1)?.type, EventType.RUN_FINISHED);
  assert.ok(events.some(e => e.type === EventType.ACTIVITY_SNAPSHOT &&
    (e.content as {a2ui_operations: unknown[]}).a2ui_operations.some(op =>
      Boolean((op as Record<string, unknown>).updateComponents))));
});

test('dismiss means hide; undo restores the original item', async () => {
  const agent = new SimulatedAgent('mission');
  agent.setOptions({latency: 0});
  await agent.run();
  assert.equal(await agent.submitAction(validAction('dismiss_item', 'match-01')), true);
  assert.equal(agent.snapshot.items.find(x => x.id === 'match-01')?.dismissed, true);
  assert.equal(agent.canUndo, true);
  assert.equal(await agent.undoLast(), true);
  assert.equal(agent.snapshot.items.find(x => x.id === 'match-01')?.dismissed, false);
});

test('failed mutations leave state untouched, emit RUN_ERROR and can be retried', async () => {
  const agent = new SimulatedAgent('recovery');
  agent.setOptions({latency: 0});
  const events: Record<string, unknown>[] = [];
  agent.subscribe(e => events.push(e));
  await agent.run();
  assert.equal(await agent.submitAction(validAction('dismiss_item','retry-01')), false);
  assert.equal(agent.snapshot.items[0].dismissed, false);
  assert.ok(events.some(e => e.type === EventType.RUN_ERROR));
  assert.equal(await agent.submitAction(validAction('dismiss_item','retry-01')), true);
});

test('host authorization rejects actions and undo', async () => {
  const agent = new SimulatedAgent('permissions');
  agent.setOptions({latency: 0});
  await agent.run();
  assert.equal(await agent.submitAction(validAction('dismiss_item','restricted-01')), false);
  assert.equal(agent.snapshot.items[0].dismissed, false);
});

test('unknown actions, item IDs and surface spoofing are rejected', async () => {
  const agent = new SimulatedAgent('mission');
  agent.setOptions({latency: 0});
  await agent.run();
  assert.equal(await agent.submitAction(validAction('delete_permanently','match-01')), false);
  assert.equal(await agent.submitAction(validAction('dismiss_item','invalid-id')), false);
  assert.equal(await agent.submitAction(validAction('dismiss_item','match-01','other')), false);
  assert.equal(agent.snapshot.items[0].dismissed, false);
});

test('duplicate pending action is rejected', async () => {
  const agent = new SimulatedAgent('mission');
  agent.setOptions({latency: 50});
  await agent.run();
  const action = validAction('prioritize_item','match-01');
  const first = agent.submitAction(action);
  assert.equal(await agent.submitAction(action), false);
  assert.equal(await first, true);
});

test('record/replay preserves AG-UI event sequence', async () => {
  const agent = new SimulatedAgent('multi');
  agent.setOptions({latency: 0});
  await agent.run();
  const events: unknown[] = [];
  await replayRecording(validateRecording(agent.recording), event => events.push(event));
  assert.deepEqual(events, agent.recording.events);
  assert.ok((events as Record<string, unknown>[]).filter(x => x.type === EventType.ACTIVITY_SNAPSHOT).length >= 2);
});

test('recording parser rejects unexpected or oversized content', () => {
  assert.throws(() => validateRecording({format:'x', version:1, scenario:'mission', events:[]}));
  assert.throws(() => validateRecording({format:'interaction-lab-recording',version:1,scenario:'mission',events:Array(1001).fill({type:'RUN_STARTED'})}));
});

test('A2UI action shape is parsed without executing arbitrary input', () => {
  assert.deepEqual(parseAction(validAction('dismiss_item','match-01')), {name:'dismiss_item', itemId:'match-01', surfaceId:'main'});
  assert.equal(parseAction({action:{name:'dismiss_item',context:{itemId:42}}}), null);
});
