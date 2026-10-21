import Database from 'better-sqlite3';
import {closeSync,existsSync,lstatSync,openSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
// USD nanodollars: integer arithmetic, full-price cached input, 2x margin.
// Official sources reviewed 2026-10-19; fail closed after 2026-11-02.
export const AI_POLICY={version:1,model:'gpt-5-mini',snapshot:'gpt-5-mini-2025-08-07',endpoint:'https://api.openai.com/v1/responses',inputWindow:400000,outputLimit:1800,inputNano:250,outputNano:2000,margin:2,ceilingNano:4000000000,approvedNano:5000000000,reviewed:'2026-10-19',expires:'2026-11-02T00:00:00Z'} as const;
const policyJSON=JSON.stringify(AI_POLICY);
export const MAX_RESERVATION=(AI_POLICY.inputWindow*AI_POLICY.inputNano+AI_POLICY.outputLimit*AI_POLICY.outputNano)*AI_POLICY.margin;
type Row={id:string;state:'pending'|'settled'|'uncertain';reserved:number;charged:number;input_tokens:number|null;output_tokens:number|null};
export interface BudgetReservation {id:string;reserved:number}
export interface AIBudget {reserve:(model:string,endpoint:string,outputLimit:number)=>BudgetReservation;settle:(reservation:BudgetReservation,response:unknown)=>void;uncertain:(reservation:BudgetReservation)=>void}
export function initializeAIBudget(file:string){
 // Explicit one-time initialization only. Never replace or reset an existing file.
 closeSync(openSync(file,'wx',0o600));const db=new Database(file);
 try{db.pragma('journal_mode = DELETE');db.pragma('synchronous = FULL');db.transaction(()=>{db.exec(`CREATE TABLE policy(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,blocked INTEGER NOT NULL CHECK(blocked IN(0,1)));CREATE TABLE requests(id TEXT PRIMARY KEY,state TEXT NOT NULL CHECK(state IN('pending','settled','uncertain')),reserved INTEGER NOT NULL,charged INTEGER NOT NULL,input_tokens INTEGER,output_tokens INTEGER);`);db.prepare('INSERT INTO policy VALUES(1,?,0)').run(policyJSON);}) .immediate();}finally{db.close();}
}
export class InitialTestBudget implements AIBudget {
 readonly file:string;readonly now:()=>number;
 constructor(file:string,now=Date.now){this.file=file;this.now=now;}
 private access<T>(fn:(db:Database.Database,rows:Row[],blocked:boolean)=>T):T{
  if(!existsSync(this.file)||!lstatSync(this.file).isFile()||lstatSync(this.file).isSymbolicLink())throw Error('AI test-budget ledger is missing or invalid. Live requests are blocked; do not reset it.');
  let db:Database.Database|undefined;
  try{db=new Database(this.file,{fileMustExist:true,timeout:1000});db.pragma('synchronous = FULL');const connection=db;return connection.transaction(()=>{
   const check=connection.pragma('quick_check',{simple:true});if(check!=='ok')throw Error('integrity');
   const policy=connection.prepare('SELECT * FROM policy').all() as {id:number;data:string;blocked:number}[];
   if(policy.length!==1||policy[0].id!==1||policy[0].data!==policyJSON||![0,1].includes(policy[0].blocked))throw Error('policy');
   const rows=connection.prepare('SELECT * FROM requests').all() as Row[];let total=0;
   for(const r of rows){if(!r.id||!['pending','settled','uncertain'].includes(r.state)||r.reserved!==MAX_RESERVATION||!Number.isSafeInteger(r.charged)||r.charged<0||r.charged>r.reserved)throw Error('record');if(r.state!=='settled'&&(r.charged!==r.reserved||r.input_tokens!==null||r.output_tokens!==null))throw Error('reservation');if(r.state==='settled'&&(!Number.isSafeInteger(r.input_tokens)||!Number.isSafeInteger(r.output_tokens)||r.input_tokens!<0||r.input_tokens!>AI_POLICY.inputWindow||r.output_tokens!<0||r.output_tokens!>AI_POLICY.outputLimit||r.charged!==this.cost(r.input_tokens!,r.output_tokens!)))throw Error('usage');total+=r.charged;}
   if(!Number.isSafeInteger(total)||total>AI_POLICY.ceilingNano)throw Error('total');return fn(connection,rows,!!policy[0].blocked);
  }).immediate();}catch(e){const message=(e as Error).message;if(message.startsWith('AI '))throw e;throw Error('AI test-budget ledger could not be verified. Live requests are blocked.');}finally{db?.close();}
 }
 private cost(input:number,output:number){return(input*AI_POLICY.inputNano+output*AI_POLICY.outputNano)*AI_POLICY.margin;}
 status(){return this.access((_db,rows,blocked)=>({ceilingUSD:4,approvedUSD:5,conservativeUsedUSD:rows.reduce((n,r)=>n+r.charged,0)/1e9,pending:rows.filter(r=>r.state==='pending').length,blocked:blocked||rows.some(r=>r.state!=='settled')||this.now()<Date.parse(AI_POLICY.reviewed+'T00:00:00Z')||this.now()>=Date.parse(AI_POLICY.expires),pricingExpires:AI_POLICY.expires}));}
 reserve(model:string,endpoint:string,outputLimit:number){
  if(model!==AI_POLICY.model&&model!==AI_POLICY.snapshot||endpoint!==AI_POLICY.endpoint||outputLimit!==AI_POLICY.outputLimit)throw Error('AI model, endpoint or output bound has no approved test-budget pricing.');
  if(this.now()<Date.parse(AI_POLICY.reviewed+'T00:00:00Z')||this.now()>=Date.parse(AI_POLICY.expires))throw Error('AI pricing review is expired or the clock is invalid. Live requests are blocked.');
  return this.access((db,rows,blocked)=>{if(blocked||rows.some(r=>r.state!=='settled'))throw Error('AI ledger has an outstanding or uncertain request. No retry is allowed until owner reconciliation.');const used=rows.reduce((n,r)=>n+r.charged,0);if(used+MAX_RESERVATION>AI_POLICY.ceilingNano)throw Error('AI initial-test budget exhausted. No automatic reset or top-up.');const id=randomUUID();db.prepare("INSERT INTO requests VALUES(?,'pending',?,?,NULL,NULL)").run(id,MAX_RESERVATION,MAX_RESERVATION);return{id,reserved:MAX_RESERVATION};});
 }
 settle(reservation:BudgetReservation,response:unknown){
  const r=response as {id?:unknown;model?:unknown;service_tier?:unknown;status?:unknown;usage?:{input_tokens?:unknown;output_tokens?:unknown;total_tokens?:unknown;input_tokens_details?:{cached_tokens?:unknown};output_tokens_details?:{reasoning_tokens?:unknown}}};
  const u=r?.usage,i=u?.input_tokens,o=u?.output_tokens,c=u?.input_tokens_details?.cached_tokens,reason=u?.output_tokens_details?.reasoning_tokens;
  if(!r||typeof r.id!=='string'||!r.id.startsWith('resp_')||![AI_POLICY.model,AI_POLICY.snapshot].includes(r.model as typeof AI_POLICY.model)||r.service_tier!=='default'||!['completed','incomplete'].includes(r.status as string)||!Number.isSafeInteger(i)||!Number.isSafeInteger(o)||!Number.isSafeInteger(c)||!Number.isSafeInteger(reason)||(i as number)<0||(i as number)>AI_POLICY.inputWindow||(o as number)<0||(o as number)>AI_POLICY.outputLimit||(c as number)<0||(c as number)>(i as number)||(reason as number)<0||(reason as number)>(o as number)||u?.total_tokens!==(i as number)+(o as number))throw Error('AI usage is missing, inconsistent or outside the approved price policy. Ledger remains reserved and blocked.');
  this.access((db,rows,blocked)=>{const row=rows.find(r=>r.id===reservation.id);if(blocked||!row||row.state!=='pending'||reservation.reserved!==row.reserved)throw Error('AI reservation cannot be reconciled. Live requests are blocked.');const charged=this.cost(i as number,o as number);if(charged>row.reserved)throw Error('AI usage exceeds the reserved budget.');db.prepare("UPDATE requests SET state='settled',charged=?,input_tokens=?,output_tokens=? WHERE id=? AND state='pending'").run(charged,i,o,row.id);});
 }
 uncertain(reservation:BudgetReservation){this.access((db,rows)=>{const row=rows.find(r=>r.id===reservation.id);if(!row||row.state!=='pending')throw Error('AI reservation cannot be marked uncertain. Live requests are blocked.');db.prepare("UPDATE requests SET state='uncertain' WHERE id=?").run(row.id);db.prepare('UPDATE policy SET blocked=1 WHERE id=1').run();});}
}
