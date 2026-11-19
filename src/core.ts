/** The core is framework- and A2UI-independent. */
export const BUILT_IN_BEHAVIORS = {
  expandable: {actions: ["expand", "collapse"], local: true},
  dismissible: {actions: ["dismiss"], local: false},
  prioritizable: {actions: ["prioritize"], local: false},
  selectable: {actions: ["select"], local: false},
  actionable: {actions: ["activate"], local: false},
} as const;

export type BuiltInBehavior = keyof typeof BUILT_IN_BEHAVIORS;
export type InteractionContext = Readonly<{
  itemId: string;
  surfaceId?: string;
  details?: Readonly<Record<string, unknown>>;
}>;
export type InteractionRequest = InteractionContext & Readonly<{
  behavior: string;
  action: string;
}>;
export type UndoHandler = () => void | Promise<void>;
export type InteractionOutcome = void | {undo?: UndoHandler};
export type InteractionHandler = (request: InteractionRequest) => InteractionOutcome | Promise<InteractionOutcome>;
export type AuthorizationHandler = (request: InteractionRequest) => boolean | Promise<boolean>;
export type BehaviorDefinition = Readonly<{
  name: string;
  actions: readonly string[];
  local?: boolean;
}>;
export type InteractionResult =
  | {ok: true; undoable: boolean}
  | {ok: false; reason: "invalid-request" | "unknown-behavior" | "unsupported-action" | "unhandled" | "unauthorized" | "busy" | "failed"; error?: unknown};

/** Register or replace semantic capabilities. No executable code comes from agent payloads. */
export class BehaviorRegistry {
  private readonly entries = new Map<string, BehaviorDefinition>();
  constructor(definitions: readonly BehaviorDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }
  register(definition: BehaviorDefinition): void {
    if (!definition.name || !definition.actions.length || definition.actions.some(action => !action)) {
      throw new Error("A behavior needs a name and at least one nonempty action");
    }
    this.entries.set(definition.name, Object.freeze({...definition, actions: Object.freeze([...definition.actions])}));
  }
  get(name: string): BehaviorDefinition | undefined {return this.entries.get(name);}
  list(): BehaviorDefinition[] {return [...this.entries.values()];}
}

export const createDefaultRegistry = (): BehaviorRegistry => new BehaviorRegistry(
  Object.entries(BUILT_IN_BEHAVIORS).map(([name, value]) => ({name, actions: value.actions, local: value.local})),
);

export type InteractionEngineOptions = {
  registry?: BehaviorRegistry;
  handlers: Readonly<Record<string, InteractionHandler>>;
  authorize?: AuthorizationHandler;
  maxUndo?: number;
};

/**
 * Validates capabilities, serializes duplicate in-flight requests, and records ONLY
 * undo operations explicitly returned by application handlers.
 * A UI event cannot grant access to a backend action on its own.
 */
export class InteractionEngine {
  readonly registry: BehaviorRegistry;
  private readonly handlers: Readonly<Record<string, InteractionHandler>>;
  private readonly authorize?: AuthorizationHandler;
  private readonly maxUndo: number;
  private readonly inFlight = new Set<string>();
  private readonly undoStack: Array<{request: InteractionRequest; undo: UndoHandler}> = [];

  constructor(options: InteractionEngineOptions) {
    this.registry = options.registry ?? createDefaultRegistry();
    this.handlers = options.handlers;
    this.authorize = options.authorize;
    this.maxUndo = options.maxUndo ?? 20;
    if (!Number.isInteger(this.maxUndo) || this.maxUndo < 0) throw new Error("maxUndo must be a nonnegative integer");
  }

  private key(request: InteractionRequest): string {
    return JSON.stringify([request.surfaceId ?? "", request.itemId, request.action]);
  }

  async dispatch(request: InteractionRequest): Promise<InteractionResult> {
    if (!request.itemId || !request.action || !request.behavior) return {ok: false, reason: "invalid-request"};
    const behavior = this.registry.get(request.behavior);
    if (!behavior) return {ok: false, reason: "unknown-behavior"};
    if (!behavior.actions.includes(request.action)) return {ok: false, reason: "unsupported-action"};
    const handler = this.handlers[request.action];
    if (!handler) return {ok: false, reason: "unhandled"};
    const key = this.key(request);
    if (this.inFlight.has(key)) return {ok: false, reason: "busy"};
    this.inFlight.add(key);
    try {
      if (this.authorize && !(await this.authorize(request))) {
        return {ok: false, reason: "unauthorized"};
      }
      const outcome = await handler(request);
      const undo = outcome && typeof outcome === "object" ? outcome.undo : undefined;
      if (undo && this.maxUndo > 0) {
        this.undoStack.push({request, undo});
        if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
      }
      return {ok: true, undoable: Boolean(undo && this.maxUndo > 0)};
    } catch (error) {
      return {ok: false, reason: "failed", error};
    } finally {
      this.inFlight.delete(key);
    }
  }

  canUndo(): boolean {return this.undoStack.length > 0;}
  async undoLast(): Promise<InteractionResult> {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) return {ok: false, reason: "unhandled"};
    const key = this.key(entry.request);
    if (this.inFlight.has(key)) return {ok: false, reason: "busy"};
    this.inFlight.add(key);
    try {
      if (this.authorize && !(await this.authorize(entry.request))) {
        return {ok: false, reason: "unauthorized"};
      }
      // The host must also enforce authorization when running the compensating action.
      await entry.undo();
      this.undoStack.pop();
      return {ok: true, undoable: this.canUndo()};
    } catch (error) {
      return {ok: false, reason: "failed", error};
    } finally {
      this.inFlight.delete(key);
    }
  }
}
