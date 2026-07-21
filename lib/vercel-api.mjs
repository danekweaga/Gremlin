import {
  ANALYSIS_SCHEMA,
  buildFallbackAnalysis,
  extractResponseText,
  normalizeAnalysis,
} from "./analysis.mjs";

const SYSTEM_PROMPT = `You are Gremlin, a sharp senior product engineer who reveals hidden implementation work.

Analyze one feature request and return only the requested structured output. Produce a credible, implementation-ready scope—not generic project-management advice.

Rules:
- Break work across only the categories in the schema.
- Include concrete frontend, backend, product, data, accessibility, security, testing, and deployment work when genuinely relevant.
- Give each task a stable kebab-case id and realistic hour estimate.
- Put essential happy-path, safety, accessibility, and validation work in requiredTasks.
- Put polish, advanced variations, and post-MVP work in laterTasks.
- Dependencies must reference task ids when they appear inside a task.
- Do not inflate estimates for drama. Surface uncertainty through a realistic range.
- Keep explanations concise and specific.
- Make humorousVerdict one witty sentence, but keep every other field professionally useful.`;

export function getProviderConfig(environment = process.env) {
  if (environment.OPENROUTER_API_KEY) {
    return {
      name: "openrouter",
      label: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/responses",
      apiKey: environment.OPENROUTER_API_KEY,
      model: environment.OPENROUTER_MODEL || "openai/gpt-5.6-terra-pro",
    };
  }

  if (environment.OPENAI_API_KEY) {
    return {
      name: "openai",
      label: "OpenAI",
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_MODEL || "gpt-5.6",
    };
  }

  return null;
}

export async function analyzeFeature(
  feature,
  estimate,
  {
    environment = process.env,
    fetchImplementation = fetch,
    requestOrigin = null,
  } = {},
) {
  const provider = getProviderConfig(environment);

  if (!provider) {
    return {
      analysis: buildFallbackAnalysis(feature, estimate),
      source: "demo",
      model: null,
      notice: "Demo analysis — add an API key to enable live GPT-5.6 scoping.",
    };
  }

  try {
    const analysis = await requestModelAnalysis(feature, estimate, provider, {
      fetchImplementation,
      requestOrigin,
    });
    return {
      analysis,
      source: provider.name,
      model: provider.model,
      notice: `Analyzed live with GPT-5.6 through ${provider.label}.`,
    };
  } catch (error) {
    console.error("Live analysis failed; using demo fallback", error);
    return {
      analysis: buildFallbackAnalysis(feature, estimate),
      source: "demo",
      model: null,
      notice: "Live analysis was unavailable, so Gremlin used its reliable demo brain.",
    };
  }
}

async function requestModelAnalysis(
  feature,
  estimate,
  provider,
  { fetchImplementation, requestOrigin },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  const payload = {
    model: provider.model,
    store: false,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: `Feature request: ${feature}\nOriginal estimate: ${estimate} hours\n\nExpose the hidden work and identify the smallest credible MVP.`,
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

  try {
    const apiResponse = await fetchImplementation(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        ...(provider.name === "openrouter" ? {
          "HTTP-Referer": requestOrigin || "https://gremlin.vercel.app",
          "X-OpenRouter-Title": "Gremlin",
        } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!apiResponse.ok) {
      const details = await apiResponse.text();
      throw new Error(`AI provider returned ${apiResponse.status}: ${details.slice(0, 300)}`);
    }

    const result = await apiResponse.json();
    return normalizeAnalysis(JSON.parse(extractResponseText(result)), feature, estimate);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseFeatureRequest(body) {
  let parsed = body;
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString("utf8");
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  if (!parsed || typeof parsed !== "object") parsed = {};

  const feature = typeof parsed.feature === "string"
    ? parsed.feature.trim().slice(0, 120)
    : "";
  const estimate = Number(parsed.estimate);

  if (feature.length < 3) {
    return { error: "Describe the feature in at least three characters." };
  }

  if (!Number.isFinite(estimate) || estimate < 0.5 || estimate > 10000) {
    return { error: "Enter an estimate between 0.5 and 10,000 hours." };
  }

  return { feature, estimate };
}

export function requestOrigin(request, environment = process.env) {
  const forwardedHost = request.headers?.["x-forwarded-host"];
  const host = forwardedHost || request.headers?.host;
  if (host) return `https://${host}`;

  const vercelHost = environment.VERCEL_PROJECT_PRODUCTION_URL || environment.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : null;
}

export function sendJson(response, statusCode, payload) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(statusCode).json(payload);
}
