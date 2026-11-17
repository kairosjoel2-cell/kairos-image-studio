/**
 * Bounded undo/redo stack with action coalescing.
 *
 * Consecutive commits tagged with the same coalesceKey within coalesceMs
 * replace the previous entry instead of adding a new one. This is used for
 * drags, sliders, and continuous text typing.
 */
export class HistoryEngine<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;
  private readonly limit: number;
  private readonly coalesceMs: number;
  private lastKey: string | null = null;
  private lastAt = 0;

  constructor(initial: T, limit = 60, coalesceMs = 600) {
    this.current = initial;
    this.limit = limit;
    this.coalesceMs = coalesceMs;
  }

  get value(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Push a new state. Pass a coalesceKey for continuous edits. */
  push(next: T, coalesceKey?: string): void {
    const now = Date.now();
    const coalesce =
      coalesceKey !== undefined &&
      coalesceKey === this.lastKey &&
      now - this.lastAt < this.coalesceMs;

    if (!coalesce) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }

    this.current = next;
    this.future = [];
    this.lastKey = coalesceKey === undefined ? null : coalesceKey;
    this.lastAt = now;
  }

  undo(): T | null {
    if (!this.canUndo) return null;
    const prev = this.past.pop() as T;
    this.future.push(this.current);
    this.current = prev;
    this.lastKey = null;
    return this.current;
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    const next = this.future.pop() as T;
    this.past.push(this.current);
    this.current = next;
    this.lastKey = null;
    return this.current;
  }

  reset(state: T): void {
    this.past = [];
    this.future = [];
    this.current = state;
    this.lastKey = null;
  }
}
