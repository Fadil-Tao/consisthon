export const MAX_PROOF_SIZE = 500 * 1024;
export const MAX_PENDING_UPLOADS = 3;
export const MAX_UPLOADS_PER_DAY = 20;
export const MAX_USER_PROOF_BYTES = 100 * 1024 * 1024;
export const UNATTACHED_PROOF_TTL_MS = 24 * 60 * 60 * 1000;
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class InvalidProofError extends Error {}

export function isProofImage(body: Uint8Array, type: string) {
  if (type === "image/jpeg")
    return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => body[index] === byte,
    );
  if (type === "image/webp")
    return (
      [82, 73, 70, 70].every((byte, index) => body[index] === byte) &&
      [87, 69, 66, 80].every((byte, index) => body[index + 8] === byte)
    );
  return false;
}
