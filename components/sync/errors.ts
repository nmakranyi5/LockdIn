// Supabase's messages are written for developers; turn the common ones into
// something a person can act on.
export function friendlyError(e: { message?: string; code?: string } | null | undefined) {
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
    return "Incorrect email or password.";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg))
    return "Please confirm your email first. Check your inbox for the link.";
  if (code === "user_already_exists" || /already registered/i.test(msg))
    return "An account with this email already exists. Try signing in.";
  if (code === "weak_password" || /password should be/i.test(msg))
    return "That password is too weak. Use at least 6 characters.";
  if (/rate limit|too many/i.test(msg) || code === "over_email_send_rate_limit")
    return "Too many attempts. Please wait a minute and try again.";
  // Postgres lacks table privileges: the SQL setup is incomplete.
  if (/permission denied for (table|function|schema)/i.test(msg))
    return "The database isn't fully set up yet. Run both SQL files in supabase/migrations (see supabase/README.md).";
  if (/network|failed to fetch|fetch failed|load failed|timed out/i.test(msg))
    return "Can't reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}
