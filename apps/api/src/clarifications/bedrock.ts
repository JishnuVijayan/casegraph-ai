/**
 * Bedrock phrasing assist — gated by deterministic essentials rules.
 * Never invents bank verification or free-form facts without a rule-flagged gap.
 */
import { coreServiceEnabled } from '../common/core-services';

export const BEDROCK_CLIENT = Symbol('BEDROCK_CLIENT');

export type BedrockQuestion = { kind: string; prompt: string; priority: number; fingerprint: string; context: unknown };
export type BedrockClientLike = { invoke: (prompt: string) => Promise<string> };

export function bedrockEnabled(): boolean {
  return coreServiceEnabled('BEDROCK_ENABLED');
}

const ALLOWED_KINDS = new Set(['MISSING_REFERENCE', 'MISSING_AMOUNT', 'MISSING_TIME', 'AMOUNT_CONFLICT', 'TIME_CONFLICT']);

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no-json');
  return JSON.parse(text.slice(start, end + 1));
}

/** Apply Bedrock rephrasing; on any failure return the deterministic prompts unchanged. */
export async function polishQuestions(client: BedrockClientLike | null | undefined, questions: BedrockQuestion[]): Promise<BedrockQuestion[]> {
  if (!client || !bedrockEnabled() || questions.length === 0) return questions;
  const top = questions[0];
  if (!ALLOWED_KINDS.has(top.kind)) return questions;
  try {
    const raw = await client.invoke(JSON.stringify({
      instruction: 'Return ONLY JSON {"prompt":"..."} with one short victim-facing question for the missing or conflicting essential. Do not invent amounts, bank verification, UTR values, or identities. Keep under 160 characters. Allow Unknown as an answer.',
      kind: top.kind,
      currentPrompt: top.prompt,
    }));
    const parsed = extractJsonObject(raw) as { prompt?: unknown };
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
    if (!prompt || prompt.length > 200 || /verified|bank confirmed|fir|arrest/i.test(prompt)) return questions;
    return [{ ...top, prompt }, ...questions.slice(1)];
  } catch {
    return questions;
  }
}

export async function createDefaultBedrockClient(): Promise<BedrockClientLike | null> {
  if (!bedrockEnabled()) return null;
  const region = process.env.AWS_REGION || 'ap-south-1';
  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';
  const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({ region });
  return {
    invoke: async (prompt: string) => {
      const body = JSON.stringify({
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 120, temperature: 0 },
      });
      const response = await client.send(new InvokeModelCommand({
        modelId, contentType: 'application/json', accept: 'application/json', body: Buffer.from(body),
      }));
      const decoded = JSON.parse(Buffer.from(response.body).toString('utf8')) as {
        output?: { message?: { content?: { text?: string }[] } };
        content?: { text?: string }[];
        completion?: string;
      };
      const text = decoded.output?.message?.content?.[0]?.text
        ?? decoded.content?.[0]?.text
        ?? decoded.completion
        ?? '';
      if (!text || text.length > 2000) throw new Error('empty');
      return text;
    },
  };
}
