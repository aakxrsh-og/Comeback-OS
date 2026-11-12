// Integration example for the existing COMEBACK OS frontend.
// Set AI_BACKEND_URL to your deployed Worker URL after deployment.
// Do not put a Gemini key in this file.

async function askTheSystem(message, studyContext = "") {
  const endpoint = `${AI_BACKEND_URL.replace(/\/$/, "")}/api/mentor`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, studyContext }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `AI request failed (${response.status})`);
  }
  return data.reply;
}

// Example:
// const reply = await askTheSystem(
//   "Help me plan one realistic study session.",
//   "Current focus: Mole Concept. Available time: 45 minutes."
// );
