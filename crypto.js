import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function getDataEncryptionKey(value = process.env.DATA_ENCRYPTION_KEY) {
    if (!value) throw new Error("DATA_ENCRYPTION_KEY is required.");
    const key = Buffer.from(value, "base64");
    if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    return key;
}

export function encryptPrivateData(value, key = getDataEncryptionKey()) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptPrivateData(value, key = getDataEncryptionKey()) {
    if (!value) return null;
    const encrypted = Buffer.from(value);
    if (encrypted.length < 29) throw new Error("Encrypted private data is invalid.");
    const iv = encrypted.subarray(0, 12);
    const authTag = encrypted.subarray(12, 28);
    const ciphertext = encrypted.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
}
