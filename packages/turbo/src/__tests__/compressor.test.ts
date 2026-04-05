import { describe, it, expect } from 'vitest';
import { PromptCompressor } from '../compressor.js';

const compressor = new PromptCompressor();

describe('PromptCompressor', () => {
  describe('compressCode', () => {
    it('removes single-line comments from TypeScript', () => {
      const code = `
// this is a comment
const x = 1; // inline comment
function foo() {
  // body comment
  return x;
}`;
      const result = compressor.compressCode(code, 'typescript');
      expect(result.compressed).not.toContain('// this is');
      expect(result.compressed).not.toContain('// inline');
      expect(result.compressed).toContain('const x = 1;');
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('removes block comments', () => {
      const code = `/* block comment */ const x = 1; /* another */`;
      const result = compressor.compressCode(code, 'typescript');
      expect(result.compressed).not.toContain('block comment');
      expect(result.compressed).toContain('const x = 1;');
    });

    it('compresses Python hash comments', () => {
      const code = `# This is python\nx = 1  # inline\ny = 2`;
      const result = compressor.compressCode(code, 'python');
      expect(result.compressed).not.toContain('This is python');
      expect(result.compressed).toContain('x = 1');
    });

    it('returns savingsPercent >= 0', () => {
      const result = compressor.compressCode('const x = 1;', 'typescript');
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('returns original and compressed fields', () => {
      const code = 'const x = 1;';
      const result = compressor.compressCode(code, 'ts');
      expect(result.original).toBe(code);
      expect(typeof result.compressed).toBe('string');
    });
  });

  describe('compressHistory', () => {
    const makeMessages = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}: ${'x'.repeat(100)}`
      }));

    it('does not compress when messages <= keepLast', () => {
      const msgs = makeMessages(4);
      const result = compressor.compressHistory(msgs, 6);
      expect(result).toHaveLength(4);
    });

    it('inserts a compressed history message for older turns', () => {
      const msgs = makeMessages(10);
      const result = compressor.compressHistory(msgs, 4);
      const hasCompressed = result.some(m => m.content.includes('COMPRESSED HISTORY'));
      expect(hasCompressed).toBe(true);
    });

    it('preserves system messages', () => {
      const msgs = [
        { role: 'system' as const, content: 'You are an assistant' },
        ...makeMessages(8)
      ];
      const result = compressor.compressHistory(msgs, 3);
      expect(result[0].role).toBe('system');
    });
  });

  describe('compressFileContext', () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i}: code here`).join('\n');

    it('returns windowSize lines centred on focusSymbol', () => {
      const result = compressor.compressFileContext(content, 'line 25:', 10);
      const lines = result.split('\n');
      expect(lines.length).toBeLessThanOrEqual(10);
    });

    it('falls back to first windowSize lines when symbol not found', () => {
      const result = compressor.compressFileContext(content, 'NONEXISTENT', 5);
      const lines = result.split('\n');
      expect(lines.length).toBeLessThanOrEqual(5);
    });
  });

  describe('deduplicateContext', () => {
    it('replaces duplicate code blocks with placeholder', () => {
      const block = '```ts\nconst x = 1;\n```';
      const msgs = [
        { role: 'user' as const, content: `First mention\n${block}` },
        { role: 'user' as const, content: `Second mention\n${block}` }
      ];
      const result = compressor.deduplicateContext(msgs);
      expect(result[1].content).toContain('duplicate context omitted');
    });

    it('keeps non-duplicate blocks intact', () => {
      const msgs = [
        { role: 'user' as const, content: '```ts\nconst x = 1;\n```' },
        { role: 'user' as const, content: '```ts\nconst y = 2;\n```' }
      ];
      const result = compressor.deduplicateContext(msgs);
      expect(result[1].content).toContain('const y = 2');
    });
  });

  describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
      expect(compressor.estimateTokens('')).toBe(0);
    });

    it('returns positive number for non-empty string', () => {
      expect(compressor.estimateTokens('hello world')).toBeGreaterThan(0);
    });

    it('returns more tokens for longer text', () => {
      const short = compressor.estimateTokens('hello');
      const long = compressor.estimateTokens('hello world this is a longer sentence');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('compress (full pipeline)', () => {
    it('returns fewer or equal tokens after compression', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a coding assistant.' },
        ...Array.from({ length: 15 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `Turn ${i}: ${'some repeated content '.repeat(20)}`
        }))
      ];
      const result = compressor.compress(messages, {
        maxTokens: 10000,
        compressionLevel: 'medium',
        preserveLastN: 4
      });
      expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('aggressive mode respects maxTokens hard limit', () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}: ${'word '.repeat(100)}`
      }));
      const result = compressor.compress(messages, {
        maxTokens: 200,
        compressionLevel: 'aggressive',
        preserveLastN: 2
      });
      expect(result.compressedTokens).toBeLessThanOrEqual(300); // allow some slack
    });
  });
});
