// Email links (reset password, confirm email) come back to the app with their result in
// the address: #access_token=...&type=recovery, or #error_description=...
export function readAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const part = (s: string) => {
    for (const pair of s.split("&")) {
      if (!pair) continue;
      const i = pair.indexOf("=");
      const k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      out[k] = decodeURIComponent((i < 0 ? "" : pair.slice(i + 1)).replace(/\+/g, " "));
    }
  };
  const hash = url.indexOf("#");
  const query = url.indexOf("?");
  if (query >= 0) part(url.slice(query + 1, hash >= 0 && hash > query ? hash : undefined));
  if (hash >= 0) part(url.slice(hash + 1));
  return out;
}

