(() => {
  const API = 'https://comeback-os-ai1.aakxrshs.workers.dev/api/mentor';
  const KEY = 'comeback-os';
  const MAX_CONTEXT = 5600;
  const ACTION_TTL_MS = 10 * 60 * 1000;
  const $ = id => document.getElementById(id);
  const log = $('chat-log'), form = $('chat-form'), input = $('chat-input');
  const status = $('chat-status'), actions = $('action-proposals');
  const cancelButton = $('cancel-chat'), retryButton = $('retry-chat');
  let busy = false, controller = null, retryMessage = '', timedOut = false;
  const clip = (v, max = 180) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const markdown = t => esc(t).replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\$([^$\n]+)\$/g,'<span class="math">$1</span>').replace(/\n/g,'<br>');

  function readDb() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {ok:false, raw:null, data:null, reason:'No application database is available.'};
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid database shape');
      return {ok:true, raw, data};
    } catch {
      return {ok:false, raw, data:null, reason:'The saved application data is malformed; it was left unchanged.'};
    }
  }
  function store(d) {
    d.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(d));
    try { window.ComebackOS?.refresh?.(); } catch { /* Persisted state remains authoritative if a view cannot refresh. */ }
  }
  function add(text, who) {
    const el = document.createElement('article');
    el.className = 'card message ' + who;
    el.innerHTML = markdown(text);
    log.append(el);
    log.scrollTop = log.scrollHeight;
  }
  const validDate = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === s;
  };
  const validTime = s => !s || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const validMinutes = n => Number.isInteger(n) && n >= 5 && n <= 360;
  const chapterById = (d,id) => (Array.isArray(d.chapters) ? d.chapters : []).find(c => c.id === id);
  const questById = (d,id) => (Array.isArray(d.quests) ? d.quests : []).find(q => q.id === id);
  const topicKeys = c => [...(c.topics||[]),...(c.mainTopics||[]).map(t=>'main:'+t),...(c.advancedTopics||[]).map(t=>'advanced:'+t)];

  function summarizeContext(d, unavailableReason = '') {
    const now = Date.now(), saved = Date.parse(d.updatedAt || '');
    const lists = ['chapters','quests','sessions','attempts','assessments','mistakes','evaluations','calendar','achievements'];
    const availability = Object.fromEntries(lists.map(k => [k, Array.isArray(d[k]) ? 'available' : 'not recorded']));
    const chapters = Array.isArray(d.chapters) ? d.chapters : [];
    const sessions = Array.isArray(d.sessions) ? d.sessions : [];
    const attempts = Array.isArray(d.attempts) ? d.attempts : [];
    const quests = Array.isArray(d.quests) ? d.quests : [];
    const assessments = Array.isArray(d.assessments) ? d.assessments : [];
    const mistakes = Array.isArray(d.mistakes) ? d.mistakes : [];
    const selected = chapters.map(c => ({
      id:clip(c.id,100), name:clip(c.name,100), subject:clip(c.subject,30), status:clip(c.status,24),
      mastered:!!c.mastered, priority:!!c.priority, topicStatuses:Object.entries(c.topicStatus||{}).slice(0,12).map(([k,v])=>[clip(k,80),clip(v,24)]),
      mainCoverage:clip(c.mainCoverage,20), advancedCoverage:clip(c.advancedCoverage,20), lastRevision:c.lastRevision||null,
      evidence:{studySessions:sessions.filter(s=>s.chapterId===c.id).length,mainIndependentSets:attempts.filter(a=>a.chapterId===c.id&&a.independent&&a.exam==='JEE Main').length,advancedIndependentSets:attempts.filter(a=>a.chapterId===c.id&&a.independent&&a.exam==='JEE Advanced').length}
    })).sort((a,b)=>Number(b.priority)-Number(a.priority)+Number(b.status==='Backlog')-Number(a.status==='Backlog'))
      .filter(c=>c.priority||c.status==='Backlog'||c.mastered||c.topicStatuses.length||c.evidence.studySessions||c.evidence.mainIndependentSets||c.evidence.advancedIndependentSets||c.lastRevision).slice(0,18);
    const subjectStats = ['Physics','Chemistry','Mathematics'].map(subject=>{
      const ids = new Set(chapters.filter(c=>c.subject===subject).map(c=>c.id));
      const rows = attempts.filter(a=>ids.has(a.chapterId));
      const total = rows.reduce((n,a)=>n+(Number(a.total)||0),0);
      const correct = rows.reduce((n,a)=>n+(Number(a.correct)||0),0);
      return {subject,chapters:ids.size,mastered:chapters.filter(c=>c.subject===subject&&c.mastered).length,studyMinutes:sessions.filter(s=>ids.has(s.chapterId)).reduce((n,s)=>n+(Number(s.minutes)||0),0),pyqAttempted:total,pyqCorrect:correct};
    });
    const payload = {
      schemaVersion:d.version??null, snapshotAt:new Date().toISOString(),
      freshness:{lastSavedAt:d.updatedAt||null,ageMinutes:Number.isFinite(saved)?Math.max(0,Math.round((now-saved)/60000)):null,stale:Number.isFinite(saved)&&(now-saved)>24*60*60000},
      availability:{...availability,profile:d.profile?'available':'not recorded',plannerSettings:d.settings?'available':'not recorded',unavailableReason:unavailableReason||undefined},
      preparation:{targetExam:clip(d.profile?.targetExam||'not recorded',30),targetYear:clip(d.profile?.targetYear||'not recorded',8),availableMinutes:Number(d.settings?.availableMinutes)||null,level:Number(d.profile?.level)||null,rank:clip(d.profile?.rank||'not recorded',40),xp:Number(d.profile?.xp)||0,streak:Number(d.profile?.streak)||0,bestStreak:Number(d.profile?.bestStreak)||0,achievements:(d.achievements||[]).slice(-8).map(a=>clip(a.title||a.id,80))},
      syllabus:{chapterCount:chapters.length,mastered:chapters.filter(c=>c.mastered).length,backlog:chapters.filter(c=>c.status==='Backlog').length,inProgress:chapters.filter(c=>c.status==='In progress').length,chapters:selected},
      activeQuests:quests.filter(q=>!q.done&&!q.cancelledAt&&!q.skippedAt).slice(0,8).map(q=>({id:clip(q.id,100),title:clip(q.title,100),category:clip(q.category,30),minutes:Number(q.remainingMinutes||q.minutes)||null,date:q.date||null,time:q.time||null,chapterId:q.chapterId||null})),
      recentQuestHistory:quests.filter(q=>q.done||q.cancelledAt||q.skippedAt).slice(-6).reverse().map(q=>({title:clip(q.title,100),category:clip(q.category,30),done:!!q.done,cancelled:!!q.cancelledAt,date:q.date||null,completedAt:q.completedAt||null})),
      planner:Array.isArray(d.calendar)?d.calendar.slice(-8).map(x=>({title:clip(x.title,80),date:x.date||null,type:clip(x.type,30)})):[],
      sessions:sessions.slice(-7).reverse().map(s=>({chapterId:s.chapterId||null,type:clip(s.type,30),minutes:Number(s.minutes)||0,at:s.at||null,notes:clip(s.notes,100)})),
      pyqSets:attempts.slice(-7).reverse().map(a=>({chapterId:a.chapterId||null,exam:clip(a.exam,30),difficulty:clip(a.difficulty,20),attempted:Number(a.total)||0,correct:Number(a.correct)||0,independent:!!a.independent,at:a.at||null})),
      assessments:assessments.slice(-5).reverse().map(a=>({title:clip(a.title,80),subject:clip(a.subject,30),date:a.date||null,score:a.score==null?null:Number(a.score),total:a.total==null?null:Number(a.total)})),
      unresolvedMistakes:mistakes.filter(m=>!m.corrected).slice(-5).reverse().map(m=>({chapterId:m.chapterId||null,topic:clip(m.topic,80),type:clip(m.type,30),correction:clip(m.correction,120)})),
      evaluations:(d.evaluations||[]).slice(-2).map(x=>({at:x.at||null,enough:!!x.enough,score:x.score??null,studyDays:x.studyDays??null,accuracy:x.accuracy??null})),
      conversationHistory:(d.conversations||[]).slice(-8).map(m=>({role:m.role==='assistant'?'assistant':'user',text:clip(m.text,260)})),
      subjectAnalytics:subjectStats
    };
    const trimOrder = ['recentQuestHistory','planner','sessions','pyqSets','assessments','unresolvedMistakes','conversationHistory','syllabus.chapters'];
    let text = JSON.stringify(payload);
    while (text.length > MAX_CONTEXT) {
      const path = trimOrder.find(p=>p==='syllabus.chapters'?payload.syllabus.chapters.length>6:payload[p].length>2);
      if (!path) break;
      if(path==='syllabus.chapters')payload.syllabus.chapters.pop();else payload[path].pop();
      text=JSON.stringify(payload);
    }
    if(text.length>MAX_CONTEXT) return {text:JSON.stringify({snapshotAt:payload.snapshotAt,availability:payload.availability,unavailableReason:'Detailed context exceeded the safe size limit.'}),snapshotAt:payload.snapshotAt};
    return {text,snapshotAt:payload.snapshotAt};
  }
  function contextFor(dataState) {
    if (!$('chat-context').checked) return {text:JSON.stringify({available:false,omittedByUser:true,snapshotAt:new Date().toISOString()}),snapshotAt:new Date().toISOString()};
    if (!dataState.ok) return summarizeContext({},dataState.reason);
    try { return summarizeContext(dataState.data); }
    catch { return summarizeContext({},'Some saved application records could not be read.'); }
  }

  function overlap(candidate, excludeId, d) {
    if (!candidate.date || !candidate.time) return false;
    const start = t=>Number(t.slice(0,2))*60+Number(t.slice(3));
    const a=start(candidate.time),duration=Number(candidate.minutes)||0;
    return (d.quests||[]).some(q=>q.id!==excludeId&&!q.done&&!q.cancelledAt&&q.date===candidate.date&&q.time&&a<start(q.time)+Number(q.remainingMinutes||q.minutes)&&a+duration>start(q.time));
  }
  function validateAction(a,d) {
    if(!a||typeof a!=='object'||Array.isArray(a))return 'Action payload is malformed.';
    if(typeof a.id!=='string'||a.id.length<8||a.id.length>100)return 'Action has no valid unique ID.';
    if(!Number.isFinite(Date.parse(a.expiresAt||''))||Date.parse(a.expiresAt)<=Date.now())return 'Action is expired or has an invalid expiry.';
    if(a.validationStatus!=='validated')return 'Action did not pass Worker validation.';
    if(typeof a.reason!=='string'||!a.reason.trim()||a.reason.length>300)return 'Action is missing a concise reason.';
    if(typeof a.expectedEffect!=='string'||!a.expectedEffect.trim()||a.expectedEffect.length>300)return 'Action is missing an expected effect.';
    if(a.type==='create_quest'){
      if(typeof a.title!=='string'||!a.title.trim()||a.title.length>120||!validMinutes(a.minutes)||!['Main Quest','Side Quest','Revision','Assessment'].includes(a.category))return 'Quest fields are invalid.';
      if(a.date&&!validDate(a.date))return 'Quest date is invalid.';if(!validTime(a.time||''))return 'Quest time is invalid.';if(a.chapterId&&!chapterById(d,a.chapterId))return 'Chapter no longer exists.';
      if(overlap(a,null,d))return 'Quest conflicts with an existing scheduled quest.';return '';
    }
    if(a.type==='edit_quest'){
      const q=questById(d,a.questId);if(!q||q.done||q.cancelledAt)return 'Quest no longer exists or is inactive.';
      if(a.title!==undefined&&(!String(a.title).trim()||String(a.title).length>120))return 'Quest title is invalid.';
      if(a.minutes!==undefined&&!validMinutes(a.minutes))return 'Quest duration is invalid.';
      if(a.category!==undefined&&!['Main Quest','Side Quest','Revision','Assessment'].includes(a.category))return 'Quest category is invalid.';
      if(a.date!==undefined&&!validDate(a.date))return 'Quest date is invalid.';if(a.time!==undefined&&!validTime(a.time))return 'Quest time is invalid.';
      if(a.chapterId!==undefined&&a.chapterId&&!chapterById(d,a.chapterId))return 'Chapter no longer exists.';
      if(!['title','minutes','category','date','time','chapterId'].some(k=>a[k]!==undefined))return 'No edit was provided.';
      if(overlap({...q,...a,minutes:a.minutes??q.minutes},q.id,d))return 'Edited quest conflicts with another quest.';return '';
    }
    if(a.type==='set_priority')return chapterById(d,a.chapterId)?'':'Chapter no longer exists.';
    if(a.type==='set_status')return chapterById(d,a.chapterId)&&['Not started','In progress','Backlog'].includes(a.status)?'':'Chapter status is invalid.';
    if(a.type==='reschedule_quest'){
      const q=questById(d,a.questId);if(!q||q.done||q.cancelledAt)return 'Quest no longer exists or is inactive.';
      if(!validDate(a.date)||!validTime(a.time||''))return 'Reschedule date or time is invalid.';
      return overlap({...q,date:a.date,time:a.time||''},q.id,d)?'Quest conflicts with another scheduled quest.':'';
    }
    if(a.type==='set_availability')return Number.isInteger(a.minutes)&&a.minutes>=15&&a.minutes<=720?'':'Availability is invalid.';
    if(a.type==='set_topic_status'){
      const c=chapterById(d,a.chapterId);return c&&topicKeys(c).includes(a.topicKey)&&['not-started','backlog','in-progress','completed'].includes(a.status)?'':'Topic or status is invalid.';
    }
    if(a.type==='create_assessment')return typeof a.title==='string'&&a.title.trim()&&a.title.length<=120&&['Physics','Chemistry','Mathematics','Full JEE'].includes(a.subject)&&validDate(a.date)?'':'Assessment plan is invalid.';
    if(a.type==='record_assessment')return typeof a.title==='string'&&a.title.trim()&&a.title.length<=120&&['Physics','Chemistry','Mathematics','Full JEE'].includes(a.subject)&&validDate(a.date)&&Number.isInteger(a.score)&&Number.isInteger(a.total)&&a.total>0&&a.score>=0&&a.score<=a.total?'':'Assessment result is invalid.';
    if(a.type==='create_mistake')return chapterById(d,a.chapterId)&&typeof a.topic==='string'&&a.topic.trim()&&a.topic.length<=120&&['Conceptual','Calculation','Misread question','Time management'].includes(a.mistakeType)&&typeof a.correction==='string'&&a.correction.trim()&&a.correction.length<=240?'':'Mistake entry is invalid.';
    return 'Action type is not allowed.';
  }
  function actionArgs(a) {
    const meta=new Set(['id','reason','expectedEffect','createdAt','expiresAt','validationStatus']);
    return Object.fromEntries(Object.entries(a).filter(([k])=>!meta.has(k)));
  }
  function event(entry,statusValue,result='') {
    const at=new Date().toISOString();entry.status=statusValue;entry.updatedAt=at;entry.lifecycle=Array.isArray(entry.lifecycle)?entry.lifecycle:[];entry.lifecycle.push({status:statusValue,at,result:clip(result,240)});
  }
  function audit(d,entry,type,result='') {
    d.audit=Array.isArray(d.audit)?d.audit:[];d.audit.push({at:new Date().toISOString(),type,actionId:entry.id,actionType:entry.type,result:clip(result,240)});d.audit=d.audit.slice(-1000);
  }
  function recordProposals(list) {
    const current=readDb();if(!current.ok)return;
    const d=current.data;d.actions=Array.isArray(d.actions)?d.actions:[];const known=new Set(d.actions.map(x=>x.id));let changed=false;
    for(const candidate of (Array.isArray(list)?list:[]).slice(0,3)){
      if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))continue;
      const proposedId=typeof candidate.id==='string'&&candidate.id.length<=100?candidate.id:crypto.randomUUID();
      if(known.has(proposedId)){audit(d,{id:proposedId,type:clip(candidate.type,50)},'ai-action-duplicate','Duplicate action ID rejected.');changed=true;continue;}
      const a={...candidate,id:proposedId};
      const issue=validateAction(a,d);if(issue){audit(d,{id:proposedId,type:clip(a.type,50)},'ai-action-invalid',issue);known.add(proposedId);changed=true;continue;}
      const entry={id:a.id,type:a.type,arguments:actionArgs(a),reason:clip(a.reason,300),expectedEffect:clip(a.expectedEffect,300),createdAt:a.createdAt||new Date().toISOString(),expiresAt:a.expiresAt,validationResult:{status:'passed',checkedAt:new Date().toISOString()},status:'PROPOSED',lifecycle:[]};
      event(entry,'VALIDATED','Worker schema and current application state passed validation.');event(entry,'AWAITING_APPROVAL','No application change has been made.');audit(d,entry,'ai-action-proposed','Awaiting explicit approval.');d.actions.push(entry);known.add(entry.id);changed=true;
    }
    if(changed){d.actions=d.actions.slice(-500);store(d);}
  }
  function applyMutation(d,a) {
    const now=new Date().toISOString();
    if(a.type==='create_quest')d.quests.push({id:crypto.randomUUID(),title:a.title.trim(),chapterId:a.chapterId||undefined,minutes:a.minutes,category:a.category,date:a.date||'',time:a.time||'',done:false,createdAt:now,aiProposed:true,actionId:a.id});
    else if(a.type==='edit_quest'){const q=questById(d,a.questId);for(const k of ['title','minutes','category','date','time','chapterId'])if(a[k]!==undefined)q[k]=a[k];q.updatedAt=now;}
    else if(a.type==='set_priority'){const c=chapterById(d,a.chapterId);c.priority=!c.priority;}
    else if(a.type==='set_status'){const c=chapterById(d,a.chapterId);c.status=a.status;}
    else if(a.type==='reschedule_quest'){const q=questById(d,a.questId);q.date=a.date;q.time=a.time||'';q.updatedAt=now;}
    else if(a.type==='set_availability')d.settings.availableMinutes=a.minutes;
    else if(a.type==='set_topic_status'){const c=chapterById(d,a.chapterId),previous=c.topicStatus?.[a.topicKey]||'not-started';c.topicStatus=c.topicStatus||{};c.topicStatus[a.topicKey]=a.status;c.topicHistory=c.topicHistory||{};c.topicEvidence=c.topicEvidence||{};c.topicHistory[a.topicKey]=c.topicHistory[a.topicKey]||[];c.topicHistory[a.topicKey].push({from:previous,to:a.status,at:now,source:'approved mentor proposal'});c.topicEvidence[a.topicKey]={source:'approved mentor proposal',at:now};const vals=Object.values(c.topicStatus);c.status=vals.length&&vals.every(v=>['completed','mastered'].includes(v))?'Completed':vals.some(v=>['in-progress','completed'].includes(v))?'In progress':vals.includes('backlog')?'Backlog':'Not started';}
    else if(a.type==='create_assessment')d.assessments.push({id:crypto.randomUUID(),title:a.title.trim(),subject:a.subject,date:a.date,score:null,total:null,aiProposed:true,actionId:a.id,createdAt:now});
    else if(a.type==='record_assessment')d.assessments.push({id:crypto.randomUUID(),title:a.title.trim(),subject:a.subject,date:a.date,score:a.score,total:a.total,reportedBy:'student-approved proposal',aiProposed:true,actionId:a.id,createdAt:now});
    else if(a.type==='create_mistake')d.mistakes.push({id:crypto.randomUUID(),chapterId:a.chapterId,topic:a.topic.trim(),type:a.mistakeType,correction:a.correction.trim(),at:now,corrected:false,reportedBy:'student-approved proposal',actionId:a.id});
  }
  function executeApproved(id) {
    const current=readDb();if(!current.ok)throw new Error(current.reason);
    const d=current.data;d.actions=Array.isArray(d.actions)?d.actions:[];const entry=d.actions.find(x=>x.id===id);
    if(!entry)throw new Error('Approved action record was not found.');
    if(entry.status==='EXECUTED')return false;
    if(!['APPROVED','FAILED'].includes(entry.status))throw new Error('Action is not in the approved state.');
    if(Date.parse(entry.expiresAt)<=Date.now()){event(entry,'EXPIRED','Approval window elapsed.');audit(d,entry,'ai-action-expired','Approval window elapsed.');store(d);return false;}
    const a={...entry.arguments,id:entry.id,expiresAt:entry.expiresAt,validationStatus:'validated',reason:entry.reason,expectedEffect:entry.expectedEffect};
    const issue=validateAction(a,d);if(issue)throw new Error(issue);
    applyMutation(d,a);event(entry,'EXECUTED','Application state persisted successfully.');entry.executionResult={ok:true,at:new Date().toISOString()};audit(d,entry,'ai-action-executed','Application state persisted successfully.');store(d);return true;
  }
  function persistTransition(id,next,result='') {
    const current=readDb();if(!current.ok)throw new Error(current.reason);
    const d=current.data;d.actions=Array.isArray(d.actions)?d.actions:[];const entry=d.actions.find(x=>x.id===id);
    if(!entry)throw new Error('Proposal record was not found.');
    if(entry.status==='EXECUTED'||entry.status==='REJECTED'||entry.status==='CANCELLED'||entry.status==='EXPIRED')return false;
    if(next==='APPROVED'&&entry.status!=='AWAITING_APPROVAL'&&!(entry.status==='FAILED'&&entry.executionResult?.ok===false)&&entry.status!=='APPROVED')return false;
    event(entry,next,result);audit(d,entry,'ai-action-'+next.toLowerCase(),result);store(d);return true;
  }
  function withActionLock(id,run){return navigator.locks?.request?navigator.locks.request('comeback-os-action-'+id,{mode:'exclusive'},run):Promise.resolve(run());}
  function cardFor(entry) {
    const card=document.createElement('article');card.className='card proposal';card.dataset.actionId=entry.id;
    const heading=document.createElement('b');heading.textContent=entry.type.replaceAll('_',' ').toUpperCase()+' · '+entry.status.replaceAll('_',' ');
    const explanation=document.createElement('p');explanation.textContent=entry.reason;
    const effect=document.createElement('p');effect.textContent='Expected effect: '+entry.expectedEffect;
    const expiry=document.createElement('small');expiry.textContent='Expires '+new Date(entry.expiresAt).toLocaleString();
    card.append(heading,explanation,effect,expiry);
    if(entry.status==='AWAITING_APPROVAL'){
      const yes=document.createElement('button'),no=document.createElement('button'),cancel=document.createElement('button');
      yes.textContent='Approve and execute';no.textContent='Reject';cancel.textContent='Cancel proposal';cancel.type='button';
      yes.onclick=async()=>{yes.disabled=true;no.disabled=true;cancel.disabled=true;try{await withActionLock(entry.id,()=>{if(!persistTransition(entry.id,'APPROVED','Explicit user approval recorded.'))throw new Error('Proposal is no longer awaiting approval.');executeApproved(entry.id);});status.textContent='Approved, executed, and audited.';}catch(error){try{const current=readDb();if(current.ok){const failed=current.data.actions?.find(x=>x.id===entry.id);if(failed)failed.executionResult={ok:false,reason:clip(error.message,240),at:new Date().toISOString()};store(current.data);}persistTransition(entry.id,'FAILED',error.message);}catch{}status.textContent='Action failed: '+error.message;}renderStoredActions();};
      no.onclick=()=>{try{persistTransition(entry.id,'REJECTED','Rejected by student.');status.textContent='Proposal rejected; no application changes were made.';}catch(error){status.textContent='Could not record rejection: '+error.message;}renderStoredActions();};
      cancel.onclick=()=>{try{persistTransition(entry.id,'CANCELLED','Cancelled before approval.');status.textContent='Proposal cancelled; no application changes were made.';}catch(error){status.textContent='Could not cancel proposal: '+error.message;}renderStoredActions();};
      card.append(yes,no,cancel);
    } else if(entry.status==='APPROVED'||entry.status==='FAILED') {
      if(entry.status==='FAILED'){const failure=document.createElement('p');failure.textContent='Last attempt failed: '+clip(entry.executionResult?.reason||'No result recorded.',240);card.append(failure);}
      const resume=document.createElement('button');resume.textContent=entry.status==='FAILED'?'Retry approved action':'Complete approved action';resume.onclick=async()=>{resume.disabled=true;try{await withActionLock(entry.id,()=>{if(entry.status==='FAILED')persistTransition(entry.id,'APPROVED','Retrying previously approved action.');executeApproved(entry.id);});status.textContent='Approved action executed and audited.';}catch(error){status.textContent='Action failed: '+error.message;}renderStoredActions();};card.append(resume);
    }
    return card;
  }
  function renderStoredActions() {
    actions.replaceChildren();const current=readDb();if(!current.ok)return;
    const d=current.data;d.actions=Array.isArray(d.actions)?d.actions:[];let changed=false;
    for(const x of d.actions){if(['AWAITING_APPROVAL','APPROVED'].includes(x.status)&&Date.parse(x.expiresAt)<=Date.now()){event(x,'EXPIRED','Approval window elapsed.');audit(d,x,'ai-action-expired','Approval window elapsed.');changed=true;}}
    if(changed)try{store(d);}catch{}
    for(const entry of d.actions.filter(x=>['AWAITING_APPROVAL','APPROVED','FAILED'].includes(x.status)))actions.append(cardFor(entry));
  }

  function setBusy(value) {
    busy=value;const send=form.querySelector('button[type="submit"]')||form.querySelector('button');
    send.disabled=value;send.textContent=value?'Thinking…':'Send';cancelButton.hidden=!value;
    if(value)retryButton.hidden=true;
  }
  async function sendMessage(message) {
    if(busy||!message||message.length>4000)return;
    setBusy(true);retryButton.hidden=true;add(message,'user');input.value='';status.textContent=navigator.onLine?'THE SYSTEM is thinking…':'You are offline; trying the Worker connection…';
    const snapshot=readDb(),ctx=contextFor(snapshot),requestId=crypto.randomUUID();controller=new AbortController();timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller?.abort();},20000);
    try {
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({message,studyContext:ctx.text,contextSnapshotAt:ctx.snapshotAt,clientRequestId:requestId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Request failed ('+response.status+').');
      if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('The AI returned an empty response.');
      add(data.reply.trim(),'system');
      const latest=readDb();
      const changed=latest.ok&&snapshot.ok&&latest.data.updatedAt!==snapshot.data.updatedAt;
      if(latest.ok){const d=latest.data;d.conversations=Array.isArray(d.conversations)?d.conversations:[];d.conversations.push({role:'user',text:message.slice(0,1200),at:new Date().toISOString()},{role:'assistant',text:data.reply.trim().slice(0,1200),at:new Date().toISOString()});d.conversations=d.conversations.slice(-24);try{store(d);}catch{status.textContent='Response received; local history could not be saved.';}}
      recordProposals(Array.isArray(data.actions)?data.actions:[]);renderStoredActions();
      const stamp=new Date(ctx.snapshotAt).toLocaleTimeString();
      if(!navigator.onLine)status.textContent='Response received · context snapshot '+stamp+' · you are offline now.';
      else if(changed)status.textContent='Response received · application data changed since the context snapshot; review actions carefully.';
      else if(!Array.isArray(data.actions))status.textContent='Connected to Gemini · this Worker returned text only; no action proposals were supplied.';
      else status.textContent='Connected to Gemini · context snapshot '+stamp+' · proposed changes require approval.';
      retryMessage='';retryButton.hidden=true;
    } catch(error) {
      if(error.name==='AbortError'){
        status.textContent=timedOut?'Request timed out. No application action was applied.':'Request cancelled. No application action was applied.';
        retryMessage=message;retryButton.hidden=false;
      } else {
        status.textContent=navigator.onLine?'AI unavailable · your message is ready to retry.':'Offline · local study tools remain available; no AI response was fabricated.';
        retryMessage=message;retryButton.hidden=false;
        add('I could not reach the mentor service. '+clip(error.message||error,240),'system');
      }
      input.value=message;
    } finally {clearTimeout(timer);controller=null;setBusy(false);}
  }
  form.addEventListener('submit',e=>{e.preventDefault();sendMessage(input.value.trim());});
  cancelButton.addEventListener('click',()=>controller?.abort());
  retryButton.addEventListener('click',()=>{if(!busy)sendMessage(input.value.trim()||retryMessage);});
  input.addEventListener('input',()=>{if(input.value.trim()!==retryMessage)retryButton.hidden=true;});
  $('clear-chat').addEventListener('click',()=>{if(!confirm('Clear saved conversation history?'))return;const current=readDb();if(!current.ok){status.textContent=current.reason;return;}current.data.conversations=[];try{store(current.data);log.replaceChildren();status.textContent='Conversation history cleared; action audit is preserved.';}catch(error){status.textContent='History could not be cleared: '+clip(error.message,160);}});
  $('save-chat').addEventListener('click',()=>{const current=readDb();if(!current.ok){status.textContent=current.reason;return;}current.data.settings=current.data.settings||{};current.data.settings.shareContext=$('chat-context').checked;try{store(current.data);status.textContent='Context-sharing preference saved.';}catch(error){status.textContent='Preference could not be saved: '+clip(error.message,160);}});
  window.addEventListener('offline',()=>{if(!busy)status.textContent='Offline · local study tools remain available; THE SYSTEM needs a connection.';});
  window.addEventListener('online',()=>{if(!busy)status.textContent='Online · THE SYSTEM is ready when you send a message.';});
  const current=readDb();if(current.ok)$('chat-context').checked=current.data.settings?.shareContext!==false;
  if(!navigator.onLine)status.textContent='Offline · local study tools remain available; THE SYSTEM needs a connection.';
  if(current.ok){for(const m of (current.data.conversations||[]).slice(-24)){if(m&&typeof m.text==='string')add(m.text,m.role==='assistant'?'system':'user');}}
  renderStoredActions();
})();
