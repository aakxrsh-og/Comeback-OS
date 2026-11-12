/* COMEBACK OS — The System chat integration. No API key is stored here. */
(() => {
  "use strict";
  const API_URL = "https://comeback-os-ai1.aakxrshs.workers.dev/api/mentor";
  const DB_KEY = "comeback-os";
  const MAX_MESSAGE = 4000;

  const css = document.createElement("style");
  css.textContent = `
  #cos-ai-launcher{position:fixed;right:16px;bottom:88px;z-index:9998;border:1px solid #49d9ff;border-radius:999px;padding:13px 17px;background:linear-gradient(120deg,#1266a6,#087d9b);color:#fff;font:700 12px system-ui;box-shadow:0 0 22px #49d9ff44}
  #cos-ai-panel{position:fixed;z-index:9999;right:12px;bottom:145px;width:min(420px,calc(100vw - 24px));height:min(620px,calc(100dvh - 175px));display:none;flex-direction:column;overflow:hidden;background:#071426;border:1px solid #276080;border-radius:16px;color:#e8f5ff;font:14px system-ui;box-shadow:0 18px 60px #000b}
  #cos-ai-panel.open{display:flex}#cos-ai-head{display:flex;justify-content:space-between;padding:14px;background:#0d2942;border-bottom:1px solid #276080}
  #cos-ai-head strong{color:#49d9ff;letter-spacing:1px}#cos-ai-close{background:none;border:0;color:#e8f5ff;font-size:22px}
  #cos-ai-messages{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
  .cos-ai-msg{max-width:90%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;padding:10px 12px;border-radius:12px;background:#102b43;border:1px solid #244c68}
  .cos-ai-msg.user{align-self:flex-end;background:#103c58}.cos-ai-msg.system{align-self:flex-start}
  #cos-ai-status{font-size:11px;color:#9bb5c8;padding:0 12px 8px;min-height:18px}
  #cos-ai-form{padding:10px;border-top:1px solid #244c68;display:grid;gap:8px}
  #cos-ai-context{font-size:11px;color:#9bb5c8;display:flex;align-items:center;gap:7px}
  #cos-ai-input{width:100%;min-height:72px;box-sizing:border-box;resize:vertical;background:#04101e;color:#e8f5ff;border:1px solid #315c78;border-radius:9px;padding:10px;font:14px system-ui}
  #cos-ai-send{justify-self:end;border:1px solid #49d9ff;border-radius:9px;padding:10px 16px;background:#087d9b;color:white;font-weight:700}
  #cos-ai-send:disabled{opacity:.5}@media(max-width:480px){#cos-ai-panel{right:8px;width:calc(100vw - 16px);height:min(66dvh,560px)}}
  `;
  document.head.appendChild(css);

  const launcher = document.createElement("button");
  launcher.id = "cos-ai-launcher";
  launcher.type = "button";
  launcher.textContent = "✧ THE SYSTEM";
  launcher.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.id = "cos-ai-panel";
  panel.setAttribute("aria-label", "The System AI mentor");
  panel.innerHTML = `
    <header id="cos-ai-head"><div><strong>THE SYSTEM</strong><div style="font-size:10px;color:#9bb5c8">COMEBACK OS · STUDY MENTOR</div></div><button id="cos-ai-close" type="button" aria-label="Close chat">×</button></header>
    <div id="cos-ai-messages" aria-live="polite"></div><div id="cos-ai-status">Ready when you are.</div>
    <form id="cos-ai-form"><label id="cos-ai-context"><input id="cos-ai-include" type="checkbox" checked> Include a brief summary of my study progress</label>
    <textarea id="cos-ai-input" maxlength="${MAX_MESSAGE}" placeholder="Ask about a JEE concept, plan, revision, or today's priorities…" required></textarea><button id="cos-ai-send" type="submit">SEND ↗</button></form>`;
  document.body.append(launcher, panel);

  const messages = panel.querySelector("#cos-ai-messages");
  const input = panel.querySelector("#cos-ai-input");
  const send = panel.querySelector("#cos-ai-send");
  const status = panel.querySelector("#cos-ai-status");
  const includeContext = panel.querySelector("#cos-ai-include");

  function addMessage(text, who) {
    const el = document.createElement("div");
    el.className = "cos-ai-msg " + who;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function studySummary() {
    try {
      const db = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
      const chapters = Array.isArray(db.chapters) ? db.chapters : [];
      const quests = Array.isArray(db.quests) ? db.quests : [];
      const sessions = Array.isArray(db.sessions) ? db.sessions : [];
      const attempts = Array.isArray(db.attempts) ? db.attempts : [];
      const subjects = {};
      chapters.forEach(c => {
        const s = String(c.subject || "Other");
        subjects[s] ||= { total: 0, mastered: 0, backlog: 0, inProgress: 0 };
        subjects[s].total++;
        if (c.mastered || c.status === "Mastered") subjects[s].mastered++;
        if (c.status === "Backlog") subjects[s].backlog++;
        if (c.status === "In progress") subjects[s].inProgress++;
      });
      return JSON.stringify({
        note: "User-entered study summary; not independently verified.",
        subjects,
        activeQuests: quests.filter(q => !q.done).slice(0, 8).map(q => ({
          title: String(q.title || "").slice(0, 100),
          minutes: Number(q.minutes) || 0
        })),
        studySessionsRecorded: sessions.length,
        pyqSessionsRecorded: attempts.length
      }).slice(0, 2200);
    } catch { return "Study progress could not be read."; }
  }

  launcher.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    launcher.setAttribute("aria-expanded", String(open));
    if (open && !messages.childElementCount) addMessage("I’m The System. Tell me what you’re studying, where you’re stuck, or what needs adjusting. I can help you plan, but recorded mastery remains based on actual evidence.", "system");
    if (open) input.focus();
  });
  panel.querySelector("#cos-ai-close").addEventListener("click", () => {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
  });

  panel.querySelector("#cos-ai-form").addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || message.length > MAX_MESSAGE || send.disabled) return;
    addMessage(message, "user");
    input.value = "";
    send.disabled = true;
    status.textContent = "The System is thinking…";
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, studyContext: includeContext.checked ? studySummary() : "" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The AI returned an empty response.");
      addMessage(data.reply.trim(), "system");
      status.textContent = "Connected · " + (data.model || "Gemini");
    } catch (err) {
      addMessage("I couldn't reach the AI service: " + String(err.message || err), "system");
      status.textContent = "Connection issue · try again later";
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
})();
