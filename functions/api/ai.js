export async function onRequestPost({ request, env }) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Content-Type": "application/json" };
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];
    if (!message) return new Response(JSON.stringify({ error: "Message is required." }), { status: 400, headers: cors });
    if (!env.OPENAI_API_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured." }), { status: 503, headers: cors });
    const input = history.concat([{ role: "user", text: message }]).map(x => ({
      role: x.role === "user" ? "user" : "assistant",
      content: String(x.text || "")
    }));
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions: "You are GutHeb AI, the developer assistant inside the GutHeb platform. Be concise, practical and honest. You may explain repository structure, code, README files, licenses, packages, issues, pull requests, workflows and Git concepts. Do not claim an action was performed unless GutHeb has actually performed it through a connected tool. The browser must never receive or see the API key.",
        input
      })
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(JSON.stringify({ error: "AI provider error.", detail: detail.slice(0, 500) }), { status: 502, headers: cors });
    }
    const data = await upstream.json();
    const output = data.output_text || (data.output || []).flatMap(x => x.content || []).map(x => x.text || "").join("") || "No response.";
    return new Response(JSON.stringify({ output }), { status: 200, headers: cors });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid AI request." }), { status: 400, headers: cors });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  }});
}
