import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAICompatibleProvider } from '../providers/openai-compatible.js';

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider;

  beforeEach(() => {
    provider = new OpenAICompatibleProvider('test', {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      defaultModel: 'test-model'
    });
  });

  it('should have correct name and type', () => {
    expect(provider.name).toBe('test');
    expect(provider.type).toBe('openai-compatible');
  });

  it('should have baseUrl and apiKey set', () => {
    expect(provider.baseUrl).toBe('https://api.test.com/v1');
    expect(provider.apiKey).toBe('test-key');
    expect(provider.defaultModel).toBe('test-model');
  });

  it('should count tokens approximately', async () => {
    const tokens = await provider.countTokens([
      { role: 'user', content: 'Hello world' }
    ]);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should return default model in getModels when API fails', async () => {
    const models = await provider.getModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('test-model');
  });

  it('healthCheck should return false when API is unreachable', async () => {
    const healthy = await provider.healthCheck();
    expect(healthy).toBe(false);
  });
});

describe('Provider Interface Contract', () => {
  it('should implement LLMProvider interface methods', () => {
    const provider = new OpenAICompatibleProvider('test', {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      defaultModel: 'test-model'
    });

    expect(typeof provider.chat).toBe('function');
    expect(typeof provider.chatStream).toBe('function');
    expect(typeof provider.countTokens).toBe('function');
    expect(typeof provider.getModels).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
  });
});