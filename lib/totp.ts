/**
 * RFC 6238 Time-based One-Time Password (TOTP) implementation
 * Zero external dependencies — powered by browser-native Web Crypto Subtle API.
 * 100% compatible with Google Authenticator, Microsoft Authenticator, and 1Password.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Default admin TOTP secret (Base32 format, 32 characters)
export const DEFAULT_ADMIN_TOTP_SECRET = 
  process.env.NEXT_PUBLIC_ADMIN_TOTP_SECRET || "MZXW6YTBOJUW4ZZAMZXW6YTBOJUW4ZZA";

/**
 * Decodes a Base32 string into a Uint8Array byte buffer
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes[i / 8] = parseInt(bits.substr(i, 8), 2);
  }
  return bytes;
}

/**
 * Generates an RFC 6238 6-digit TOTP code for a given secret and time offset
 */
export async function generateTOTPCode(
  secretBase32: string = DEFAULT_ADMIN_TOTP_SECRET,
  timeOffsetSteps: number = 0
): Promise<string> {
  const step = 30; // 30 seconds interval
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / step) + timeOffsetSteps;

  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setBigUint64(0, BigInt(counter), false); // BigEndian 64-bit uint

  const keyBytes = base32ToBytes(secretBase32);
  const subtle = (typeof window !== "undefined" && window.crypto?.subtle) 
    ? window.crypto.subtle 
    : (globalThis as any).crypto?.subtle;

  if (!subtle) {
    throw new Error("Web Crypto Subtle API is not available in this environment.");
  }

  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes as any,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await subtle.sign("HMAC", cryptoKey, counterBuf);
  const digest = new Uint8Array(signature);

  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, "0");
}

/**
 * Verifies a 6-digit TOTP code against the secret key.
 * Checks the current 30s window plus previous (-1) and next (+1) window (90s window)
 * to prevent false rejections caused by phone clock drift.
 */
export async function verifyTOTPCode(
  token: string,
  secretBase32: string = DEFAULT_ADMIN_TOTP_SECRET
): Promise<boolean> {
  if (!token) return false;
  const cleanToken = token.trim().replace(/\s+/g, "");
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  // Check windows: -1 (past 30s), 0 (current 30s), +1 (next 30s)
  for (const offset of [-1, 0, 1]) {
    try {
      const expected = await generateTOTPCode(secretBase32, offset);
      if (expected === cleanToken) {
        return true;
      }
    } catch (e) {
      console.warn("TOTP verification step error:", e);
    }
  }

  return false;
}

/**
 * Generates an otpauth:// URI for scanning with Google Authenticator
 */
export function getTOTPAuthUri(
  accountEmail: string = "layjoe0001@gmail.com",
  secretBase32: string = DEFAULT_ADMIN_TOTP_SECRET,
  issuer: string = "SyllabusPlatform"
): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Returns a QR code image URL for scanning directly in Google Authenticator
 */
export function getTOTPQRCodeUrl(
  accountEmail: string = "layjoe0001@gmail.com",
  secretBase32: string = DEFAULT_ADMIN_TOTP_SECRET
): string {
  const uri = getTOTPAuthUri(accountEmail, secretBase32);
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(uri)}`;
}
