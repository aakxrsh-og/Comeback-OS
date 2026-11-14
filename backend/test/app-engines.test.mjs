import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

class Element {
  constructor(id='') { this.id=id;this.value=id==='subject'||id==='exam-filter'?'All':id==='topic-status-filter'?'all':'';this.innerHTML='';this.textContent='';this.style={};this.dataset={};this.hidden=false;this.classList={add(){},remove(){},toggle(){}}; }
  addEventListener(){} reset(){} replaceChildren(){} append(){} scrollIntoView(){}
}
async function loadApp(serializedData=null) {
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},data=new Map(serializedData==null?[]:[['comeback-os',serializedData]]);
  const document={getElementById:get,addEventListener(){},querySelectorAll(){return[]},querySelector(){return new Element()},createElement(){return new Element()}};
  const context={document,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},crypto:webcrypto,console,navigator:{},URL,Blob,confirm:()=>true,setTimeout:()=>0,addEventListener(){},window:{}};
  vm.createContext(context);
  const [catalog,app]=await Promise.all([readFile(new URL('../../syllabus.js',import.meta.url),'utf8'),readFile(new URL('../../app.js',import.meta.url),'utf8')]);
  vm.runInContext(catalog+'\n'+app+'\nglobalThis.__engines={get state(){return state},mastery,topicMastery,topicKeys,recordEngine,refresh,generate,eval21,revisionCandidates,recommendNext,focus,active,overlaps,recoverQuest,award};',context);
  context.__engines.storage=data;return context.__engines;
}

test('schema v8 migration preserves the exact backup and user records while upgrading to v9',async()=>{
  const original={version:8,profile:{xp:210,level:3},chapters:[{id:'old-kinematics',subject:'Physics',name:'Kinematics',topics:['Legacy custom topic'],status:'In progress',topicStatus:{'main:custom':'completed'}},{id:'custom-chapter',subject:'Physics',name:'User-created chapter',topics:['Custom topic']}],sessions:[{chapterId:'old-kinematics',minutes:35,at:'2026-11-13T10:00:00Z'}],attempts:[{chapterId:'old-kinematics',exam:'JEE Main',total:5,correct:4}],settings:{availableMinutes:75,engineRuns:{planner:{status:'ok',at:'2026-11-13T10:00:00Z'}}}};
  const raw=JSON.stringify(original),app=await loadApp(raw),s=app.state,chapter=s.chapters.find(x=>x.name==='Kinematics');
  assert.equal(app.storage.get('comeback-os.backup.pre-v9'),raw);assert.equal(s.version,9);assert.equal(s.profile.xp,210);assert.equal(s.profile.level,3);assert.equal(chapter.status,'In progress');assert.ok(chapter.topics.includes('Legacy custom topic'));assert.equal(s.sessions[0].chapterId,chapter.id);assert.equal(s.attempts[0].chapterId,chapter.id);assert.ok(s.chapters.some(x=>x.id==='custom-chapter'&&x.legacy));assert.equal(s.settings.availableMinutes,75);assert.equal(s.settings.engineRuns.planner.status,'ok');assert.equal(JSON.parse(app.storage.get('comeback-os')).version,9);
});

test('pre-v6 migration keeps its original pre-2.5 backup',async()=>{
  const raw=JSON.stringify({version:5,chapters:[],sessions:[{minutes:12}]});const app=await loadApp(raw);
  assert.equal(app.storage.get('comeback-os.backup.pre-2.5'),raw);assert.equal(app.state.version,9);assert.equal(app.state.sessions[0].minutes,12);
});
test('fresh install seeds the syllabus catalogue and daily quests are bounded and duplicate-safe',async()=>{
  const app=await loadApp(),s=app.state;assert.ok(s.chapters.length>=45);s.settings.availableMinutes=90;s.settings.lastQuestDate='';
  assert.equal(app.generate(),true);const count=s.quests.length;assert.ok(count>0);assert.ok(s.quests.reduce((n,q)=>n+q.minutes,0)<=90);assert.equal(app.generate(),false);assert.equal(s.quests.length,count);
});

test('topic completion alone does not award mastery; repeated sessions and exam-specific PYQ evidence do',async()=>{
  const app=await loadApp(),s=app.state,c=s.chapters.find(x=>x.mainCoverage==='included');assert.ok(c);c.topicStatus={'topic-a':'completed','topic-b':'completed'};app.refresh();assert.equal(c.mastered,false);
  s.sessions.push({chapterId:c.id,minutes:30,at:new Date().toISOString()},{chapterId:c.id,minutes:25,at:new Date().toISOString()});
  if(c.mainCoverage!=='not-listed')s.attempts.push({chapterId:c.id,exam:'JEE Main',independent:true,total:10,correct:9},{chapterId:c.id,exam:'JEE Main',independent:true,total:10,correct:9});
  if(c.advancedCoverage!=='not-listed')s.attempts.push({chapterId:c.id,exam:'JEE Advanced',difficulty:'Advanced',independent:true,total:10,correct:8},{chapterId:c.id,exam:'JEE Advanced',difficulty:'Advanced',independent:true,total:10,correct:8});
  app.refresh();assert.equal(c.mastered,true);assert.equal(c.status,'Mastered');
});

test('academic rank is evidence-gated and does not rise with XP level',async()=>{const app=await loadApp(),s=app.state;app.award(1000,'test XP');assert.ok(s.profile.level>1);assert.equal(s.profile.academicRank,'Unranked');assert.equal(s.profile.rankHistory.length,0);});

test('21-day evaluation defers with thin evidence and uses logged evidence when sufficient',async()=>{
  const app=await loadApp(),s=app.state;let result=app.eval21();assert.equal(result.enough,false);assert.equal(result.score,null);
  const now=Date.now();for(let i=0;i<5;i++)s.sessions.push({at:new Date(now-i*86400000).toISOString(),minutes:30});
  s.attempts.push({at:new Date(now).toISOString(),total:10,correct:7},{at:new Date(now-86400000).toISOString(),total:10,correct:8});
  result=app.eval21();assert.equal(result.enough,false);assert.ok(result.missingEvidence.includes('1 assessment'));s.assessments.push({at:new Date().toISOString(),score:80,total:100});result=app.eval21();assert.equal(result.enough,true);assert.equal(result.accuracy,75);assert.ok(Number.isFinite(result.score));assert.ok(result.rank);assert.equal(s.profile.academicRank,result.rank);assert.equal(s.profile.rankHistory.length,1);const academicRank=s.profile.academicRank;app.award(2000,'additional XP');assert.equal(s.profile.academicRank,academicRank);
});

test('revision queue explains real overdue, weak-PYQ, backlog and mistake signals',async()=>{
  const app=await loadApp(),s=app.state,c=s.chapters[0];c.lastRevision=new Date(Date.now()-9*86400000).toISOString();c.topicStatus={'topic':'backlog'};
  s.attempts.push({chapterId:c.id,total:10,correct:4},{chapterId:c.id,total:10,correct:5});s.mistakes.push({chapterId:c.id,corrected:false});
  const row=app.revisionCandidates().find(x=>x.chapter.id===c.id);assert.ok(row);assert.ok(row.reasons.some(x=>x.includes('overdue')));assert.ok(row.reasons.some(x=>x.includes('below 70%')));assert.ok(row.reasons.some(x=>x.includes('mistake')));assert.ok(row.reasons.includes('Backlog topics'));
});

test('recommendation engine explains an evidence-based next action and uncertainty',async()=>{
  const app=await loadApp(),s=app.state,c=s.chapters[0];s.settings.availableMinutes=45;c.status='Backlog';c.topicStatus={'topic':'backlog'};
  const r=app.recommendNext();assert.equal(r.engine,'recommendation');assert.match(r.action,/revision/i);assert.equal(r.priority,'High');assert.ok(r.evidence.includes('Backlog topics'));assert.ok(r.benefit);assert.ok(r.uncertainty);
});

test('overdue quests recover in place and timed overlaps are rejected',async()=>{
  const app=await loadApp(),s=app.state,today=new Date().toISOString().slice(0,10);const q={id:'q1',title:'Existing task',minutes:30,remainingMinutes:30,date:'2000-01-01',time:'09:00',done:false};s.quests.push(q);assert.equal(app.overlaps({date:today,time:'09:15',minutes:30},'q2'),false);assert.equal(app.overlaps({date:today,time:'09:15',minutes:30},'q1'),false);q.date=today;assert.equal(app.overlaps({date:today,time:'09:15',minutes:30},'q2'),true);app.recoverQuest('q1');assert.equal(q.date,today);assert.equal(q.time,'');assert.equal(s.quests.length,1);
});

test('topic mastery is evidence-derived, separate from completion, and engine runs persist explainable summaries',async()=>{
  const app=await loadApp(),s=app.state,c=s.chapters.find(x=>x.mainTopics?.length);assert.ok(c);const key='main:'+c.mainTopics[0];c.topicStatus[key]='completed';
  const evidence={chapterId:c.id,topicKey:key};s.sessions.push({...evidence,type:'Concept study',minutes:30},{...evidence,type:'Revision',minutes:20});
  s.attempts.push({...evidence,exam:'JEE Main',independent:true,total:10,correct:9},{...evidence,exam:'JEE Main',independent:true,total:10,correct:8});
  s.assessments.push({...evidence,total:100,score:80});app.refresh();assert.equal(app.topicMastery(c,key).mastered,true);assert.equal(c.topicStatus[key],'completed');
  assert.equal(s.settings.engineRuns.mastery.status,'ok');assert.ok(s.settings.engineRuns.mastery.lastRunAt);assert.ok(s.settings.engineRuns.mastery.inputSummary.taggedSessions>=2);assert.ok(s.settings.engineRuns.mastery.outputSummary.explainability);
  const sparse=await loadApp(),c2=sparse.state.chapters.find(x=>x.mainTopics?.length);assert.equal(sparse.topicMastery(c2,'main:'+c2.mainTopics[0]).mastered,false);
});

test('five engines exchange study and quest evidence through a full local workflow',async()=>{
  const app=await loadApp(),s=app.state,c=s.chapters[0];s.settings.availableMinutes=90;assert.equal(app.generate(),true);const generated=s.quests.filter(q=>q.generated);assert.ok(generated.length);assert.ok(generated.some(q=>q.chapterId===c.id));
  const today=new Date().toISOString();for(let i=0;i<5;i++)s.sessions.push({chapterId:c.id,minutes:25,type:i===4?'Revision':'Concept study',at:new Date(Date.now()-i*86400000).toISOString()});s.attempts.push({chapterId:c.id,exam:'JEE Main',independent:true,total:10,correct:4,at:today},{chapterId:c.id,exam:'JEE Main',independent:true,total:10,correct:5,at:today});
  s.assessments.push({at:today,score:75,total:100});generated[0].done=true;generated[0].completedAt=today;const evaluation=app.eval21(),revision=app.revisionCandidates().find(x=>x.chapter.id===c.id),recommendation=app.recommendNext();
  assert.equal(evaluation.enough,true);assert.ok(revision?.reasons.some(x=>x.includes('below 70%')));assert.match(recommendation.action,/revision/i);
  for(const name of ['planner','mastery','evaluation','revision','recommendation']){assert.ok(s.settings.engineRuns[name],name+' run missing');assert.ok(Date.parse(s.settings.engineRuns[name].lastRunAt),name+' timestamp missing')}
});
