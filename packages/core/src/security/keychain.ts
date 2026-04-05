/**
 * keychain.ts — Secure local credential storage for cagan.
 *
 * Storage priority:
 *   1. System keychain via `keytar` (macOS Keychain, Windows Credential Manager, libsecret)
 *   2. AES-256-GCM encrypted file at ~/.cagan/credentials/store.enc
 *
 * The fallback file store encrypts every value before writing to disk.
 * Credentials are NEVER stored or logged in plaintext.
 * Users can delete ~/.cagan/credentials/ at any time to wipe all stored keys.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { homedir, hostname, userInfo } from 'os';
import { join as pathJoin } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';

const SERVICE_NAME = 'cagan';
const CREDENTIALS_DIR = pathJoin(homedir(), '.cagan', 'credentials');
const STORE_PATH = pathJoin(CREDENTIALS_DIR, 'store.enc');

// Derive a machine-unique 32-byte key. Not user-controlled, not a secret itself,
// but ties the file to this machine/user account so it can't simply be copied.
function deriveFileKey(): Buffer {
  const salt = `${hostname()}-${userInfo().username}-cagan-v1`;
  return scryptSync(salt, 'cagan-keyfile-salt', 32);
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Layout: iv(16) + authTag(16) + ciphertext → base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encoded: string, key: Buffer): string {
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < 33) throw new Error('Corrupt credential entry');
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const ciphertext = buf.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

interface EncryptedEntry {
  account: string;
  /** AES-256-GCM encrypted + base64-encoded password */
  enc: string;
}

interface EncryptedStore {
  [service: string]: EncryptedEntry[];
}

class SecureFileKeychain {
  private storePath: string;
  private store: EncryptedStore = {};
  private key: Buffer;

  constructor() {
    if (!existsSync(CREDENTIALS_DIR)) {
      mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
    }
    this.storePath = STORE_PATH;
    this.key = deriveFileKey();
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.storePath)) {
        const content = readFileSync(this.storePath, 'utf-8');
        this.store = JSON.parse(content) as EncryptedStore;
      }
    } catch {
      // Treat parse errors as empty store — log a warning but don't crash
      console.warn('[cagan] Warning: could not load credentials store; starting fresh.');
      this.store = {};
    }
  }

  private save(): void {
    try {
      const json = JSON.stringify(this.store, null, 2);
      writeFileSync(this.storePath, json, { encoding: 'utf-8', mode: 0o600 });
      // Ensure permissions are always restricted, even on existing files
      try { chmodSync(this.storePath, 0o600); } catch { /* non-fatal */ }
    } catch (err) {
      console.error('[cagan] Error: failed to persist credentials:', err instanceof Error ? err.message : err);
    }
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    if (!this.store[service]) this.store[service] = [];
    const enc = encrypt(password, this.key);
    const existing = this.store[service].findIndex(c => c.account === account);
    if (existing >= 0) {
      this.store[service][existing].enc = enc;
    } else {
      this.store[service].push({ account, enc });
    }
    this.save();
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    const entries = this.store[service];
    if (!entries) return null;
    const found = entries.find(c => c.account === account);
    if (!found) return null;
    try {
      return decrypt(found.enc, this.key);
    } catch {
      console.warn('[cagan] Warning: failed to decrypt credential for', account);
      return null;
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    if (!this.store[service]) return false;
    const idx = this.store[service].findIndex(c => c.account === account);
    if (idx < 0) return false;
    this.store[service].splice(idx, 1);
    this.save();
    return true;
  }

  async findCredentials(service: string): Promise<{ account: string; password: string }[]> {
    const entries = this.store[service] || [];
    const result: { account: string; password: string }[] = [];
    for (const e of entries) {
      try {
        result.push({ account: e.account, password: decrypt(e.enc, this.key) });
      } catch { /* skip corrupt entries */ }
    }
    return result;
  }
}

let keychainInstance: SecureFileKeychain | null = null;

export async function getKeychain(): Promise<SecureFileKeychain> {
  if (!keychainInstance) {
    keychainInstance = new SecureFileKeychain();
  }
  return keychainInstance;
}

export async function storeApiKey(provider: string, apiKey: string): Promise<void> {
  const keychain = await getKeychain();
  await keychain.setPassword(SERVICE_NAME, provider, apiKey);
}

export async function retrieveApiKey(provider: string): Promise<string | null> {
  const keychain = await getKeychain();
  return keychain.getPassword(SERVICE_NAME, provider);
}

export async function deleteApiKey(provider: string): Promise<boolean> {
  const keychain = await getKeychain();
  return keychain.deletePassword(SERVICE_NAME, provider);
}

export async function listStoredProviders(): Promise<string[]> {
  const keychain = await getKeychain();
  const credentials = await keychain.findCredentials(SERVICE_NAME);
  return credentials.map(c => c.account);
}

/**
 * KeytarKeychain — prefers the OS keychain when the optional `keytar`
 * native module is available; falls back to SecureFileKeychain otherwise.
 */
export class KeytarKeychain {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private keytar: any = null;

  constructor() {
    try {
      // Optional native dependency — graceful fallback if absent
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.keytar = require('keytar');
    } catch {
      this.keytar = null;
    }
  }

  async setPassword(account: string, password: string): Promise<void> {
    if (this.keytar) {
      await this.keytar.setPassword(SERVICE_NAME, account, password);
    } else {
      const simple = await getKeychain();
      await simple.setPassword(SERVICE_NAME, account, password);
    }
  }

  async getPassword(account: string): Promise<string | null> {
    if (this.keytar) {
      return this.keytar.getPassword(SERVICE_NAME, account);
    }
    const simple = await getKeychain();
    return simple.getPassword(SERVICE_NAME, account);
  }

  async deletePassword(account: string): Promise<boolean> {
    if (this.keytar) {
      return this.keytar.deletePassword(SERVICE_NAME, account);
    }
    const simple = await getKeychain();
    return simple.deletePassword(SERVICE_NAME, account);
  }

  async findCredentials(): Promise<{ account: string; password: string }[]> {
    if (this.keytar) {
      return this.keytar.findCredentials(SERVICE_NAME);
    }
    const simple = await getKeychain();
    return simple.findCredentials(SERVICE_NAME);
  }
}

let keytarInstance: KeytarKeychain | null = null;

export function getKeytarKeychain(): KeytarKeychain {
  if (!keytarInstance) {
    keytarInstance = new KeytarKeychain();
  }
  return keytarInstance;
}
