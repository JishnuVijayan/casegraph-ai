/**
 * Textract, Bedrock and TigerGraph are core services: ON unless explicitly set to `false`
 * (tests and offline work only). An unset variable means enabled.
 */
export function coreServiceEnabled(name: 'TEXTRACT_ENABLED' | 'BEDROCK_ENABLED' | 'TIGERGRAPH_ENABLED'): boolean {
  const flag = process.env[name] ?? 'true';
  if (!['true', 'false'].includes(flag)) throw new Error(`${name} must be true or false.`);
  return flag === 'true';
}
