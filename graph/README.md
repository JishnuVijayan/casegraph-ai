# T10 graph source package — live verification pending

This package contains **candidate TigerGraph 4.2.5 source**, not an installed or
compiler-verified graph/query. T09 still needs a compatible runtime. The user plans
a future x86-64 EC2 demo; no EC2 instance, cloud account connection or paid resource
was provisioned here. Offline contract tests are explicitly fixtures and never
substitute paths in the API. Existing app UI still reports investigation unimplemented.

## What is prepared

- Seven vertex types matching DATA_MODEL.md, six primary source-bearing edge types,
  and two reverse edge types for the four-hop traversal. Graph: `CaseGraphDemoV1`.
- A deterministic fixture for the same 20 case UUIDs as PostgreSQL bootstrap. Each
  case has its own opaque synthetic VPA, phone and handle. The Kochi/Bengaluru pair
  has different VPAs and a shared fictional second-layer account. Goa is unrelated.
  Two benign look-alikes share a synthetic generic-text hint and domain; they do
  not share a bank account and are not returned as financial leads.
- `find_case_links(case_id,max_hops,allowed_case_ids)` traverses exactly four edges:
  `CaseReport -> UPI_VPA -> BankAccount <- UPI_VPA <- CaseReport`. Only `max_hops=4`
  is accepted initially, with at most 20 allowed case IDs. Other bounds/scope return
  no paths with `INVALID_SCOPE_OR_HOP_BOUND`.
- Both endpoint cases and every edge's source-case attribution are checked. A path
  includes four evidence-reference IDs and SYSTEM_INFERENCE / UNVERIFIED /
  NEEDS_REVIEW / SYNTHETIC_FIXTURE labels. Query ignores text/hosting similarity.
- Separate administrative `verify_fixture_inventory` query checks seven vertex
  counts; never expose this inventory query through the application.

**All financial relationships are authored synthetic scenarios**, not uploaded
screenshots, authorized external records or real ledger verification. EvidenceRef
IDs use the `fx:` namespace and identify fixture rows, not PostgreSQL evidence-file
IDs. Do not send these IDs to the T06 upload viewer. A relation is an investigative
lead for review, not a determination of criminal identity.

## Security contract

`allowed_case_ids` is an internal trusted-backend parameter, never a user-controlled
permission claim. T11 must derive it from active PostgreSQL investigation grants,
recheck returned cases/sources and keep TigerGraph credentials server-side. Direct
administrative query credentials can bypass that application boundary. No public
API or analyst UI is added in T10. Revocation/IDOR protection for a live graph API
remains a required T11 task. Empty/partial scope returns no unauthorized path.

## Offline commands (no TigerGraph or paid APIs)

```bash
npm run graph:test
npm run graph:bundle
npm run graph:bundle
```

Bundle output is ignored `.local/graph-t10-bundle`, mode 0700; files mode 0600.
It contains CSVs, schema, loading job, repeatable seed command, query files and a
SHA-256 manifest. Identical reruns do nothing to existing files. Different existing
files cause failure without overwrite. Keep old bundles when reviewing a revision;
never silently replace operator changes. Manifest `liveVerified:false` is deliberate.
The loader uses stable IDs and attributes so repeating the seed should preserve
counts; this has not yet been confirmed on TigerGraph. No DROP/reset is generated.
Schema/load job creation is a one-time action on a fresh dedicated database, not an
idempotent schema migration. Do not run on a shared/previously populated instance.

## Future compatible-host installation (UNEXECUTED)

First complete [T09 setup](../infra/TIGERGRAPH.md), including current licensing,
credential rotation and actual version verification. Use an Intel/AMD x86-64 Linux
host that meets vendor requirements. EC2 compute/storage may cost money; deployment,
instance size/region and budget must be reviewed before provisioning. No performance
or comparison benchmarks are included. Public demo permission is not inferred from
technical EC2 compatibility or Community availability.

On a supported host with this checkout and Node installed:

```bash
npm run graph:preflight
npm run graph:bundle
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml cp .local/graph-t10-bundle/. tigergraph:/home/tigergraph/casegraph-t10/
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml exec --user root tigergraph chown -R tigergraph:tigergraph /home/tigergraph/casegraph-t10
# Enter a shell; GSQL may prompt interactively for credentials. Never pass passwords in arguments.
docker compose -p casegraph-graph -f infra/tigergraph.compose.yaml exec --user tigergraph tigergraph bash
```

Inside that container, after verifying it is an empty dedicated instance:

```bash
gsql version
gsql /home/tigergraph/casegraph-t10/schema.gsql
gsql /home/tigergraph/casegraph-t10/load.gsql
gsql /home/tigergraph/casegraph-t10/seed.gsql
gsql /home/tigergraph/casegraph-t10/find_case_links.gsql
gsql /home/tigergraph/casegraph-t10/verify_fixture_inventory.gsql
```

Inspect actual compiler/load output. Fix source errors and rerun checks on the
server before claiming completion. Expected fixture vertex counts: CaseReport 20,
UPI_VPA 20, BankAccount 19, PhoneNumber 20, SocialHandle 20, PhishingDomain 19,
EvidenceRef 100. Primary edges: 20 of each reported/settlement type and 100
RELATION_SUPPORTED_BY_EVIDENCE; two reverse types are maintained by TigerGraph.

## Future live functional check (UNEXECUTED)

After password rotation and REST authentication are verified, the optional
`graph/demo-loopback.compose.yaml` adds only host-loopback 14240. Do not enable it
before securing the database or open TigerGraph ports in EC2's public security group.
An SSH tunnel can forward your local 14240 to that loopback endpoint; use your own
known host/key configuration. This package does not create SSH connections or AWS
resources. Review any deployment/network changes at that time.

Store an operator-created graph query token in ignored `.local/tigergraph.token`
as a real mode-0600 file. Never commit it, paste it into source or put it in process
arguments. The administrative verification token needs permission to run both fixed
queries; do not reuse it for the future application. Token creation/authentication
must follow the installed server's documentation and be verified on that server.

```bash
npm run graph:verify-live
```

Only loopback HTTP with optional numeric `TG_LOCAL_PORT` is accepted. Requests use
Bearer auth, fixed installed query endpoints, POST JSON, a 10-second timeout,
128 KiB response limit, and reject redirects. No GSQL, arbitrary URL or raw result
fallback is accepted. The verifier checks actual vertex counts, the expected pair,
its four source refs, unrelated/look-alike negatives, denied/empty scope and invalid
hop bounds. It prints success only after all live calls pass; otherwise it reports
`UNAVAILABLE_OR_VERIFICATION_FAILED` with `liveVerified:false` and exits nonzero.
It emits no token, raw response, timings, throughput or comparison metrics.

Repeat `seed.gsql`, rerun the live verifier and compare counts/results. Record actual
version, image digest, compile/install status, loading error counts, two seed passes,
functional outputs and source-scope checks in TASKS.md. Also verify persistence after
restart. T09/T10 stay unchecked until this evidence exists. Node fixture tests do
not validate GSQL syntax, compiler availability, CSV parser behavior or live traversal.

## Primary references reviewed for this candidate

- [Schema and reverse edges](https://www.tigergraph.com/docs/gsql-ref/4.2/ddl-and-loading/defining-a-graph-schema)
- [Loading job tutorial](https://www.tigergraph.com/docs/gsql-ref/4.2/tutorials/gsql-101/load-data-gsql-101)
- [SELECT and pattern matching](https://www.tigergraph.com/docs/gsql-ref/4.2/querying/select-statement/)
- [Accumulators](https://www.tigergraph.com/docs/gsql-ref/4.2/querying/accumulators)
- [Installed query REST API](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/built-in-endpoints)
- [License](https://www.tigergraph.com/license-agreement/)
