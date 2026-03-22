import { create } from "zustand";

// ── Types ──

export type CorrelationSource = "gitlab" | "linear" | "slack" | "datadog" | "focus";

export interface CorrelationEntity {
  source: CorrelationSource;
  /** Unique key: "gitlab:142", "linear:SUR-940", "slack:C123:1234.5678" */
  id: string;
  /** Display text: "!142: Add payment flow" */
  label: string;
  /** Secondary info: "by AJ · In Review" */
  subtitle?: string;
  /** Navigation data for deep-linking */
  nav?: CorrelationNav;
}

export type CorrelationNav =
  | { type: "gitlab"; projectId: number; iid: number }
  | { type: "linear"; identifier: string }
  | { type: "slack"; channelId: string; threadTs: string }
  | { type: "focus"; focusId: string }
  | { type: "datadog"; monitorId: number };

interface Signal {
  a: string;
  b: string;
}

// ── Stable serialization for change detection ──

function signalFingerprint(signals: Signal[]): string {
  return signals
    .map((s) => (s.a < s.b ? `${s.a}|${s.b}` : `${s.b}|${s.a}`))
    .sort()
    .join("\n");
}

function entityFingerprint(entities: CorrelationEntity[]): string {
  return entities.map((e) => e.id).sort().join(",");
}

// ── Store ──

/** Tracks the last fingerprint per source to skip no-op rebuilds */
const lastFingerprints = new Map<CorrelationSource, string>();

interface CorrelationState {
  /** Revision counter — increments only when the index actually changes */
  revision: number;

  /** Entity metadata lookup */
  entities: Record<string, CorrelationEntity>;

  /**
   * Bidirectional index: entity ID → array of related entity IDs.
   * Mutated in place; components use `revision` to know when to re-read.
   */
  index: Record<string, string[]>;

  /**
   * Rebuild index for a single source. Skips the update entirely
   * if the signals and entities haven't changed since last call.
   */
  rebuildSource: (
    source: CorrelationSource,
    sourceEntities: CorrelationEntity[],
    signals: Signal[],
  ) => void;

  /** Get related entities for an entity ID (reads from index directly) */
  getRelated: (entityId: string) => CorrelationEntity[];
}

export const useCorrelationStore = create<CorrelationState>()((set, get) => ({
  revision: 0,
  entities: {},
  index: {},

  rebuildSource: (source, sourceEntities, signals) => {
    // Fast-path: skip if nothing changed since last rebuild for this source
    const fp = signalFingerprint(signals) + ";" + entityFingerprint(sourceEntities);
    if (lastFingerprints.get(source) === fp) return;
    lastFingerprints.set(source, fp);

    const state = get();
    const nextEntities = { ...state.entities };
    const nextIndex = { ...state.index };

    // Collect IDs owned by this source
    const sourceEntityIds = new Set<string>();
    for (const [id, entity] of Object.entries(nextEntities)) {
      if (entity.source === source) {
        sourceEntityIds.add(id);
        delete nextEntities[id];
      }
    }

    // Remove stale index entries for this source only
    if (sourceEntityIds.size > 0) {
      for (const removedId of sourceEntityIds) {
        delete nextIndex[removedId];
      }
      // Clean references to removed IDs from other entries
      for (const [id, related] of Object.entries(nextIndex)) {
        let changed = false;
        const filtered: string[] = [];
        for (const r of related) {
          if (sourceEntityIds.has(r)) {
            changed = true;
          } else {
            filtered.push(r);
          }
        }
        if (changed) {
          if (filtered.length === 0) {
            delete nextIndex[id];
          } else {
            nextIndex[id] = filtered;
          }
        }
      }
    }

    // Register new entities
    for (const entity of sourceEntities) {
      nextEntities[entity.id] = entity;
    }

    // Register new signals (bidirectional, dedup with Set)
    for (const { a, b } of signals) {
      if (a === b) continue;
      if (!nextIndex[a]) nextIndex[a] = [];
      if (!nextIndex[a].includes(b)) nextIndex[a].push(b);
      if (!nextIndex[b]) nextIndex[b] = [];
      if (!nextIndex[b].includes(a)) nextIndex[b].push(a);
    }

    set({ index: nextIndex, entities: nextEntities, revision: state.revision + 1 });
  },

  getRelated: (entityId) => {
    const state = get();
    const directIds = state.index[entityId];
    if (!directIds || directIds.length === 0) return EMPTY_ARRAY;

    // Collect direct + 1-hop transitive correlations.
    // If A→B and B→C, then A sees C (via shared reference B).
    // This means: Focus Item links to SUR-940, MR also links to SUR-940 → Focus sees MR.
    const seen = new Set<string>([entityId]);
    const resultIds: string[] = [];

    for (const directId of directIds) {
      if (!seen.has(directId)) {
        seen.add(directId);
        resultIds.push(directId);
      }
      // 1-hop: items that share a reference with this entity
      const transitiveIds = state.index[directId];
      if (transitiveIds) {
        for (const tId of transitiveIds) {
          if (!seen.has(tId)) {
            seen.add(tId);
            resultIds.push(tId);
          }
        }
      }
    }

    const results = resultIds
      .map((id) => state.entities[id])
      .filter(Boolean);
    return results.length > 0 ? results : EMPTY_ARRAY;
  },
}));

/** Stable empty array reference to avoid re-renders when no correlations exist */
const EMPTY_ARRAY: CorrelationEntity[] = [];
