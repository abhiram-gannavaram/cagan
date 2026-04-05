import { homedir } from 'os';
import { join as pathJoin } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const SERVICE_NAME = 'cagan';
const CREDENTIALS_DIR = pathJoin(homedir(), '.cagan', 'credentials');

interface CredentialsStore {
  [service: string]: {
    account: string;
    password: string;
  }[];
}

class SimpleKeychain {
  private storePath: string;
  private store: CredentialsStore = {};

  constructor() {
    if (!existsSync(CREDENTIALS_DIR)) {
      mkdirSync(CREDENTIALS_DIR, { recursive: true });
    }
    this.storePath = pathJoin(CREDENTIALS_DIR, 'store.enc');
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.storePath)) {
        const content = readFileSync(this.storePath, 'utf-8');
        this.store = JSON.parse(content);
      }
    } catch {
      this.store = {};
    }
  }

  private save(): void {
    try {
      writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch {}
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    if (!this.store[service]) {
      this.store[service] = [];
    }

    const existing = this.store[service].findIndex(c => c.account === account);
    if (existing >= 0) {
      this.store[service][existing].password = password;
    } else {
      this.store[service].push({ account, password });
    }

    this.save();
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    const credentials = this.store[service];
    if (!credentials) return null;

    const found = credentials.find(c => c.account === account);
    return found?.password || null;
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    if (!this.store[service]) return false;

    const index = this.store[service].findIndex(c => c.account === account);
    if (index >= 0) {
      this.store[service].splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  async findCredentials(service: string): Promise<{ account: string; password: string }[]> {
    return this.store[service] || [];
  }
}

let keychainInstance: SimpleKeychain | null = null;

export async function getKeychain(): Promise<SimpleKeychain> {
  if (!keychainInstance) {
    keychainInstance = new SimpleKeychain();
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

export class KeytarKeychain {
  private keytar: any = null;

  constructor() {
    try {
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
    } else {
      const simple = await getKeychain();
      return simple.getPassword(SERVICE_NAME, account);
    }
  }

  async deletePassword(account: string): Promise<boolean> {
    if (this.keytar) {
      return this.keytar.deletePassword(SERVICE_NAME, account);
    } else {
      const simple = await getKeychain();
      return simple.deletePassword(SERVICE_NAME, account);
    }
  }

  async findCredentials(): Promise<{ account: string; password: string }[]> {
    if (this.keytar) {
      return this.keytar.findCredentials(SERVICE_NAME);
    } else {
      const simple = await getKeychain();
      return simple.findCredentials(SERVICE_NAME);
    }
  }
}

let keytarInstance: KeytarKeychain | null = null;

export function getKeytarKeychain(): KeytarKeychain {
  if (!keytarInstance) {
    keytarInstance = new KeytarKeychain();
  }
  return keytarInstance;
}