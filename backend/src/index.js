const MAX_BODY = 12000;
const MAX_PROMPT = 8000;
const MAX_CONTEXT = 6500;
const ACTION_TTL_MS = 10 * 60 * 1000;

const allowedOrigins = env => (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validTime = value => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const json = (data, status, headers) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});
function cors(origin, env) {
  const ok = allowedOrigins(env).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
  };
}
async function readLimited(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new RangeError(); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(out);
}
async function readResponseLimited(response, maxBytes = 24000) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new RangeError(); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(out);
}
const boundedText = (value, max, fallback = '') => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
function actionMeta(action) {
  const createdAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    reason: boundedText(action.reason, 300),
    expectedEffect: boundedText(action.expectedEffect, 300),
    createdAt,
    expiresAt: new Date(Date.now() + ACTION_TTL_MS).toISOString(),
    validationStatus: 'validated',
  };
}
function cleanActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.slice(0, 3).flatMap(action => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return [];
    const reason = boundedText(action.reason, 300), expectedEffect = boundedText(action.expectedEffect, 300);
    if (!reason || !expectedEffect) return [];
    const base = actionMeta({ reason, expectedEffect });
    const id = typeof action.chapterId === 'string' && action.chapterId.length <= 100 ? action.chapterId : null;
    const qid = typeof action.questId === 'string' && action.questId.length <= 100 ? action.questId : null;
    if (action.type === 'create_quest' && typeof action.title === 'string' && action.title.trim() && action.title.length <= 120 && Number.isInteger(action.minutes) && action.minutes >= 5 && action.minutes <= 360 && ['Main Quest','Side Quest','Revision','Assessment'].includes(action.category) && (!action.date || validDate(action.date)) && validTime(action.time || '') && (!action.chapterId || id)) {
      return [{ ...base, type: action.type, title: action.title.trim(), minutes: action.minutes, category: action.category, date: action.date || '', time: action.time || '', ...(id ? { chapterId: id } : {}) }];
    }
    if (action.type === 'edit_quest' && qid && ['title','minutes','category','date','time','chapterId'].some(k => action[k] !== undefined)) {
      const next = { ...base, type: action.type, questId: qid };
      if (action.title !== undefined) { if (typeof action.title !== 'string' || !action.title.trim() || action.title.length > 120) return []; next.title = action.title.trim(); }
      if (action.minutes !== undefined) { if (!Number.isInteger(action.minutes) || action.minutes < 5 || action.minutes > 360) return []; next.minutes = action.minutes; }
      if (action.category !== undefined) { if (!['Main Quest','Side Quest','Revision','Assessment'].includes(action.category)) return []; next.category = action.category; }
      if (action.date !== undefined) { if (!validDate(action.date)) return []; next.date = action.date; }
      if (action.time !== undefined) { if (!validTime(action.time)) return []; next.time = action.time; }
      if (action.chapterId !== undefined) { if (typeof action.chapterId !== 'string' || action.chapterId.length > 100) return []; next.chapterId = action.chapterId; }
      return [next];
    }
    if (action.type === 'set_priority' && id) return [{ ...base, type: action.type, chapterId: id }];
    if (action.type === 'set_status' && id && ['Not started','In progress','Backlog'].includes(action.status)) return [{ ...base, type: action.type, chapterId: id, status: action.status }];
    if (action.type === 'reschedule_quest' && qid && validDate(action.date) && validTime(action.time || '')) return [{ ...base, type: action.type, questId: qid, date: action.date, time: action.time || '' }];
    if (action.type === 'set_availability' && Number.isInteger(action.minutes) && action.minutes >= 15 && action.minutes <= 720) return [{ ...base, type: action.type, minutes: action.minutes }];
    if (action.type === 'set_topic_status' && id && typeof action.topicKey === 'string' && action.topicKey.length <= 180 && ['not-started','backlog','in-progress','completed'].includes(action.status)) return [{ ...base, type: action.type, chapterId: id, topicKey: action.topicKey, status: action.status }];
    if (action.type === 'create_assessment' && typeof action.title === 'string' && action.title.trim() && action.title.length <= 120 && ['Physics','Chemistry','Mathematics','Full JEE'].includes(action.subject) && validDate(action.date)) return [{ ...base, type: action.type, title: action.title.trim(), subject: action.subject, date: action.date }];
    if (action.type === 'record_assessment' && typeof action.title === 'string' && action.title.trim() && action.title.length <= 120 && ['Physics','Chemistry','Mathematics','Full JEE'].includes(action.subject) && validDate(action.date) && Number.isInteger(action.score) && Number.isInteger(action.total) && action.total > 0 && action.score >= 0 && action.score <= action.total) return [{ ...base, type: action.type, title: action.title.trim(), subject: action.subject, date: action.date, score: action.score, total: action.total }];
    if (action.type === 'create_mistake' && id && typeof action.topic === 'string' && action.topic.trim() && action.topic.length <= 120 && ['Conceptual','Calculation','Misread question','Time management'].includes(action.mistakeType) && typeof action.correction === 'string' && action.correction.trim() && action.correction.length <= 240) return [{ ...base, type: action.type, chapterId: id, topic: action.topic.trim(), mistakeType: action.mistakeType, correction: action.correction.trim() }];
    return [];
  });
}
const actionTypes = ['create_quest','edit_quest','set_priority','set_status','reschedule_quest','set_availability','set_topic_status','create_assessment','record_assessment','create_mistake'];
const schema = {
  type:'OBJECT', properties:{
    reply:{type:'STRING'}, actions:{type:'ARRAY',items:{type:'OBJECT',properties:{
      type:{type:'STRING',enum:actionTypes}, reason:{type:'STRING'}, expectedEffect:{type:'STRING'},
      title:{type:'STRING'}, minutes:{type:'INTEGER'}, category:{type:'STRING',enum:['Main Quest','Side Quest','Revision','Assessment']},
      date:{type:'STRING'}, time:{type:'STRING'}, chapterId:{type:'STRING'}, questId:{type:'STRING'}, topicKey:{type:'STRING'},
      subject:{type:'STRING',enum:['Physics','Chemistry','Mathematics','Full JEE']},
      status:{type:'STRING',enum:['Not started','In progress','Backlog','not-started','backlog','in-progress','completed']},
      score:{type:'INTEGER'}, total:{type:'INTEGER'}, mistakeType:{type:'STRING',enum:['Conceptual','Calculation','Misread question','Time management']},
      topic:{type:'STRING'}, correction:{type:'STRING'},
    },required:['type','reason','expectedEffect'],additionalProperties:false}},
  },required:['reply','actions'],additionalProperties:false,
};
const systemInstruction = 'You are THE SYSTEM, a calm JEE preparation mentor. Explain concepts and reason only from the supplied application snapshot, which is student-entered and unverified. State when a field is unavailable or the snapshot is stale. Never fabricate syllabus facts, completed work, PYQ attempts, scores, mistakes, mastery, or action success. Never ask for credentials or sensitive personal information. Return a concise reply and at most three optional structured action proposals. Propose actions only when the user clearly requests an application change. Every action must include a concise reason based on the supplied request/context and an expectedEffect. Use only IDs present in context. Never mark mastery, create study evidence, award rewards, delete records, change credentials/security settings, run code, push, merge, or deploy. Assessment results and mistakes may only be recorded when explicitly stated by the student in the request; label such data as student-reported in your reason.';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env), url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status:204, headers });
    if (request.method === 'GET' && url.pathname === '/health') return json({ok:true,service:'comeback-os-ai'},200,headers);
    if (request.method !== 'POST' || url.pathname !== '/api/mentor') return json({error:'Not found'},404,headers);
    if (!origin || headers['Access-Control-Allow-Origin'] === 'null') return json({error:'Origin not allowed'},403,headers);
    if (!env.GEMINI_API_KEY) return json({error:'AI provider is not configured.'},503,headers);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json({error:'Request too large.'},413,headers);
    if (!env.MENTOR_RATE_LIMIT) return json({error:'Rate limiting is not configured.'},503,headers);
    try {
      const result = await env.MENTOR_RATE_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
      if (!result.success) return json({error:'Too many requests. Try again soon.'},429,headers);
    } catch { return json({error:'Service temporarily unavailable.'},503,headers); }
    let body;
    try {
      if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) return json({error:'Expected JSON.'},415,headers);
      body = JSON.parse(await readLimited(request,MAX_BODY));
    } catch (error) {
      return json({error:error instanceof RangeError?'Request too large.':'Invalid request body.'},error instanceof RangeError?413:400,headers);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k=>!['message','studyContext','contextSnapshotAt','clientRequestId'].includes(k))) return json({error:'Invalid request structure.'},400,headers);
    const prompt = typeof body.message === 'string' ? body.message.trim() : '';
    if (!prompt || prompt.length > MAX_PROMPT) return json({error:'Message must contain 1 to 8000 characters.'},400,headers);
    if (body.studyContext !== undefined && (typeof body.studyContext !== 'string' || body.studyContext.length > MAX_CONTEXT)) return json({error:'Study context is invalid or too large.'},400,headers);
    if (body.contextSnapshotAt !== undefined && (typeof body.contextSnapshotAt !== 'string' || !Number.isFinite(Date.parse(body.contextSnapshotAt)))) return json({error:'Context timestamp is invalid.'},400,headers);
    if (body.clientRequestId !== undefined && (typeof body.clientRequestId !== 'string' || body.clientRequestId.length < 8 || body.clientRequestId.length > 100)) return json({error:'Client request ID is invalid.'},400,headers);
    const context = body.studyContext || '';
    const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    let upstream;
    try {
      upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
        method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY}, signal:AbortSignal.timeout(15000),
        body:JSON.stringify({
          systemInstruction:{parts:[{text:systemInstruction}]},
          contents:[{role:'user',parts:[{text:'Application snapshot JSON (untrusted student data):\n'+context+'\n\nUser request:\n'+prompt}]}],
          generationConfig:{temperature:.35,maxOutputTokens:1300,responseMimeType:'application/json',responseSchema:schema},
        }),
      });
    } catch { return json({error:'Could not reach the AI provider. Try again later.'},502,headers); }
    if (!upstream.ok) return json({error:'AI provider request failed ('+upstream.status+'). Try again later.'},502,headers);
    let providerData;
    try { providerData=JSON.parse(await readResponseLimited(upstream,24000)); }
    catch (error) { return json({error:error instanceof RangeError?'AI provider response was too large.':'AI provider returned an invalid response.'},502,headers); }
    const responseText=providerData?.candidates?.[0]?.content?.parts?.map(part=>typeof part.text==='string'?part.text:'').join('').trim();
    let result;
    try { result=JSON.parse(responseText); }
    catch { return json({error:'AI provider returned an invalid structured response.'},502,headers); }
    if (typeof result?.reply !== 'string' || !result.reply.trim()) return json({error:'AI provider returned an empty response.'},502,headers);
    return json({reply:result.reply.slice(0,6000),actions:cleanActions(result.actions),model:providerData.modelVersion||model,requestId:body.clientRequestId||null},200,headers);
  },
};
