import "server-only";
import { randomBytes, createHash } from "node:crypto";

const PREFIX = "invk";

// Raw key is shown to the admin exactly once, at creation. Only the hash is
// ever stored, so it can't be recovered later -- same as a password.
export function generateApiKey() {
  const raw = `${PREFIX}_${randomBytes(24).toString("base64url")}`;
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: raw.slice(0, PREFIX.length + 9),
  };
}

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
