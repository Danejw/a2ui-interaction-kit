import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorRegistry, InteractionEngine, createDefaultRegistry} from '../src/core.ts';

const request = {itemId:'task-1',surfaceId:'dashboard',behavior:'dismissible',action:'dismiss'};

test('default registry contains the five MVP behaviors', () => {
  assert.deepEqual(createDefaultRegistry().list().map(b => b.name),
    ['expandable','dismissible','prioritizable','selectable','actionable']);
});

test('rejects unknown behaviors, mismatched actions and absent handlers', async () => {
  const engine = new InteractionEngine({handlers:{}});
  assert.deepEqual(await engine.dispatch({...request,behavior:'made-up'}), {ok:false,reason:'unknown-behavior'});
  assert.deepEqual(await engine.dispatch({...request,action:'activate'}), {ok:false,reason:'unsupported-action'});
  assert.deepEqual(await engine.dispatch(request), {ok:false,reason:'unhandled'});
});

test('authorization blocks the side effect', async () => {
  let calls = 0;
  const engine = new InteractionEngine({handlers:{dismiss:()=>{calls++;}},authorize:()=>false});
  assert.deepEqual(await engine.dispatch(request), {ok:false,reason:'unauthorized'});
  assert.equal(calls,0);
});

test('concurrent repeated requests are blocked', async () => {
  let release:()=>void = () => {};
  const pending = new Promise<void>(r=>{release=r;});
  const engine = new InteractionEngine({handlers:{dismiss:()=>pending}});
  const first = engine.dispatch(request);
  assert.deepEqual(await engine.dispatch(request), {ok:false,reason:'busy'});
  release();
  assert.deepEqual(await first, {ok:true,undoable:false});
});

test('undo is only available when host registers a compensating action', async () => {
  let count = 0;
  const engine = new InteractionEngine({handlers:{dismiss:()=>{count++;return {undo:()=>{count--;}};}}});
  assert.deepEqual(await engine.dispatch(request), {ok:true,undoable:true});
  assert.equal(count,1);
  assert.equal(engine.canUndo(),true);
  assert.deepEqual(await engine.undoLast(), {ok:true,undoable:false});
  assert.equal(count,0);
  assert.deepEqual(await engine.undoLast(), {ok:false,reason:'unhandled'});
});

test('failed mutation cannot be undone', async () => {
  const engine = new InteractionEngine({handlers:{dismiss:()=>{throw Error('server failed');}}});
  const result = await engine.dispatch(request);
  assert.equal(result.ok,false);
  assert.equal(engine.canUndo(),false);
});

test('custom capabilities can be registered', async () => {
  const registry = new BehaviorRegistry([{name:'snoozable',actions:['snooze']}]);
  let seen = '';
  const engine = new InteractionEngine({registry,handlers:{snooze:r=>{seen=r.itemId;}}});
  assert.deepEqual(await engine.dispatch({itemId:'task-3',behavior:'snoozable',action:'snooze'}), {ok:true,undoable:false});
  assert.equal(seen,'task-3');
});

test('invalid registry definitions fail fast', () => {
  assert.throws(()=>new BehaviorRegistry([{name:'',actions:['x']}]),/behavior needs/);
  assert.throws(()=>new InteractionEngine({handlers:{},maxUndo:-1}),/maxUndo/);
});


test('undo rechecks authorization and keeps the undo entry when denied', async () => {
  let allowed = true;
  let reversals = 0;
  const engine = new InteractionEngine({
    authorize: () => allowed,
    handlers: {dismiss: () => ({undo: () => {reversals++;}})},
  });
  await engine.dispatch(request);
  allowed = false;
  assert.deepEqual(await engine.undoLast(), {ok:false,reason:'unauthorized'});
  assert.equal(reversals, 0);
  assert.equal(engine.canUndo(), true);
});

test('invalid item ID is rejected', async () => {
  const engine = new InteractionEngine({handlers:{dismiss:()=>{throw Error('should never run');}}});
  assert.deepEqual(await engine.dispatch({...request,itemId:''}), {ok:false,reason:'invalid-request'});
});
