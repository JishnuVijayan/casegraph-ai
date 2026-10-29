import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const caseA='30000000-0000-4000-8000-000000000001';
const caseB='30000000-0000-4000-8000-000000000002';
const live=process.env.E2E_GRAPH_MODE==='live';
const baseURL='http://127.0.0.1:15173';
function response(page:Page,path:string,method='POST'){return page.waitForResponse((r)=>r.url().endsWith('/api/v1'+path)&&r.request().method()===method);}
async function login(page:Page,subject:string){
  await page.goto('/');await page.getByLabel('Fictional identity').selectOption(subject);
  const pending=response(page,'/auth/demo');await page.getByRole('button',{name:'Sign in to local demo'}).click();
  const result=await pending;expect(result.status()).toBe(200);const token=(await result.json()).data.token as string;
  await expect(page.getByText(/Signed in as/)).toBeVisible();await expect(page.getByRole('button',{name:'Sign out'})).toBeEnabled();return token;
}
async function readCase(page:Page,id:string){
  await page.getByLabel('Case ID',{exact:true}).fill(id);await page.getByRole('button',{name:'Read case',exact:true}).click();
  await expect(page.getByRole('article',{name:'Case details'})).toBeVisible();
  await expect(page.getByText('Loading claims and timeline…')).toHaveCount(0);
}
async function grant(page:Page,id:string){
  await page.getByLabel('Permission',{exact:true}).selectOption('INVESTIGATE');
  const pending=response(page,`/cases/${id}/shares`);await page.getByRole('button',{name:'Grant access',exact:true}).click();
  expect((await pending).status()).toBe(201);await expect(page.getByRole('button',{name:'Revoke last grant'})).toBeEnabled();
}
test(`fresh-seed browser workflow with real OCR and ${live?'required live TigerGraph':'truthful graph unavailability'}`,async({page,browser})=>{
  const parent=process.env.E2E_DIRECTORY;if(!parent)throw new Error('Use the isolated root test:e2e wrapper.');
  const contexts:BrowserContext[]=[];
  try{
    await page.goto('/');
    await expect(page.getByRole('link',{name:'1930',exact:true})).toHaveAttribute('href','tel:1930');
    await expect(page.getByRole('link',{name:'cybercrime.gov.in',exact:true})).toHaveAttribute('href','https://cybercrime.gov.in/');
    await expect(page.getByText(/Contact your bank immediately/)).toBeVisible();
    await expect(page.getByLabel('Synthetic PNG/JPEG file')).toHaveCount(0);
    await login(page,'synthetic-victim-a');await readCase(page,caseA);
    const evidence=page.getByRole('region',{name:'Evidence originals'});
    const uploaded:{id:string;sha256:string}[]=[];
    // Later dated receipt first, earlier receipt second, then four fictional notes.
    for(let n=1;n<=6;n++){
      await evidence.getByLabel('Synthetic PNG/JPEG file').setInputFiles(join(parent,'fixtures',`synthetic-${n}.png`));
      await evidence.getByRole('checkbox',{name:'This file is entirely fictional/synthetic.'}).check();
      const pending=response(page,`/cases/${caseA}/evidence`);await evidence.getByRole('button',{name:'Upload immutable original'}).click();
      const result=await pending;expect(result.status()).toBe(201);uploaded.push((await result.json()).data);
      await expect(evidence.getByText(/^Source ID:/)).toHaveCount(n);
    }
    const claims:string[]=[];
    for(const [index,amount] of [[0,'2500'],[1,'800']] as const){
      const row=evidence.getByRole('listitem').filter({hasText:`Source ID: ${uploaded[index].id}`});
      await row.getByRole('button',{name:'Run local OCR',exact:true}).click();
      await expect(row.getByText('OCR status: SUCCEEDED')).toBeVisible();
      const region=row.getByRole('button',{name:new RegExp(`Review source region for INR ${amount} `)});
      await expect(region).toBeVisible();await region.click();
      const image=page.getByRole('img',{name:`Source crop containing INR ${amount}`,exact:true});await expect(image).toBeVisible();
      await expect.poll(()=>image.evaluate((el)=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.getByRole('button',{name:'Close source crop'}).click();
      const pending=response(page,`/cases/${caseA}/claims`);
      await row.getByRole('button',{name:`Save observed amount claim for INR ${amount}`,exact:true}).click();
      claims.push((await (await pending).json()).data.id);
      await expect(page.getByRole('region',{name:'Claims and timeline review'}).locator(`#correct-${claims[index]}`)).toBeVisible();
    }
    const review=page.getByRole('region',{name:'Claims and timeline review'});
    await review.locator(`#correct-${claims[0]}`).fill('INR 2600');await review.locator(`#reason-${claims[0]}`).fill('Synthetic correction; original observation preserved.');
    const correction=review.locator('form').filter({has:page.locator(`#correct-${claims[0]}`)});
    await correction.getByRole('button',{name:'Save correction with history'}).click();
    const claimRow=review.getByRole('listitem').filter({has:page.locator(`#correct-${claims[0]}`)});
    await claimRow.getByText('Revision history (1)',{exact:true}).click();
    await expect(claimRow.getByText('Before: INR 2500',{exact:true})).toBeVisible();
    await expect(claimRow.getByText('After: INR 2600',{exact:true})).toBeVisible();
    await expect(claimRow.getByText(/observed “INR 2500”/)).toBeVisible();
    await review.getByLabel('Claim type',{exact:true}).selectOption('payment_amount');
    await review.getByLabel('What do you recall?').fill('INR 2700');
    await review.getByRole('button',{name:'Save unverified recollection'}).click();
    await expect(review.getByText('INR 2700',{exact:true})).toBeVisible();
    async function event(date:string,amounts:string[]){
      await review.getByLabel('Event type',{exact:true}).selectOption('payment');await review.getByLabel('Time precision').selectOption('DATE_ONLY');
      await review.getByLabel('Date (YYYY-MM-DD)').fill(date);await review.getByLabel('Uncertainty/source note').fill('Synthetic receipt date; precise time unknown and not externally verified.');
      for(const amount of amounts)await review.getByRole('checkbox',{name:new RegExp(`^INR ${amount} ·`)}).check();
      const pending=response(page,`/cases/${caseA}/timeline`);await review.getByRole('button',{name:'Add linked timeline event'}).click();expect((await pending).status()).toBe(201);
      await expect(review.getByText(new RegExp(`payment · ${date} \\(DATE_ONLY\\)`))).toBeVisible();
    }
    await event('2026-10-29',['2600','2700']);await event('2026-10-28',['800']);
    const timeline=page.getByRole('region',{name:'Case timeline'}).locator(':scope > ol > li');
    await expect(timeline).toHaveCount(2);await expect(timeline.nth(0)).toContainText('2026-10-28');await expect(timeline.nth(1)).toContainText('2026-10-29');
    const questions=page.getByRole('region',{name:'Clarification questions'});
    await questions.getByRole('button',{name:'Check payment details for questions'}).click();
    await expect(questions.getByText(/claims linked to this payment show different amounts/)).toBeVisible();
    await questions.getByRole('button',{name:'Unknown / I can’t remember',exact:true}).click();
    await questions.getByText('Previous questions and answers',{exact:true}).click();
    await expect(questions.locator('details')).toContainText('UNKNOWN');
    const exports=page.getByRole('region',{name:'Draft export'});
    await exports.getByRole('checkbox',{name:'I understand this is a synthetic draft for human review.'}).check();
    const created=response(page,`/cases/${caseA}/exports`);await exports.getByRole('button',{name:'Generate draft version'}).click();
    const exported=(await (await created).json()).data as {id:string;sha256:string};
    await exports.getByRole('button',{name:'Review draft v1'}).click();
    const frame=page.frameLocator('iframe[title="Draft preview v1"]');
    await expect(frame.getByRole('heading',{name:'DRAFT — Synthetic incident report'})).toBeVisible();
    for(const text of ['INR 2500','INR 2600','UNKNOWN','Correction history','OBSERVED_IN_UPLOAD','UNVERIFIED',uploaded[0].sha256,uploaded[0].id])await expect(frame.locator('body')).toContainText(text);
    const pendingDownload=page.waitForEvent('download');await exports.getByRole('button',{name:'Download reviewed HTML'}).click();
    const download=await pendingDownload;const html=await readFile((await download.path())!);
    expect(download.suggestedFilename()).toBe('casegraph-draft-v1.html');expect(createHash('sha256').update(html).digest('hex')).toBe(exported.sha256);
    const first=evidence.getByRole('listitem').filter({hasText:`Source ID: ${uploaded[0].id}`});
    const pendingOriginal=page.waitForEvent('download');await first.getByRole('button',{name:'Download original'}).click();
    const original=await pendingOriginal;expect((await readFile((await original.path())!)).equals(await readFile(join(parent,'fixtures','synthetic-1.png')))).toBe(true);
    await grant(page,caseA);
    const bContext=await browser.newContext({baseURL});contexts.push(bContext);const b=await bContext.newPage();const bToken=await login(b,'synthetic-victim-b');
    expect((await b.request.get(`/api/v1/cases/${caseA}/evidence/${uploaded[0].id}/view`,{headers:{Authorization:`Bearer ${bToken}`}})).status()).toBe(403);
    expect((await b.request.get(`/api/v1/cases/${caseA}/exports/${exported.id}/download`,{headers:{Authorization:`Bearer ${bToken}`}})).status()).toBe(403);
    await readCase(b,caseB);await grant(b,caseB);
    const analystContext=await browser.newContext({baseURL});contexts.push(analystContext);const analyst=await analystContext.newPage();await login(analyst,'synthetic-analyst');await readCase(analyst,caseA);
    const panel=analyst.getByRole('region',{name:'Analyst investigation'});
    await panel.getByRole('button',{name:'Run scoped TigerGraph query'}).click();
    if(live){
      // No API interception, mocked provider, route fulfillment or skip in this mode.
      await expect(panel.getByLabel('Four-hop lead path')).toHaveCount(1);
      await expect(panel.getByLabel('Four-hop lead path')).toContainText('fx:account:shared-01');
      await expect(panel.getByText(/SYNTHETIC_INVESTIGATIVE_LEAD · NEEDS_REVIEW/)).toBeVisible();
      await panel.getByRole('button',{name:/Review edge 1 source/}).click();await expect(panel.getByLabel('Graph source details')).toContainText('SYSTEM_INFERENCE');
      await panel.getByRole('button',{name:'Mark reviewed',exact:true}).click();await expect(panel.getByText(/SYNTHETIC_INVESTIGATIVE_LEAD · REVIEWED/)).toBeVisible();
      await b.getByRole('button',{name:'Revoke last grant'}).click();await expect(b.getByText(/Grant revoked\./)).toBeVisible();
      await panel.getByRole('button',{name:/Review edge 1 source/}).click();await expect(panel.getByRole('alert')).toContainText('Access denied');
      await expect(panel.getByLabel('Four-hop lead path')).toHaveCount(0);await expect(panel.getByLabel('Graph source details')).toHaveCount(0);
      await panel.getByRole('button',{name:'Read saved lead snapshots'}).click();await expect(panel.getByText(/Saved query snapshots loaded/)).toBeVisible();await expect(panel.getByLabel('Four-hop lead path')).toHaveCount(0);
    }else{
      await expect(panel.getByRole('alert')).toContainText('Investigation unavailable');await expect(panel.getByLabel('Four-hop lead path')).toHaveCount(0);
      await expect(panel.getByText(/TigerGraph query executed/)).toHaveCount(0);
      await b.getByRole('button',{name:'Revoke last grant'}).click();await expect(b.getByText(/Grant revoked\./)).toBeVisible();
    }
    await analyst.getByLabel('Case ID',{exact:true}).fill(caseB);await analyst.getByRole('button',{name:'Read case',exact:true}).click();
    await expect(analyst.getByRole('alert')).toContainText('Access denied');await expect(analyst.getByRole('article',{name:'Case details'})).toHaveCount(0);
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByLabel('Synthetic PNG/JPEG file')).toHaveCount(0);
  }finally{for(const context of contexts)await context.close();}
});
