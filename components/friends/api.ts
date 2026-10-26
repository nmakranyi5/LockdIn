import { supabase } from "../sync/client";
import { friendlyError } from "../sync/errors";

export type TodayStatus = "none" | "pending" | "complete" | "unknown";

export type FriendUser = {
  user_id: string;
  username: string;
  name: string;
  avatar: string;
  streak: number;
  longest: number;
  today: TodayStatus;
  // Days in a row you both finished everything.
  shared_streak: number;
  nudged_recently: boolean;
};

export type FriendRequest = {
  id: string;
  user_id: string;
  username: string;
  name: string;
  avatar: string;
  created_at: string;
};

export type Overview = {
  me: { username: string | null; nudges_enabled: boolean };
  friends: FriendUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const normalizeUsername = (s: string) => s.trim().replace(/^@/, "").toLowerCase();

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("Not connected");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendlyError(error));
  return data as T;
}

export const fetchOverview = (todayKey: string) =>
  rpc<Overview>("friends_overview", { p_today: todayKey });

export type SetUsernameResult = "ok" | "invalid" | "taken" | "reserved";
export const setUsername = (username: string) =>
  rpc<SetUsernameResult>("set_username", { p_username: username });

export type RequestResult =
  | "sent"
  | "accepted"
  | "already_friends"
  | "already_requested"
  | "not_found"
  | "self"
  | "need_username"
  | "too_many";
export const sendFriendRequest = (username: string) =>
  rpc<RequestResult>("send_friend_request", { p_username: username });

export const respondToRequest = (id: string, accept: boolean) =>
  rpc<"accepted" | "declined" | "not_found">("respond_friend_request", {
    p_request: id,
    p_accept: accept,
  });

export const removeFriend = (userId: string) =>
  rpc<void>("remove_friend", { p_other: userId });

export type NudgeResult = "sent" | "already_nudged" | "already_done" | "not_friends";
export const sendNudge = (userId: string) => rpc<NudgeResult>("send_nudge", { p_to: userId });

export const registerPushToken = (token: string, platform: string) =>
  rpc<void>("register_push_token", { p_token: token, p_platform: platform });

export const unregisterPushToken = (token: string) =>
  rpc<void>("unregister_push_token", { p_token: token });

export async function publishStreak(
  userId: string,
  s: { current: number; longest: number; today: "none" | "pending" | "complete"; todayKey: string }
) {
  if (!supabase) return;
  const { error } = await supabase.from("streak_stats").upsert(
    {
      user_id: userId,
      current_streak: s.current,
      longest_streak: s.longest,
      today: s.today,
      today_day: s.todayKey,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
}

export async function setNudgesEnabled(userId: string, enabled: boolean) {
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .update({ nudges_enabled: enabled })
    .eq("id", userId);
  if (error) throw new Error(friendlyError(error));
}

// What to tell the person for each outcome.
export const requestMessage: Record<RequestResult, { ok: boolean; text: (u: string) => string }> = {
  sent: { ok: true, text: (u) => `Request sent to @${u}.` },
  accepted: { ok: true, text: (u) => `You and @${u} are now friends!` },
  already_friends: { ok: false, text: (u) => `You're already friends with @${u}.` },
  already_requested: { ok: false, text: (u) => `You already sent @${u} a request.` },
  not_found: { ok: false, text: () => "No one has that username. Check the spelling." },
  self: { ok: false, text: () => "That's you! Add a friend's username instead." },
  need_username: { ok: false, text: () => "Choose your own username first." },
  too_many: { ok: false, text: () => "You have too many pending requests. Wait for some to be answered." },
};

export const usernameMessage: Record<Exclude<SetUsernameResult, "ok">, string> = {
  invalid: "Use 3–20 letters, numbers or underscores.",
  taken: "That username is taken. Try another.",
  reserved: "That username isn't available.",
};
