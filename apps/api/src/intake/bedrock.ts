import { Inject, Injectable, Optional } from '@nestjs/common';
import { coreServiceEnabled } from '../common/core-services';

/**
 * Bedrock Converse wrapper for complaint intake. Everything the model returns is untrusted text:
 * callers parse it as JSON and validate it against a schema before using any of it.
 */
export const CONVERSE_CLIENT = Symbol('CONVERSE_CLIENT');

export type ConverseBlock =
  | { text: string }
  | { image: { format: 'png' | 'jpeg' | 'webp' | 'gif'; source: { bytes: Uint8Array } } }
  | { document: { format: 'pdf' | 'docx' | 'txt'; name: string; source: { bytes: Uint8Array } } };
export type ConverseRequest = {
  system: string; content: ConverseBlock[]; maxTokens: number; temperature: number; timeoutMs: number;
};
/** Injectable seam: tests pass a fake, production uses the AWS SDK. */
export type ConverseClientLike = { converse: (request: ConverseRequest) => Promise<string> };

export const DEFAULT_MODEL = 'apac.amazon.nova-pro-v1:0';
export const modelId = () => process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL;
export const converseEnabled = () => coreServiceEnabled('BEDROCK_ENABLED');

export async function createDefaultConverseClient(): Promise<ConverseClientLike | null> {
  if (!converseEnabled()) return null;
  const region = process.env.AWS_REGION || 'ap-south-1';
  const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({ region, maxAttempts: 2 });
  return {
    converse: async (request) => {
      const response = await client.send(new ConverseCommand({
        modelId: modelId(),
        system: [{ text: request.system }],
        messages: [{ role: 'user', content: request.content as never }],
        inferenceConfig: { maxTokens: request.maxTokens, temperature: request.temperature },
      }), { abortSignal: AbortSignal.timeout(request.timeoutMs) });
      const text = (response.output?.message?.content ?? []).map((block) => ('text' in block && block.text) || '').join('');
      if (!text.trim()) throw new Error('empty-model-output');
      return text;
    },
  };
}

export class ModelOutputError extends Error {}
export class ModelUnavailableError extends Error {}

/** Pulls the first JSON object out of model text (models sometimes wrap it in prose or code fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ModelOutputError('no-json');
  try { return JSON.parse(text.slice(start, end + 1)); } catch { throw new ModelOutputError('bad-json'); }
}

@Injectable()
export class BedrockAi {
  private client: ConverseClientLike | null | undefined;
  constructor(@Optional() @Inject(CONVERSE_CLIENT) private readonly injected?: ConverseClientLike | null) {}
  async available(): Promise<ConverseClientLike | null> {
    if (this.injected !== undefined) return this.injected;
    if (this.client !== undefined) return this.client;
    try { this.client = await createDefaultConverseClient(); } catch { this.client = null; }
    return this.client;
  }
  /**
   * One model call that must return JSON accepted by `validate` (throws on invalid input).
   * Invalid JSON or schema failures are retried once with a stricter reminder, then ModelOutputError.
   * Transport failures raise ModelUnavailableError. Raw content is never logged.
   */
  async json<T>(request: Omit<ConverseRequest, 'maxTokens' | 'temperature' | 'timeoutMs'> & Partial<ConverseRequest>,
    validate: (value: unknown) => T): Promise<T> {
    const client = await this.available();
    if (!client) throw new ModelUnavailableError('model-disabled');
    const base: ConverseRequest = { maxTokens: 3000, temperature: 0, timeoutMs: 45000, ...request };
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = attempt === 0 ? base.content
        : [...base.content, { text: 'Your previous reply was not valid. Reply with ONE JSON object only, exactly in the requested shape, with no other text.' }];
      let text: string;
      try { text = await client.converse({ ...base, content }); } catch { throw new ModelUnavailableError('model-call-failed'); }
      try { return validate(extractJson(text)); } catch { /* retry once */ }
    }
    throw new ModelOutputError('invalid-model-output');
  }
}
