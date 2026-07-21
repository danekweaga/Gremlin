import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildFallbackAnalysis,
  extractResponseText,
  normalizeAnalysis,
} from "../lib/analysis.mjs";

test("dark mode fallback exposes concrete hidden work", () => {
  const analysis = buildFallbackAnalysis("Add dark mode", 2);
  const titles = [...analysis.requiredTasks, ...analysis.laterTasks].map((task) => task.title);

  assert.ok(titles.includes("Build semantic theme tokens"));
  assert.ok(titles.includes("Verify accessible contrast"));
  assert.ok(analysis.realisticMinimumHours > analysis.originalEstimateHours);
  assert.ok(analysis.scopeMultiplier > 1);
  assert.ok(analysis.requiredTasks.every((task) => task.requiredForMvp));
  assert.ok(analysis.laterTasks.every((task) => !task.requiredForMvp));
});

test("fallback chooses a feature-specific template", () => {
  const login = buildFallbackAnalysis("Add Google login", 3);
  const notifications = buildFallbackAnalysis("Add notifications", 3);

  assert.match(login.requiredTasks.map((task) => task.title).join(" "), /session handling/i);
  assert.match(notifications.requiredTasks.map((task) => task.title).join(" "), /delivery pipeline/i);
});

test("normalization rejects analysis without required work", () => {
  assert.throws(
    () => normalizeAnalysis({ requiredTasks: [], laterTasks: [] }, "Add dark mode", 2),
    /required tasks/i,
  );
});

test("normalization constrains model-provided task values", () => {
  const raw = {
    featureSummary: "A feature",
    originalEstimateHours: 2,
    realisticMinimumHours: 8,
    realisticMaximumHours: 12,
    complexityScore: 99,
    scopeMultiplier: 4,
    assumptions: ["Assumption"],
    requiredTasks: [{
      id: "Unsafe ID!",
      title: "Build it",
      category: "unknown",
      explanation: "A concrete task.",
      estimatedHours: -4,
      riskLevel: "extreme",
      dependencies: [],
      requiredForMvp: true,
    }],
    laterTasks: [],
    dependencies: [],
    risks: [],
    recommendedMvp: "Ship the core.",
    humorousVerdict: "It grew teeth.",
  };

  const analysis = normalizeAnalysis(raw, "A feature", 2);
  assert.equal(analysis.complexityScore, 10);
  assert.equal(analysis.requiredTasks[0].category, "product");
  assert.equal(analysis.requiredTasks[0].riskLevel, "medium");
  assert.equal(analysis.requiredTasks[0].estimatedHours, 0.25);
  assert.equal(analysis.requiredTasks[0].id, "unsafe-id");
});

test("response text extraction supports raw Responses API message output", () => {
  const text = extractResponseText({
    output: [{
      type: "message",
      content: [{ type: "output_text", text: "{\"ok\":true}" }],
    }],
  });
  assert.equal(text, "{\"ok\":true}");
});

test("the shipped interface contains the full product loop", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /REVEAL THE GREMLIN/);
  assert.match(html, /CUT TO MVP/);
  assert.match(html, /GREMLIN[\s\S]*DEFEATED/);
  assert.match(html, /SAVE FOR LATER/);
});
