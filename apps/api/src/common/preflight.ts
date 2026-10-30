import { coreServiceEnabled } from './core-services';

export type PreflightResult = { service: string; ok: boolean; detail: string };

/** Startup check of the core services. Reports each one; the caller decides whether to abort. */
export async function preflightCoreServices(): Promise<PreflightResult[]> {
  const results: PreflightResult[] = [];
  const region = process.env.AWS_REGION || 'ap-south-1';
  const awsCredentials = async (client: { config: { credentials: () => Promise<unknown> } }) => { await client.config.credentials(); };

  if (coreServiceEnabled('TEXTRACT_ENABLED')) {
    try {
      const { TextractClient } = await import('@aws-sdk/client-textract');
      await awsCredentials(new TextractClient({ region }) as never);
      results.push({ service: 'textract', ok: true, detail: `credentials resolved (${region})` });
    } catch { results.push({ service: 'textract', ok: false, detail: 'AWS credentials not found; run `aws configure`' }); }
  } else results.push({ service: 'textract', ok: false, detail: 'disabled by TEXTRACT_ENABLED=false' });

  if (coreServiceEnabled('BEDROCK_ENABLED')) {
    try {
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      await awsCredentials(new BedrockRuntimeClient({ region }) as never);
      results.push({ service: 'bedrock', ok: true, detail: `credentials resolved (${region}), model ${process.env.BEDROCK_MODEL_ID || 'apac.amazon.nova-pro-v1:0'}` });
    } catch { results.push({ service: 'bedrock', ok: false, detail: 'AWS credentials not found; run `aws configure`' }); }
  } else results.push({ service: 'bedrock', ok: false, detail: 'disabled by BEDROCK_ENABLED=false' });

  if (coreServiceEnabled('TIGERGRAPH_ENABLED')) {
    const port = process.env.TIGERGRAPH_LOCAL_PORT ?? '14240';
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
      results.push({ service: 'tigergraph', ok: response.ok, detail: response.ok ? `tunnel reachable on ${port}` : `tunnel on ${port} returned ${response.status}` });
    } catch { results.push({ service: 'tigergraph', ok: false, detail: `no TigerGraph on 127.0.0.1:${port}; run npm run aws:tg:start and open the SSH tunnel` }); }
  } else results.push({ service: 'tigergraph', ok: false, detail: 'disabled by TIGERGRAPH_ENABLED=false' });

  // Voice typing is an extra: without a key the browser's own dictation is used, so this never blocks startup.
  results.push({ service: 'voice', ok: true, detail: process.env.SARVAM_API_KEY?.trim() ? 'Sarvam speech-to-text key found' : 'no SARVAM_API_KEY; browser dictation will be used' });

  return results;
}
