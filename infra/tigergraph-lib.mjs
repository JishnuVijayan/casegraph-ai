export const GRAPH_MIN_BYTES = 8_000_000_000;
export function assessGraphHost(info) {
  if (!info || !Number.isFinite(info.NCPU) || !Number.isFinite(info.MemTotal) || typeof info.Architecture !== 'string') {
    return { status: 'UNAVAILABLE', reason: 'INVALID_DOCKER_INFO', ready: false };
  }
  if (!['x86_64', 'amd64'].includes(info.Architecture)) {
    return { status: 'UNSUPPORTED_PLATFORM', reason: 'TIGERGRAPH_DOCKER_REQUIRES_X86_64', ready: false };
  }
  if (info.NCPU < 4 || info.MemTotal < GRAPH_MIN_BYTES) {
    return { status: 'INSUFFICIENT_RESOURCES', reason: 'MINIMUM_4_CPUS_AND_8_GB_FOR_TIGERGRAPH_ALONE', ready: false };
  }
  return { status: 'HOST_ELIGIBLE', reason: 'INSTALLATION_AND_LICENSE_REVIEW_STILL_REQUIRED', ready: false };
}
export function parseGraphHealth(pingText, versionText) {
  if (Buffer.byteLength(pingText) > 4096 || Buffer.byteLength(versionText) > 16384) throw new Error('Unbounded response');
  const ping = JSON.parse(pingText);
  if (!ping || ![false, 'false'].includes(ping.error) || ping.message !== 'pong') throw new Error('Invalid ping');
  const version = versionText.match(/\b(4\.2\.\d+)\b/)?.[1];
  if (!version) throw new Error('Unrecognized version');
  return { status: 'SERVICE_RESPONDING', version, graphReady: false, reason: 'GRAPH_AND_INSTALLED_QUERY_NOT_VERIFIED' };
}
