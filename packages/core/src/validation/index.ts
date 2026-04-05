import type { ProviderKind } from '../detection/index.js';

export interface ValidationResult {
  ok: boolean;
  latencyMs: number;
  model?: string;
  error?: string;
}

const OPENAI_COMPAT_BASES: Partial<Record<ProviderKind, string>> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  groq: 'https://api.groq.com/openai/v1'
};

const DEFAULT_TEST_MODELS: Partial<Record<ProviderKind, string>> = {
  anthropic: 'claude-3-5-haiku-20241022',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-small-latest',
  groq: 'llama-3.1-8b-instant',
  'azure-openai': 'gpt-4o'
};

export async function validateApiKey(
  kind: ProviderKind,
  apiKey: string,
  model?: string
): Promise<ValidationResult> {
  const start = Date.now();
  const testModel = model ?? DEFAULT_TEST_MODELS[kind] ?? 'default';

  try {
    if (kind === 'anthropic') {
      return await testAnthropic(apiKey, testModel, start);
    }
    if (kind === 'gemini') {
      return await testGemini(apiKey, testModel, start);
    }
    const base = OPENAI_COMPAT_BASES[kind];
    if (base) {
      return await testOpenAICompat(base, apiKey, testModel, start);
    }
    return { ok: false, latencyMs: 0, error: `Provider "${kind}" not yet supported for validation` };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function testAnthropic(key: string, model: string, start: number): Promise<ValidationResult> {
  // NETWORK: POST api.anthropic.com/v1/messages — 1-token probe to validate key. Sends no user data.
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }]
    })
  });
  return handleResponse(res, model, start);
}

async function testOpenAICompat(base: string, key: string, model: string, start: number): Promise<ValidationResult> {
  // NETWORK: POST {base}/chat/completions — 1-token probe to validate key. Sends no user data.
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }]
    })
  });
  return handleResponse(res, model, start);
}

async function testGemini(key: string, model: string, start: number): Promise<ValidationResult> {
  // NETWORK: POST generativelanguage.googleapis.com — 1-token probe to validate key. Sends no user data.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'hi' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    }
  );
  return handleResponse(res, model, start);
}

async function handleResponse(
  res: Response,
  model: string,
  start: number
): Promise<ValidationResult> {
  const latencyMs = Date.now() - start;
  if (res.ok) return { ok: true, latencyMs, model };
  const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
  const error = body?.error?.message ?? `HTTP ${res.status}`;
  return { ok: false, latencyMs, error };
}
