import {
  ANALYSIS_SCHEMA,
  buildFallbackAnalysis,
  extractResponseText,
  normalizeAnalysis,
} from "./analysis.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const provider = getProviderConfig(env);
      return json({
        ok: true,
        provider: provider?.name || "demo",
        model: provider?.model || null,
        aiConfigured: Boolean(provider),
      });
    }

    if (url.pathname === "/api/analyze" && request.method === "POST") {
      return analyze(request, env);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, 405);
    }

    const assetUrl = new URL(url);
    if (assetUrl.pathname === "/") assetUrl.pathname = "/index.html";
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (response.status !== 404 || assetUrl.pathname.includes(".")) return response;

    assetUrl.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

async function analyze(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a valid feature request and estimate." }, 400);
  }

  const feature = typeof body.feature === "string" ? body.feature.trim().slice(0, 120) : "";
  const estimate = Number(body.estimate);
  if (feature.length < 3) return json({ error: "Describe the feature in at least three characters." }, 400);
  if (!Number.isFinite(estimate) || estimate < 0.5 || estimate > 10000) {
    return json({ error: "Enter an estimate between 0.5 and 10,000 hours." }, 400);
  }

  const provider = getProviderConfig(env);
  if (!provider) {
    return json({
      analysis: buildFallbackAnalysis(feature, estimate),
      source: "demo",
      model: null,
      notice: "Demo analysis — add OPENAI_API_KEY to enable live GPT-5.6 scoping.",
    });
  }

  try {
    const analysis = await requestModel(feature, estimate, provider);
    return json({
      analysis,
      source: provider.name,
      model: provider.model,
      notice: `Analyzed live with GPT-5.6 through ${provider.label}.`,
    });
  } catch (error) {
    console.error("OpenAI analysis failed", error);
    return json({
      analysis: buildFallbackAnalysis(feature, estimate),
      source: "demo",
      model: null,
      notice: "Live analysis was unavailable, so Gremlin used its reliable demo brain.",
    });
  }
}

async function requestModel(feature, estimate, provider) {
  const systemPrompt = `You are Gremlin, a sharp senior product engineer who reveals hidden implementation work. Return only the requested structured output. Produce concrete, credible tasks rather than generic advice. Put essential happy-path, security, accessibility, validation, and testing work in requiredTasks. Put polish and post-MVP variations in laterTasks. Give each task a stable kebab-case id and a realistic hour estimate. Do not inflate estimates for drama. Keep explanations concise. Make humorousVerdict one witty sentence.`;
  const payload = {
    model: provider.model,
    store: false,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: `Feature request: ${feature}\nOriginal estimate: ${estimate} hours\nExpose the hidden work and identify the smallest credible MVP.`,
        }],
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "gremlin_scope_analysis",
        strict: true,
        schema: ANALYSIS_SCHEMA,
      },
    },
    max_output_tokens: 7000,
  };

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      ...(provider.name === "openrouter" ? {
        "HTTP-Referer": "https://gremlin-scope-lab-2026.app.chatgpt.com",
        "X-OpenRouter-Title": "Gremlin",
      } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  const result = await response.json();
  return normalizeAnalysis(JSON.parse(extractResponseText(result)), feature, estimate);
}

function getProviderConfig(env) {
  if (env.OPENROUTER_API_KEY) {
    return {
      name: "openrouter",
      label: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/responses",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || "openai/gpt-5.6-terra-pro",
    };
  }

  if (env.OPENAI_API_KEY) {
    return {
      name: "openai",
      label: "OpenAI",
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || "gpt-5.6",
    };
  }

  return null;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
