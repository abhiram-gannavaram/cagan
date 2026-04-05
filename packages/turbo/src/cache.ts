/**
 * cache.ts — Semantic response cache for TurboQuant.
 *
 * Stores LLM responses locally at ~/.cagan/cache/.
 * NEVER uploads cache data anywhere. Users can delete ~/.cagan/cache/ at any time.
 *
 * Cache keys are SHA-256 hashes of normalised prompt content.
 * No personally identifiable information is stored — only hashed keys and responses.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { join, homedir } from 'node:path';
import type { Message } from '@cagan/core';

export interface CacheMetadata {
  provider: string;
  model: string;
  timestamp: number;
  tokensUsed: number;
  expiresAt: number;
}

export interface CachedResponse {
  promptHash: string;
  response: string;
  metadata: CacheMetadata;
}

export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  tokensSaved: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * ResponseCache — fully local LRU-style response cache.
 * All data stored at ~/.cagan/cache/ as JSON files.
 * No cloud sync. No telemetry. Delete the directory to wipe everything.
 */
export class ResponseCache {
  /** Local cache directory — never uploaded anywhere */
  private readonly cacheDir: string;
  private hitCount = 0;
  private missCount = 0;
  private tokensSaved = 0;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? join(homedir(), '.cagan', 'cache');
  }

  /** Store a response. Written to local disk only — no network involved. */
  async set(promptHash: string, response: string, metadata: CacheMetadata): Promise<void> {
    await this.ensureCacheDir();
    const entry: CachedResponse = { promptHash, response, metadata };
    const filePath = this.entryPath(promptHash);
    // FILE WRITE: writes response cache to ~/.cagan/cache/ on local disk only
    await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
  }

  /**
   * Retrieve a cached response by exact prompt hash.
   * Returns null on miss or if the entry has expired.
   * No network calls — reads from local disk only.
   */
  async get(promptHash: string): Promise<CachedResponse | null> {
    try {
      // FILE READ: reads cache entry from ~/.cagan/cache/ — local disk only
      const raw = await readFile(this.entryPath(promptHash), 'utf8');
      const entry: CachedResponse = JSON.parse(raw);

      if (Date.now() > entry.metadata.expiresAt) {
        await this.delete(promptHash);
        this.missCount++;
        return null;
      }

      this.hitCount++;
      this.tokensSaved += entry.metadata.tokensUsed;
      return entry;
    } catch {
      this.missCount++;
      return null;
    }
  }

  /**
   * Hash a prompt array into a deterministic cache key.
   * Uses SHA-256 of the normalised JSON representation.
   * The hash is computed locally — no data leaves the machine.
   */
  hashPrompt(messages: Message[]): string {
    // Normalise: strip whitespace variations so semantically equal prompts share a key
    const normalised = messages.map(m => ({
      role: m.role,
      content: m.content.trim().replace(/\s+/g, ' ')
    }));
    return createHash('sha256')
      .update(JSON.stringify(normalised))
      .digest('hex');
  }

  /**
   * Find a near-duplicate entry using prefix matching on the hash.
   * `threshold` controls how many leading hex chars must match (0–64).
   * Lower threshold = looser match. Recommended: 8–16.
   */
  async findSimilar(promptHash: string, threshold: number): Promise<CachedResponse | null> {
    const prefix = promptHash.slice(0, threshold);
    let entries: string[];
    try {
      // FILE READ: scans ~/.cagan/cache/ directory listing — local only
      entries = await readdir(this.cacheDir);
    } catch {
      return null;
    }

    for (const filename of entries) {
      if (!filename.endsWith('.json')) continue;
      const hash = filename.replace('.json', '');
      if (hash.startsWith(prefix) && hash !== promptHash) {
        return this.get(hash);
      }
    }
    return null;
  }

  /** Remove cache entries older than `maxAgeDays` days. */
  async cleanup(maxAgeDays: number): Promise<void> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let entries: string[];
    try {
      entries = await readdir(this.cacheDir);
    } catch {
      return;
    }

    for (const filename of entries) {
      if (!filename.endsWith('.json')) continue;
      const filePath = join(this.cacheDir, filename);
      try {
        const info = await stat(filePath);
        if (info.mtimeMs < cutoff) {
          await unlink(filePath);
        }
      } catch {
        // skip unreadable entries
      }
    }
  }

  /** Return cache statistics — all computed from local files only. */
  async getStats(): Promise<CacheStats> {
    let entries: string[];
    try {
      entries = await readdir(this.cacheDir);
    } catch {
      return {
        totalEntries: 0,
        totalSizeBytes: 0,
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: 0,
        tokensSaved: this.tokensSaved,
        oldestEntry: 0,
        newestEntry: 0
      };
    }

    let totalSizeBytes = 0;
    let oldestEntry = Infinity;
    let newestEntry = 0;
    let validEntries = 0;

    for (const filename of entries) {
      if (!filename.endsWith('.json')) continue;
      const filePath = join(this.cacheDir, filename);
      try {
        const info = await stat(filePath);
        totalSizeBytes += info.size;
        oldestEntry = Math.min(oldestEntry, info.mtimeMs);
        newestEntry = Math.max(newestEntry, info.mtimeMs);
        validEntries++;
      } catch {
        // skip
      }
    }

    const total = this.hitCount + this.missCount;
    return {
      totalEntries: validEntries,
      totalSizeBytes,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? Math.round((this.hitCount / total) * 100) : 0,
      tokensSaved: this.tokensSaved,
      oldestEntry: oldestEntry === Infinity ? 0 : oldestEntry,
      newestEntry
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private entryPath(hash: string): string {
    return join(this.cacheDir, `${hash}.json`);
  }

  private async ensureCacheDir(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  private async delete(hash: string): Promise<void> {
    try {
      await unlink(this.entryPath(hash));
    } catch {
      // already gone — ignore
    }
  }
}
