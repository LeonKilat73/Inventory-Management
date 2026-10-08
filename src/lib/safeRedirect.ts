// A post-login / post-link destination must stay on this site. The value
// comes straight from a URL query string, so anyone can craft a link like
// /login?redirectTo=https://lookalike-site.example -- without this, signing
// in would send the user to it. Only an in-app path is accepted: it must
// start with a single "/" ("//host" and "/\host" are treated as external by
// browsers), and may not contain control characters.
export function safeInternalPath(input: string | null | undefined, fallback: string): string {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return fallback;
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x1f || code === 0x7f) return fallback;
  }
  return input;
}
