import { describe, it, expect, vi } from 'vitest';
import { SwarmScheduler } from '../scheduler.js';
import type { LLMProvider } from '@cagan/core';
import type { SwarmTask, SwarmConfig } from '../types.js';

function makeMockProvider(): LLMProvider {
  return {
    name: 'mock',
    type: 'openai-compatible',
    baseUrl: 'http://mock',
    apiKey: 'key',
    defaultModel: 'mock',
    chat: vi.fn().mockResolvedValue({
      id: 'id',
      model: 'mock',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Task complete.' }, finishReason: 'stop' }],
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 }
    }),
    chatStream: vi.fn().mockImplementation(async function* () {}),
    countTokens: vi.fn().mockResolvedValue(50),
    getModels: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true)
  };
}

const BASE_CONFIG: SwarmConfig = {
  maxParallelAgents: 3,
  conflictResolution: 'merge',
  continueOnFailure: true,
  dryRun: false,
  provider: 'mock',
  model: 'mock',
  workspaceRoot: '/tmp/test'
};

describe('SwarmScheduler', () => {
  describe('getReadyTasks', () => {
    it('returns tasks with no dependencies when all are pending', () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: '', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'pending' },
        { id: 't2', description: '', mode: 'code', dependencies: ['t1'], inputs: [], outputs: [], priority: 'medium', status: 'pending' }
      ];
      const ready = scheduler.getReadyTasks(tasks);
      expect(ready.map(t => t.id)).toEqual(['t1']);
    });

    it('returns dependent tasks once dependency is completed', () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: '', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'completed' },
        { id: 't2', description: '', mode: 'code', dependencies: ['t1'], inputs: [], outputs: [], priority: 'medium', status: 'pending' }
      ];
      const ready = scheduler.getReadyTasks(tasks);
      expect(ready.map(t => t.id)).toContain('t2');
    });

    it('does not return already running tasks', () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: '', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'running' }
      ];
      const ready = scheduler.getReadyTasks(tasks);
      expect(ready).toHaveLength(0);
    });
  });

  describe('isComplete', () => {
    it('returns true when all tasks are completed', () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: '', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'completed' },
        { id: 't2', description: '', mode: 'test', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'completed' }
      ];
      expect(scheduler.isComplete(tasks)).toBe(true);
    });

    it('returns false when some tasks are pending', () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: '', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'completed' },
        { id: 't2', description: '', mode: 'test', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'pending' }
      ];
      expect(scheduler.isComplete(tasks)).toBe(false);
    });

    it('returns true when all tasks are either completed or failed', () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: '', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'completed' },
        { id: 't2', description: '', mode: 'test', dependencies: [], inputs: [], outputs: [], priority: 'medium', status: 'failed' }
      ];
      expect(scheduler.isComplete(tasks)).toBe(true);
    });
  });

  describe('schedule (integration)', () => {
    it('completes a single-task swarm', async () => {
      const scheduler = new SwarmScheduler(makeMockProvider());
      const tasks: SwarmTask[] = [
        { id: 't1', description: 'Write hello world', mode: 'code', dependencies: [], inputs: [], outputs: ['src/hello.ts'], priority: 'high', status: 'pending' }
      ];
      const result = await scheduler.schedule(tasks, BASE_CONFIG);
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(0);
    }, 10_000);

    it('respects dependency order', async () => {
      const order: string[] = [];
      const provider = makeMockProvider();
      (provider.chat as ReturnType<typeof vi.fn>).mockImplementation(async (msgs) => {
        // Record order of task execution by inspecting the prompt
        const content = msgs[1]?.content ?? '';
        const match = content.match(/Task: (.+)/);
        if (match) order.push(match[1]);
        return {
          id: 'id',
          model: 'mock',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Done.' }, finishReason: 'stop' }],
          usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 }
        };
      });

      const scheduler = new SwarmScheduler(provider);
      const tasks: SwarmTask[] = [
        { id: 'first', description: 'First task', mode: 'code', dependencies: [], inputs: [], outputs: [], priority: 'high', status: 'pending' },
        { id: 'second', description: 'Second task', mode: 'test', dependencies: ['first'], inputs: [], outputs: [], priority: 'medium', status: 'pending' }
      ];
      await scheduler.schedule(tasks, { ...BASE_CONFIG, maxParallelAgents: 1 });
      // First task should complete before second starts
      expect(order[0]).toContain('First');
      expect(order[1]).toContain('Second');
    }, 10_000);
  });
});
