// End-to-end check of the whole product against the RUNNING stack (npm run dev:demo):
// story + document -> AI timeline/facts/entities -> questions -> submit -> report -> officer case file -> similar cases.
// Needs Postgres, Textract, Bedrock and the TigerGraph tunnel up. Creates a clearly named test complaint.
import assert from 'node:assert/strict';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000/api/v1';
const call = async (path, token, body, method) => {
  const response = await fetch(API + path, { method: method ?? (body ? 'POST' : 'GET'),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, data: json?.data ?? json, text, headers: response.headers };
};
const story = 'On 21 October around 7pm I got a WhatsApp message from +91 90000 11111 offering a part-time job rating hotels, Rs 800 per task. They added me to a Telegram group. After 3 tasks they asked me to pay Rs 5000 as a deposit to taskhr.desk@okfictbank to unlock withdrawal. I paid. Then they asked for Rs 20000 more. I lost Rs 25000 in total.';
const login = await call('/auth/intake', null, { displayName: 'E2E Test Person', mobile: '9000000099' });
assert.equal(login.status, 200); const token = login.data.token;
const created = await call('/cases', token, {}); assert.equal(created.status, 201); const id = created.data.id;
assert.match(created.data.reference, /^CG-\d{4}-\d{6}$/);
assert.equal((await call(`/cases/${id}/narrative`, token, { text: story, channel: 'typed' })).status, 201);
const form = new FormData();
form.append('file', new Blob(['Chat export:\n21/10 19:04 Task manager: Pay 5000 to taskhr.desk@okfictbank\n21/10 20:15 Task manager: Pay 20000 to same account'], { type: 'text/plain' }), 'chat.txt');
assert.equal((await call(`/cases/${id}/evidence`, token, form)).status, 201);
const analysed = await call(`/cases/${id}/analyze`, token, {}); assert.equal(analysed.status, 200);
const brief = analysed.data;
assert.equal(brief.category, 'job_or_task_scam'); assert.equal(brief.totalLoss?.amount, 25000);
assert.ok(brief.timeline.length >= 3, 'timeline built from the story and file');
assert.ok(brief.entities.some((e) => e.kind === 'phone') && brief.entities.some((e) => e.kind === 'upi'), 'phone and UPI ID captured');
assert.ok(brief.questions.length <= 5);
for (const question of brief.questions.filter((q) => q.status === 'OPEN')) assert.equal((await call(`/cases/${id}/questions/${question.id}/answer`, token, { answer: 'UNKNOWN' })).status, 200);
const submitted = await call(`/cases/${id}/submit`, token, {});
assert.equal(submitted.status, 200); assert.equal(submitted.data.status, 'SUBMITTED');
assert.equal(submitted.data.similarCases.status, 'READY'); assert.ok(submitted.data.similarCases.count >= 1, 'similar cases from the case network');
const report = await fetch(`${API}/cases/${id}/report.html`, { headers: { Authorization: `Bearer ${token}` } });
const html = await report.text();
assert.equal(report.status, 200); assert.match(report.headers.get('content-disposition') ?? '', /attachment/);
assert.ok(html.includes('1930') && html.includes(created.data.reference) && !/similar case/i.test(html), 'own report: helpline, reference, no network data');
const other = await call('/auth/intake', null, { displayName: 'Other Person', mobile: '9000000098' });
assert.equal((await fetch(`${API}/cases/${id}/report.html`, { headers: { Authorization: `Bearer ${other.data.token}` } })).status, 403, 'another person cannot download it');
const officer = await call('/auth/demo', null, { demoSubject: 'synthetic-analyst' }); const officerToken = officer.data.token;
assert.equal((await call(`/officer/cases/${id}`, token)).status, 403, 'complainant cannot use officer routes');
const file = await call(`/officer/cases/${id}`, officerToken);
assert.equal(file.status, 200); assert.equal(file.data.similar.status, 'READY');
assert.ok(file.data.similar.cases.some((c) => c.shared.some((s) => s.strength === 'STRONG')), 'strong shared detail shown');
const dossier = await fetch(`${API}/officer/cases/${id}/dossier.html`, { headers: { Authorization: `Bearer ${officerToken}` } });
assert.equal(dossier.status, 200); assert.ok((await dossier.text()).length > 3000);
console.log(`PASS: ${created.data.reference} filed, analysed, submitted; ${file.data.similar.cases.length} similar cases; reports and access checks held.`);
