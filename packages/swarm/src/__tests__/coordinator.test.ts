import { describe, it, expect, vi } from 'vitest';
import { SwarmCoordinator } from '../coordinator.js';
import type { LLMProvider } from '@cagan/core';
import type { SwarmTask } from '../types.js';

function makeMockProvider(responseContent: string): LLMProvider {
  return {
    name: 'mock',
    type: 'openai-compatible',
    baseUrl: 'http://mock',
    apiKey: 'mock-key',
    defaultModel: 'mock-model',
    chat: vi.fn().mockResolvedValue({
      id: 'mock-id',
      model: 'mock-model',
      choices: [{ index: 0, message: { role: 'assistant', content: responseContent }, finishReason: 'stop' }],
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
    }),
    chatStream: vi.fn().mockImplementation(async function* () {}),
    countTokens: vi.fn().mockResolvedValue(100),
    getModels: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true)
  };
}

const MOCK_TASKS: SwarmTask[] = [
  {
    id: 'design_api',
    description: 'Design the API structure',
    mode: 'architect',
    dependencies: [],
    inputs: [],
    outputs: ['docs/api-design.md'],
    priority: 'high',
    estimatedTokens: 800,
    status: 'pending'
  },
  {
    id: 'implement_api',
    description: 'Implement the API endpoints',
    mode: 'code',
    dependencies: ['design_api'],
    inputs: ['docs/api-design.md'],
    outputs: ['src/api/routes.ts'],
    priority: 'high',
    estimatedTokens: 2000,
    status: 'pending'
  },
  {
    id: 'write_tests',
    description: 'Write API tests',
    mode: 'test',
    dependencies: ['implement_api'],
    inputs: ['src/api/routes.ts'],
    outputs: ['tests/api.test.ts'],
    priority: 'medium',
    estimatedTokens: 1500,
    status: 'pending'
  },
  {
    id: 'write_docs',
    description: 'Write API documentation',
    mode: 'doc',
    dependencies: ['implement_api'],
    inputs: ['src/api/routes.ts'],
    outputs: ['docs/api.md'],
    priority: 'low',
    estimatedTokens: 1000,
    status: 'pending'
  }
];

describe('SwarmCoordinator', () => {
  describe('decomposeTask', () => {
    it('parses LLM JSON response into SwarmTasks', async () => {
      const provider = makeMockProvider(JSON.stringify(MOCK_TASKS));
      const coordinator = new SwarmCoordinator(provider);

      const tasks = await coordinator.decomposeTask('Build a REST API');
      expect(tasks).toHaveLength(4);
      expect(tasks[0].id).toBe('design_api');
      expect(tasks[1].mode).toBe('code');
    });

    it('handles wrapped JSON response { tasks: [...] }', async () => {
      const provider = makeMockProvider(JSON.stringify({ tasks: MOCK_TASKS }));
      const coordinator = new SwarmCoordinator(provider);

      const tasks = await coordinator.decomposeTask('Build a REST API');
      expect(tasks).toHaveLength(4);
    });

    it('throws on invalid JSON response', async () => {
      const provider = makeMockProvider('not json at all');
      const coordinator = new SwarmCoordinator(provider);

      await expect(coordinator.decomposeTask('Build something')).rejects.toThrow();
    });
  });

  describe('buildDAG', () => {
    let coordinator: SwarmCoordinator;
    beforeEach(() => {
      coordinator = new SwarmCoordinator(makeMockProvider('[]'));
    });

    it('assigns level 0 to tasks with no dependencies', () => {
      const dag = coordinator.buildDAG(MOCK_TASKS);
      const root = dag.find(n => n.task.id === 'design_api')!;
      expect(root.level).toBe(0);
    });

    it('assigns level 1 to direct dependents of level 0', () => {
      const dag = coordinator.buildDAG(MOCK_TASKS);
      const impl = dag.find(n => n.task.id === 'implement_api')!;
      expect(impl.level).toBe(1);
    });

    it('assigns level 2 to tasks depending on level 1', () => {
      const dag = coordinator.buildDAG(MOCK_TASKS);
      const tests = dag.find(n => n.task.id === 'write_tests')!;
      const docs = dag.find(n => n.task.id === 'write_docs')!;
      expect(tests.level).toBe(2);
      expect(docs.level).toBe(2);
    });

    it('wires dependent nodes correctly', () => {
      const dag = coordinator.buildDAG(MOCK_TASKS);
      const impl = dag.find(n => n.task.id === 'implement_api')!;
      expect(impl.dependencies.map(d => d.task.id)).toContain('design_api');
    });
  });

  describe('validateDAG', () => {
    let coordinator: SwarmCoordinator;
    beforeEach(() => {
      coordinator = new SwarmCoordinator(makeMockProvider('[]'));
    });

    it('passes for a valid acyclic graph', () => {
      const dag = coordinator.buildDAG(MOCK_TASKS);
      const result = coordinator.validateDAG(dag);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing dependency references', () => {
      const tasks: SwarmTask[] = [
        { ...MOCK_TASKS[0], dependencies: ['nonexistent_task'] }
      ];
      const dag = coordinator.buildDAG(tasks);
      const result = coordinator.validateDAG(dag);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent_task'))).toBe(true);
    });
  });

  describe('getParallelWaves', () => {
    it('groups tasks by level into waves', () => {
      const coordinator = new SwarmCoordinator(makeMockProvider('[]'));
      const dag = coordinator.buildDAG(MOCK_TASKS);
      const waves = coordinator.getParallelWaves(dag);

      expect(waves.length).toBe(3);
      expect(waves[0].map(t => t.id)).toEqual(['design_api']);
      expect(waves[1].map(t => t.id)).toEqual(['implement_api']);
      expect(waves[2].map(t => t.id)).toContain('write_tests');
      expect(waves[2].map(t => t.id)).toContain('write_docs');
    });
  });

  describe('estimateSwarmCost', () => {
    it('sums estimated tokens across all tasks', () => {
      const coordinator = new SwarmCoordinator(makeMockProvider('[]'));
      const cost = coordinator.estimateSwarmCost(MOCK_TASKS);
      const expectedTokens = MOCK_TASKS.reduce((s, t) => s + (t.estimatedTokens ?? 0), 0);
      expect(cost.estimatedTokens).toBe(expectedTokens);
      expect(cost.totalTasks).toBe(4);
    });
  });
});

// Make beforeEach available at module scope
import { beforeEach } from 'vitest';
