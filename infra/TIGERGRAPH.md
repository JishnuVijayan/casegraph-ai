# T09 TigerGraph supported-host setup — not installed here

Status checked 2026-10-29 IST: this workspace is macOS arm64; Docker reports
`aarch64`, 10 CPUs and 8,321,712,128 bytes memory. The user confirmed no compatible
host is available. T09 is **incomplete**. No TigerGraph image was pulled, no service
started, no graph/seed/query installed, and no benchmark run. The NestJS graph
integration remains unimplemented; these are infrastructure diagnostics only.

## Sources and selected candidate

- [TigerGraph Docker instructions](https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/docker): ARM/M1 unsupported; minimum 4 CPU cores and 8 GB RAM for TigerGraph itself; recommended 8 cores/24 GB. Leave resources for other applications.
- [Community image](https://hub.docker.com/r/tigergraph/community): vendor Community Edition repository, no license key required according to vendor; operator must still review/accept its terms.
- [License, updated March 5, 2026](https://www.tigergraph.com/license-agreement/): internal-use conditions and Community benchmarking restrictions. No performance/comparison tests or published benchmark results. Sponsor/public-demo permission is not established here. No hosted paid service is authorized.
- [Health endpoint reference](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints): `/api/ping` on port 14240 returns pong; this is not evidence of an installed graph/query.

Candidate: `tigergraph/community:4.2.5`, vendor registry metadata inspected only:
`sha256:190c505bf5c22c90e597b901ea8fcfaf2da7e883b688d7d48c8fe60af0a20ddb`.
Runtime version is **not observed**. Do not describe 4.2.5 as installed or tested.

## Commands available now

```bash
npm run graph:config
npm run graph:preflight
npm run graph:health
```

Config validates Compose syntax, not runtime compatibility. Preflight refuses ARM
and insufficient CPU/memory with nonzero exit codes. An eligible host still reports
`ready:false` until actual installation. Health uses bounded Docker exec calls to
local ping and GSQL version, emits sanitized statuses and never claims a graph or
installed query. It does not accept remote URLs, tokens, SQL or GSQL input. Fixture
unit tests are explicitly mocked diagnostics, not real TigerGraph tests.

## Operator runbook for a compatible host (UNEXECUTED)

Use an existing owned Intel/AMD x86-64 machine with local Docker, sufficient resources,
and operator-reviewed licensing. Do not use ARM emulation as a supported deployment.
The isolated template is independent from PostgreSQL; no host ports are published,
no SSH is exposed, no repository/evidence directory is mounted, and the runtime
network is internal. Named volume `casegraph-graph_tigergraph-data` preserves data.
The image's default credentials must be changed interactively; no password belongs
in command arguments, Git or logs. Do not load private/real case records.

After preflight passes and the operator agrees to applicable license terms:

```bash
npm run graph:config
npm run graph:preflight
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml pull
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml up -d
# Change Linux account password interactively; never print it.
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml exec --user root tigergraph passwd tigergraph
# Start services without publishing a host port.
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml exec --user tigergraph tigergraph bash -lc 'gadmin start all'
# Change the database password interactively as described in vendor instructions.
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml exec --user tigergraph tigergraph bash -lc 'gsql ALTER PASSWORD tigergraph'
npm run graph:health
# Stop container while preserving its named volume; never add -v.
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml down
```

This template/runbook has passed syntax/static checks only. Credential rotation,
service startup, persistence, actual version and seed repeatability remain untested.
Do not broaden port/network access to connect the application until authentication,
least privilege and the synthetic projection are designed and verified on the host.
Do not reset or repurpose an existing TigerGraph volume. T10 owns the case schema,
20-case graph projection and installed path query; T09 cannot be marked complete
without its required supported runtime/seed evidence. No seed script is claimed here.
