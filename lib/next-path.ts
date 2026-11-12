/**
 * Only an invite page is a valid place to continue to after signing in or up.
 * Anything else (another site, another path) is dropped, so the `next` field
 * cannot be used as an open redirect.
 */
export function safeNext(value: FormDataEntryValue | null | undefined): string | null {
  const text = typeof value === "string" ? value : "";
  return /^\/invite\/[A-Za-z0-9_-]{20,100}$/.test(text) ? text : null;
}
