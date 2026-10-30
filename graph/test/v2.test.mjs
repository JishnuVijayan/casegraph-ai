import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (name) => readFileSync(join(import.meta.dirname, '../gsql', name), 'utf8');
// OFFLINE: checks the reviewed text of the v2 case-network GSQL. The compiler has not run here.
test('v2 schema is a separate graph with Complaint, Entity and MENTIONS and no destructive command', () => {
  const s = read('schema_v2.gsql');
  assert.match(s, /CREATE VERTEX Complaint \(PRIMARY_ID case_id STRING, category STRING, reference STRING, submitted_at STRING, loss_amount DOUBLE\)/);
  assert.match(s, /CREATE VERTEX Entity \(PRIMARY_ID id STRING, entity_kind STRING, entity_value STRING\)/);
  assert.match(s, /CREATE UNDIRECTED EDGE MENTIONS \(FROM Complaint, TO Entity/);
  assert.match(s, /CREATE GRAPH CaseGraphV2 /);
  assert.doesNotMatch(s, /\bDROP\b/i);
  assert.doesNotMatch(read('schema.gsql'), /CaseGraphV2/); // v1 fixture graph untouched
});
test('similar_cases ranks by shared entities, treats app/person names as weak and excludes the case itself', () => {
  const q = read('similar_cases.gsql');
  assert.match(q, /CREATE OR REPLACE QUERY similar_cases\(STRING case_id, INT max_results = 10\)/);
  assert.match(q, /entity_kind == "app_name" OR e\.entity_kind == "person_name"/);
  assert.match(q, /t\.case_id != case_id/);
  assert.match(q, /ORDER BY t\.@strong DESC, t\.@weak DESC/);
  assert.match(q, /INSTALL QUERY similar_cases/);
  assert.doesNotMatch(q, /\bDROP\b/i);
});
