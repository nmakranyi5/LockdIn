import type { SupabaseClient } from "@supabase/supabase-js";
import { History } from "../streak";
import { Task } from "../taskState";
import {
  HistoryRow,
  mergeLocalOnly,
  rowToTask,
  syncSig,
  taskToRow,
  TaskRow,
} from "./mapping";

const PAGE = 500;
const CHUNK = 200;
// Server timestamps are assigned at transaction start, so a slow transaction
// can commit "in the past". Re-reading a few seconds is harmless (merging is
// idempotent) and closes that gap.
const CURSOR_OVERLAP_MS = 5000;

const chunks = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size)
  );

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function pushTasks(client: SupabaseClient, userId: string, tasks: Task[]) {
  for (const part of chunks(tasks, CHUNK)) {
    const rows = part.map((t) => ({ ...taskToRow(t), user_id: userId }));
    const { error } = await client
      .from("tasks")
      .upsert(rows, { onConflict: "user_id,id" });
    check(error);
  }
}

// Deletes are soft so they propagate to the user's other devices.
export async function pushDeletes(client: SupabaseClient, userId: string, ids: string[]) {
  for (const part of chunks(ids, CHUNK)) {
    const { error } = await client
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", part);
    check(error);
  }
}

export async function pullTasks(
  client: SupabaseClient,
  userId: string,
  cursor: string | null
) {
  const rows: TaskRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = client
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true });
    if (cursor) {
      q = q.gte("updated_at", new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString());
    } else {
      // A first sync has no use for tombstones.
      q = q.is("deleted_at", null);
    }
    const { data, error } = await q.range(from, from + PAGE - 1);
    check(error);
    rows.push(...((data ?? []) as TaskRow[]));
    if (!data || data.length < PAGE) break;
  }
  const newest = rows.reduce<string | null>(
    (max, r) => (!max || r.updated_at > max ? r.updated_at : max),
    cursor
  );
  return { rows, cursor: newest };
}

export type RemoteApplied = {
  tasks: Task[];
  removed: Task[];
  upserted: { task: Task; previous?: Task }[];
};

// Merge pulled rows into the local list. `skipIds` are tasks with local
// changes that haven't been pushed yet: those win and will overwrite the
// server on the next push.
export function applyRemote(
  local: Task[],
  rows: TaskRow[],
  skipIds: Set<string> = new Set()
): RemoteApplied {
  const byId = new Map(local.map((t) => [t.id, t]));
  const removed: Task[] = [];
  const upserted: RemoteApplied["upserted"] = [];

  for (const row of rows) {
    if (skipIds.has(row.id)) continue;
    const existing = byId.get(row.id);

    if (row.deleted_at) {
      if (existing) {
        removed.push(existing);
        byId.delete(row.id);
      }
      continue;
    }

    const remote = rowToTask(row);
    if (existing && syncSig(existing) === syncSig(remote)) continue;
    const merged = mergeLocalOnly(remote, existing);
    byId.set(row.id, merged);
    upserted.push({ task: merged, previous: existing });
  }
  return { tasks: [...byId.values()], removed, upserted };
}

export async function pushHistory(client: SupabaseClient, userId: string, rows: HistoryRow[]) {
  for (const part of chunks(rows, CHUNK)) {
    // A finished day is write-once: the first device to report it wins.
    const { error } = await client
      .from("day_history")
      .upsert(
        part.map((r) => ({ ...r, user_id: userId })),
        { onConflict: "user_id,day", ignoreDuplicates: true }
      );
    check(error);
  }
}

export async function pullHistory(client: SupabaseClient, userId: string): Promise<History> {
  const out: History = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("day_history")
      .select("day,total,done")
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .range(from, from + PAGE - 1);
    check(error);
    for (const r of (data ?? []) as HistoryRow[]) out[r.day] = { total: r.total, done: r.done };
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export type RemoteProfile = { name: string; avatar: string };

export async function pullProfile(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("name,avatar")
    .eq("id", userId)
    .maybeSingle();
  check(error);
  return (data as RemoteProfile | null) ?? null;
}

export async function pushProfile(client: SupabaseClient, userId: string, p: RemoteProfile) {
  const { error } = await client
    .from("profiles")
    .upsert({ id: userId, name: p.name, avatar: p.avatar }, { onConflict: "id" });
  check(error);
}
