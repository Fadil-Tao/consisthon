const localOrigin = "https://consisthon.invalid";
// biome-ignore lint/suspicious/noControlCharactersInRegex: Reject characters browsers remove during URL normalization.
const unsafePathCharacters = /[\x00-\x20\x7f\\]/;

export function safeRedirectPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    unsafePathCharacters.test(value)
  )
    return "/";
  try {
    const url = new URL(value, localOrigin);
    if (url.origin !== localOrigin || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
