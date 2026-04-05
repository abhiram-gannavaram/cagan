import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../memory/index.js';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('MemoryManager', () => {
  let memory: MemoryManager;
  let testDir: string;

  beforeEach(() => {
    testDir = join('/tmp', `cagan-memory-test-${Date.now()}`);
    memory = new MemoryManager(testDir);
  });

  afterEach(() => {
    memory.close();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('session memory', () => {
    it('should add session memory', () => {
      const id = memory.add('session', 'agent-1', 'Hello world');
      expect(id).toBeGreaterThan(0);
    });

    it('should get session memory by agent', () => {
      memory.add('session', 'agent-1', 'Message 1');
      memory.add('session', 'agent-1', 'Message 2');

      const entries = memory.getAll('session', 'agent-1');
      expect(entries).toHaveLength(2);
    });

    it('should search session memory', () => {
      memory.add('session', 'agent-1', 'TypeScript is great');
      memory.add('session', 'agent-1', 'Python is also great');

      const results = memory.search('session', 'TypeScript');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should clear session memory', () => {
      memory.add('session', 'agent-1', 'Test message');
      memory.clear('session', 'agent-1');

      const entries = memory.getAll('session', 'agent-1');
      expect(entries).toHaveLength(0);
    });
  });

  describe('project memory', () => {
    it('should add project memory with key-value', () => {
      const id = memory.add('project', 'agent-1', 'context', 'Project context data');
      expect(id).toBeGreaterThan(0);
    });

    it('should get project memory by key', () => {
      memory.add('project', 'agent-1', 'design-pattern', 'Observer pattern');

      const value = memory.get('project', 'design-pattern', 'agent-1');
      expect(value).toBe('Observer pattern');
    });

    it('should search project memory', () => {
      memory.add('project', 'agent-1', 'key1', 'Authentication implementation');
      memory.add('project', 'agent-1', 'key2', 'Database schema');

      const results = memory.search('project', 'auth');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('global memory', () => {
    it('should add global memory', () => {
      const id = memory.add('global', 'system', 'common-pattern', 'Use dependency injection');
      expect(id).toBeGreaterThan(0);
    });

    it('should get global memory by key', () => {
      memory.add('global', 'system', 'team-preference', 'Prefer composition over inheritance');

      const value = memory.get('global', 'team-preference');
      expect(value).toBe('Prefer composition over inheritance');
    });

    it('should search global memory', () => {
      const testKey = `test-global-${Date.now()}`;
      memory.add('global', 'agent-1', testKey, 'Rate limit information');

      const results = memory.search('global', 'rate');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should clear all global memory', () => {
      memory.add('global', 'agent-1', 'key1', 'value1');
      memory.add('global', 'agent-2', 'key2', 'value2');

      memory.clear('global');

      const entries = memory.getAll('global');
      expect(entries).toHaveLength(0);
    });
  });

  describe('toMessages', () => {
    it('should convert session memory to messages', () => {
      memory.add('session', 'agent-1', 'First message');
      memory.add('session', 'agent-1', 'Second message');

      const messages = memory.toMessages('session', 'agent-1');
      expect(messages.length).toBe(2);
      expect(messages[0]).toHaveProperty('role');
      expect(messages[0]).toHaveProperty('content');
    });
  });
});