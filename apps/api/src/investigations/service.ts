import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { auditEvents, cases, graphLeads } from '../db/schema';
import { TigerGraphClient } from './client';
import { GraphPath, LeadSnapshot, parsePath, parseSnapshot, parseSources, pathRefs, validateSources } from './model';
type Lead=typeof graphLeads.$inferSelect;
@Injectable()
export class InvestigationsService {
  constructor(private readonly access:AccessStore,private readonly graph:TigerGraphClient){}
  private async scope(req:ApiRequest){
    if(req.actor?.role!=='analyst'||!req.actor.organizationId)throw new ForbiddenException();
    const ids=await this.access.investigationCaseIds(req.actor);
    if(ids.length>250)throw new ServiceUnavailableException();
    const root=req.caseRecord?.id;
    // CaseScopeGuard already proved INVESTIGATE on the open case. Always keep it in the
    // bounded graph window so newly submitted complaints are not Access-denied just because
    // older seeded grants fill the first N ids.
    if(root&&!ids.includes(root))return [root,...ids].slice(0,21);
    return ids;
  }
  private view(row:Lead,snapshot:LeadSnapshot){return {id:row.id,caseId:row.caseId,createdAt:row.createdAt,reviewStatus:row.reviewStatus,origin:'TIGERGRAPH_QUERY_SNAPSHOT',classification:'SYNTHETIC_INVESTIGATIVE_LEAD',path:snapshot.path,sourceRefs:pathRefs(snapshot.path)};}
  private async lookup(req:ApiRequest,id:string){
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new ForbiddenException();
    const [row]=await this.access.available((db)=>db.select().from(graphLeads).where(and(eq(graphLeads.id,id),eq(graphLeads.organizationId,req.actor!.organizationId!))));
    if(!row)throw new ForbiddenException();
    const snapshot=parseSnapshot(row.path,row.caseId,await this.scope(req));return {row,snapshot};
  }
  /**
   * Victim submit helper: capture similar-case leads for the demo consortium when TigerGraph is up.
   * Never invents paths; returns UNAVAILABLE when the graph client/runtime is down.
   */
  async captureForSubmit(req:ApiRequest):Promise<{leadsStatus:'CAPTURED'|'UNAVAILABLE'|'NONE';similarCaseCount:number}> {
    const root=req.caseRecord!.id;
    const organizationId=this.access.fixtures.organization.id;
    if(!organizationId)return {leadsStatus:'UNAVAILABLE',similarCaseCount:0};
    try{
      const scoped=[...new Set([root,...await this.access.orgInvestigateCaseIds(20)])].slice(0,20);
      const signal=AbortSignal.timeout(12000);
      const result=await this.graph.execute('find_case_links',{case_id:root,max_hops:4,allowed_case_ids:scoped},signal);
      if(result.classification!=='SYNTHETIC_INVESTIGATIVE_LEAD'||!Array.isArray(result.paths)||result.paths.length>20){
        return {leadsStatus:'UNAVAILABLE',similarCaseCount:0};
      }
      const paths:GraphPath[]=result.paths.map((p)=>parsePath(p,root,scoped));
      if(!paths.length)return {leadsStatus:'NONE',similarCaseCount:0};
      if(new Set(paths.map((p)=>JSON.stringify(p))).size!==paths.length)return {leadsStatus:'UNAVAILABLE',similarCaseCount:0};
      const evidence_ids=[...new Set(paths.flatMap(pathRefs).map((r)=>r.id))];
      let sources=parseSources([]);
      if(evidence_ids.length){
        const response=await this.graph.execute('get_lead_sources',{evidence_ids,allowed_case_ids:scoped},signal);
        if(response.classification!=='SYNTHETIC_FIXTURE_SOURCES')return {leadsStatus:'UNAVAILABLE',similarCaseCount:0};
        sources=parseSources(response.sources);
      }
      validateSources(paths,sources);
      await this.access.available((db)=>db.transaction(async(tx)=>{
        for(const path of paths){
          const ids=new Set(pathRefs(path).map((r)=>r.id));
          const snapshot:LeadSnapshot={version:1,path,sources:sources.filter((s)=>ids.has(s.id))};
          await tx.insert(graphLeads).values({caseId:root,organizationId,path:snapshot,reviewStatus:'NEEDS_REVIEW'});
        }
        await tx.insert(auditEvents).values({actorId:req.actor!.id,action:'GRAPH_QUERY_ON_SUBMIT',resourceType:'case',resourceId:root,requestId:req.requestId});
      }));
      return {leadsStatus:'CAPTURED',similarCaseCount:paths.length};
    }catch{
      return {leadsStatus:'UNAVAILABLE',similarCaseCount:0};
    }
  }
  async query(req:ApiRequest){
    const root=req.caseRecord!.id,allowed=await this.scope(req),signal=AbortSignal.timeout(12000);
    if(!allowed.includes(root))throw new ForbiddenException();
    const result=await this.graph.execute('find_case_links',{case_id:root,max_hops:4,allowed_case_ids:allowed},signal);
    if(result.classification!=='SYNTHETIC_INVESTIGATIVE_LEAD'||!Array.isArray(result.paths)||result.paths.length>20)throw new ServiceUnavailableException();
    const paths:GraphPath[]=result.paths.map((p)=>parsePath(p,root,allowed));
    if(new Set(paths.map((p)=>JSON.stringify(p))).size!==paths.length)throw new ServiceUnavailableException();
    const evidence_ids=[...new Set(paths.flatMap(pathRefs).map((r)=>r.id))];
    let sources= parseSources([]);
    if(evidence_ids.length){
      const response=await this.graph.execute('get_lead_sources',{evidence_ids,allowed_case_ids:allowed},signal);
      if(response.classification!=='SYNTHETIC_FIXTURE_SOURCES')throw new ServiceUnavailableException();sources=parseSources(response.sources);
    }
    validateSources(paths,sources);
    const caseIds=[...new Set([root,...paths.map((p)=>p.target_case_id)])].sort();
    const created=await this.access.available((db)=>db.transaction(async(tx)=>{
      await tx.select({id:cases.id}).from(cases).where(inArray(cases.id,caseIds)).orderBy(cases.id).for('update');
      for(const id of caseIds)await this.access.findCaseIn(tx,req.actor!,id,'INVESTIGATE');
      const rows:Lead[]=[];
      for(const path of paths){
        const ids=new Set(pathRefs(path).map((r)=>r.id));const snapshot:LeadSnapshot={version:1,path,sources:sources.filter((s)=>ids.has(s.id))};
        const [row]=await tx.insert(graphLeads).values({caseId:root,organizationId:req.actor!.organizationId!,path:snapshot,reviewStatus:'NEEDS_REVIEW'}).returning();rows.push(row);
      }
      await tx.insert(auditEvents).values({actorId:req.actor!.id,action:'GRAPH_QUERY_EXECUTED',resourceType:'case',resourceId:root,requestId:req.requestId});return rows;
    }));
    const current=await this.scope(req);if(!current.includes(root))throw new ForbiddenException();
    return {status:'QUERY_EXECUTED',leads:created.map((row)=>this.view(row,parseSnapshot(row.path,root,current)))};
  }
  async list(req:ApiRequest){
    const root=req.caseRecord!.id,allowed=await this.scope(req);if(!allowed.includes(root))throw new ForbiddenException();
    const rows=await this.access.available((db)=>db.select().from(graphLeads).where(and(eq(graphLeads.caseId,root),eq(graphLeads.organizationId,req.actor!.organizationId!),sql`${graphLeads.path}->>'kind' is null`)).orderBy(desc(graphLeads.createdAt),desc(graphLeads.id)).limit(100));
    const permitted=rows.filter((row)=>{try{parseSnapshot(row.path,root,allowed);return true;}catch(error){if(error instanceof ForbiddenException)return false;throw error;}});
    await this.access.audit(req.actor!,'GRAPH_LEADS_LISTED','case',root,req.requestId);
    const current=await this.scope(req);if(!current.includes(root))throw new ForbiddenException();
    return permitted.flatMap((row)=>{try{return [this.view(row,parseSnapshot(row.path,root,current))];}catch(error){if(error instanceof ForbiddenException)return [];throw error;}});
  }
  async source(req:ApiRequest,id:string,sourceId:string){
    const {row,snapshot}=await this.lookup(req,id);const source=snapshot.sources.find((s)=>s.id===sourceId);if(!source)throw new ForbiddenException();
    await this.access.audit(req.actor!,'GRAPH_SOURCE_READ','graph_lead',row.id,req.requestId);
    parseSnapshot(row.path,row.caseId,await this.scope(req));
    return {origin:'TIGERGRAPH_QUERY_SNAPSHOT',capturedAt:row.createdAt,source};
  }
  async review(req:ApiRequest,id:string,status:'REVIEWED'|'NOT_RELEVANT'){
    const {row,snapshot}=await this.lookup(req,id);const ids=[snapshot.path.source_case_id,snapshot.path.target_case_id].sort();
    await this.access.available((db)=>db.transaction(async(tx)=>{
      await tx.select({id:cases.id}).from(cases).where(inArray(cases.id,ids)).orderBy(cases.id).for('update');
      for(const caseId of ids)await this.access.findCaseIn(tx,req.actor!,caseId,'INVESTIGATE');
      await tx.update(graphLeads).set({reviewStatus:status}).where(and(eq(graphLeads.id,id),eq(graphLeads.organizationId,req.actor!.organizationId!)));
      await tx.insert(auditEvents).values({actorId:req.actor!.id,action:`GRAPH_LEAD_${status}`,resourceType:'graph_lead',resourceId:id,requestId:req.requestId});
    }));
    parseSnapshot(row.path,row.caseId,await this.scope(req));return {id,reviewStatus:status};
  }
}
