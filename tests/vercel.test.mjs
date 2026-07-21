import test from "node:test";
import assert from "node:assert/strict";
import analyzeHandler from "../api/analyze.js";
import healthHandler from "../api/health.js";

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function withoutProvider(callback) {
  const previousOpenRouter = process.env.OPENROUTER_API_KEY;
  const previousOpenAi = process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await callback();
  } finally {
    if (previousOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousOpenRouter;
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;
  }
}

test("Vercel health function reports demo mode without secrets", async () => {
  await withoutProvider(async () => {
    const response = createResponse();
    healthHandler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.aiConfigured, false);
    assert.equal(response.headers["cache-control"], "no-store");
  });
});

test("Vercel analysis function preserves the complete product loop in demo mode", async () => {
  await withoutProvider(async () => {
    const response = createResponse();
    await analyzeHandler({
      method: "POST",
      headers: { host: "gremlin.example" },
      body: { feature: "Add team invitations", estimate: 2 },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.source, "demo");
    assert.ok(response.payload.analysis.requiredTasks.length >= 6);
  });
});

test("Vercel analysis function validates requests", async () => {
  const response = createResponse();
  await analyzeHandler({ method: "POST", headers: {}, body: { feature: "x", estimate: 0 } }, response);
  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /three characters/i);
});
