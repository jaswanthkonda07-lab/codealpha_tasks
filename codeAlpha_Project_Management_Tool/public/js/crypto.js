// Client-side end-to-end encryption using the Web Crypto API.
// Key = PBKDF2-SHA256(passcode, salt=roomId, 150k iterations) -> AES-256-GCM. The server only relays ciphertext.
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}
export const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

export async function deriveKey(passcode, roomId) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('meetsphere:' + roomId), iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptBytes(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv, ct };
}
export async function decryptBytes(key, iv, ct) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}
export async function encryptText(key, text) {
  const { iv, ct } = await encryptBytes(key, enc.encode(text));
  return { iv: toB64(iv), ct: toB64(ct) };
}
export async function decryptText(key, { iv, ct }) {
  return dec.decode(await decryptBytes(key, fromB64(iv), fromB64(ct)));
}
