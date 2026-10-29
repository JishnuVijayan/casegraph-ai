import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessGraphHost, parseGraphHealth } from '../tigergraph-lib.mjs';
test('ARM and insufficient hosts cannot report TigerGraph ready', () => {
  assert.equal(assessGraphHost({ Architecture:'aarch64',NCPU:10,MemTotal:32e9 }).status,'UNSUPPORTED_PLATFORM');
  assert.equal(assessGraphHost({ Architecture:'amd64',NCPU:2,MemTotal:32e9 }).status,'INSUFFICIENT_RESOURCES');
  assert.equal(assessGraphHost({ Architecture:'x86_64',NCPU:8,MemTotal:4e9 }).status,'INSUFFICIENT_RESOURCES');
  assert.equal(assessGraphHost({}).status,'UNAVAILABLE');
  assert.deepEqual(assessGraphHost({Architecture:'x86_64',NCPU:8,MemTotal:24e9}),{status:'HOST_ELIGIBLE',reason:'INSTALLATION_AND_LICENSE_REVIEW_STILL_REQUIRED',ready:false});
});
test('explicitly mocked ping/version fixtures never claim an installed graph or query', () => {
  assert.deepEqual(parseGraphHealth('{"error":"false","message":"pong"}', 'TigerGraph 4.2.5'),{status:'SERVICE_RESPONDING',version:'4.2.5',graphReady:false,reason:'GRAPH_AND_INSTALLED_QUERY_NOT_VERIFIED'});
  for(const body of ['<html>login</html>','{"error":true,"message":"pong"}','{"error":false,"message":"ok"}', 'x'.repeat(4097)]) {
    assert.throws(()=>parseGraphHealth(body,'TigerGraph 4.2.5'));
  }
  assert.throws(()=>parseGraphHealth('{"error":false,"message":"pong"}','unrecognized'));
});
test('isolated deployment template pins the image and publishes no ports or host paths', () => {
  const yaml=readFileSync(new URL('../tigergraph.compose.yaml',import.meta.url),'utf8');
  assert.match(yaml,/tigergraph\/community:4\.2\.5@sha256:[a-f0-9]{64}/);
  assert.doesNotMatch(yaml,/^\s*(ports:|privileged:|network_mode:|environment:)/m);
  assert.match(yaml,/internal: true/);
  assert.match(yaml,/tigergraph-data:\/home\/tigergraph/);
});
