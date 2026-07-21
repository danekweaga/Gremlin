import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANALYSIS_SCHEMA,
  buildFallbackAnalysis,
  extractResponseText,
  normalizeAnalysis,
} from "./lib/analysis.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(root, "public");

await loadDotEnv(join(root, ".env"));

const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

    if (url.pathname === "/api/health") {
      const provider = getProviderConfig();
      return sendJson(response, 200, {
        ok: true,
        provider: provider?.name || "demo",
        model: provider?.model || null,
        aiConfigured: Boolean(provider),
      });
    }

    if (url.pathname === "/api/analyze" && request.method === "POST") {
      return await handleAnalysis(request, response);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Method not allowed" });
    }

    return await serveStatic(url.pathname, request.method === "HEAD", response);
  } catch (error) {
    console.error("Request failed", error);
    return sendJson(response, 500, { error: "The gremlin escaped the server. Try again." });
  }
});

server.listen(port, host, () => {
  console.log(`Gremlin is awake at http://${host}:${port}`);
  console.log(getProviderConfig() ? "Live GPT-5.6 analysis is enabled." : "No API key found; polished demo analysis is enabled.");
});

async function handleAnalysis(request, response) {
  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch {
    return sendJson(response, 400, { error: "Send a valid feature request and estimate." });
  }

  const feature = typeof body.feature === "string" ? body.feature.trim().slice(0, 120) : "";
  const estimate = Number(body.estimate);

  if (feature.length < 3) {
    return sendJson(response, 400, { error: "Describe the feature in at least three characters." });
  }

  if (!Number.isFinite(estimate) || estimate < 0.5 || estimate > 10000) {
    return sendJson(response, 400, { error: "Enter an estimate between 0.5 and 10,000 hours." });
  }

  const provider = getProviderConfig();
  if (!provider) {
    return sendJson(response, 200, {
      analysis: buildFallbackAnalysis(feature, estimate),
      source: "demo",
      model: null,
      notice: "Demo analysis — add OPENAI_API_KEY to enable live GPT-5.6 scoping.",
    });
  }

  try {
    const analysis = await requestModelAnalysis(feature, estimate, provider);
    return sendJson(response, 200, {
      analysis,
      source: provider.name,
      model: provider.model,
      notice: `Analyzed live with GPT-5.6 through ${provider.label}.`,
    });
  } catch (error) {
    console.error("OpenAI analysis failed; using demo fallback", error);
    return sendJson(response, 200, {
      analysis: buildFallbackAnalysis(feature, estimate),
      source: "demo",
      model: null,
      notice: "Live analysis was unavailable, so Gremlin used its reliable demo brain.",
    });
  }
}

async function requestModelAnalysis(feature, estimate, provider) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

  const systemPrompt = `You are Gremlin, a sharp senior product engineer who reveals hidden implementation work.

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

  const payload = {
    model: provider.model,
    store: false,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Feature request: ${feature}\nOriginal estimate: ${estimate} hours\n\nExpose the hidden work and identify the smallest credible MVP.`,
          },
        ],
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
    const apiResponse = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        ...(provider.name === "openrouter" ? {
          "HTTP-Referer": `http://${host}:${port}`,
          "X-OpenRouter-Title": "Gremlin",
        } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!apiResponse.ok) {
      const details = await apiResponse.text();
      throw new Error(`OpenAI returned ${apiResponse.status}: ${details.slice(0, 300)}`);
    }

    const result = await apiResponse.json();
    const text = extractResponseText(result);
    return normalizeAnalysis(JSON.parse(text), feature, estimate);
  } finally {
    clearTimeout(timeout);
  }
}

function getProviderConfig() {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: "openrouter",
      label: "OpenRouter",
      endpoint: "https://openrouter.ai/api/v1/responses",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openai/gpt-5.6-terra-pro",
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      name: "openai",
      label: "OpenAI",
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-5.6",
    };
  }

  return null;
}

async function serveStatic(pathname, headOnly, response) {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const clean = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(publicRoot, clean);

  if (!filePath.startsWith(publicRoot)) {
    return sendJson(response, 403, { error: "Forbidden" });
  }

  try {
    const details = await stat(filePath);
    if (details.isDirectory()) filePath = join(filePath, "index.html");
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    return response.end(headOnly ? undefined : content);
  } catch {
    if (!extname(pathname)) {
      const content = await readFile(join(publicRoot, "index.html"));
      response.writeHead(200, { "Content-Type": MIME_TYPES[".html"], "Cache-Control": "no-cache" });
      return response.end(headOnly ? undefined : content);
    }
    return sendJson(response, 404, { error: "Not found" });
  }
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100_000) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function loadDotEnv(path) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    return;
  }

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
