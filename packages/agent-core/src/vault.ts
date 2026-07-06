import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope for portal credentials. The master key comes from
 * VAULT_MASTER_KEY (64 hex chars = 32 bytes). Ciphertext and nonce are stored
 * separately; the auth tag is appended to the ciphertext.
 */

function masterKey(): Buffer {
  const hex = process.env.VAULT_MASTER_KEY ?? "0".repeat(64);
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("VAULT_MASTER_KEY must be 64 hex characters (32 bytes)");
  }
  return key;
}

export function encryptSecret(plaintext: string): { ciphertext: string; nonce: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    nonce: iv.toString("base64"),
  };
}

export function decryptSecret(ciphertext: string, nonce: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const enc = raw.subarray(0, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Redact anything that looks like a secret before it enters the audit log. */
export function redact(value: string): string {
  if (value.length <= 2) return "••";
  return value[0] + "•".repeat(Math.min(value.length - 2, 8)) + value[value.length - 1];
}
