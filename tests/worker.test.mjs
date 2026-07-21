import test from "node:test";
import assert from "node:assert/strict";

test("deployment worker serves fallback analysis without an API key", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const response = await worker.fetch(
    new Request("https://gremlin.test/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: "Add dark mode", estimate: 2 }),
    }),
    { ASSETS: { fetch: async () => new Response("asset") } },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, "demo");
  assert.ok(payload.analysis.requiredTasks.length >= 6);
});

test("deployment worker delegates static files to the asset binding", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  let requestedPath = null;
  const response = await worker.fetch(
    new Request("https://gremlin.test/"),
    {
      ASSETS: {
        fetch: async (request) => {
          requestedPath = new URL(request.url).pathname;
          return new Response("<h1>Gremlin</h1>", { headers: { "Content-Type": "text/html" } });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(requestedPath, "/index.html");
});
