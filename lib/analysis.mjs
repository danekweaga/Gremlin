const CATEGORIES = [
  "frontend",
  "backend",
  "design",
  "data",
  "security",
  "accessibility",
  "testing",
  "deployment",
  "product",
];

const RISKS = ["low", "medium", "high"];

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "featureSummary",
    "originalEstimateHours",
    "realisticMinimumHours",
    "realisticMaximumHours",
    "complexityScore",
    "scopeMultiplier",
    "assumptions",
    "requiredTasks",
    "laterTasks",
    "dependencies",
    "risks",
    "recommendedMvp",
    "humorousVerdict",
  ],
  properties: {
    featureSummary: { type: "string" },
    originalEstimateHours: { type: "number" },
    realisticMinimumHours: { type: "number" },
    realisticMaximumHours: { type: "number" },
    complexityScore: { type: "integer", minimum: 1, maximum: 10 },
    scopeMultiplier: { type: "number" },
    assumptions: { type: "array", items: { type: "string" } },
    requiredTasks: { type: "array", items: { $ref: "#/$defs/task" } },
    laterTasks: { type: "array", items: { $ref: "#/$defs/task" } },
    dependencies: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    recommendedMvp: { type: "string" },
    humorousVerdict: { type: "string" },
  },
  $defs: {
    task: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "title",
        "category",
        "explanation",
        "estimatedHours",
        "riskLevel",
        "dependencies",
        "requiredForMvp",
      ],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        category: { type: "string", enum: CATEGORIES },
        explanation: { type: "string" },
        estimatedHours: { type: "number", minimum: 0.25 },
        riskLevel: { type: "string", enum: RISKS },
        dependencies: { type: "array", items: { type: "string" } },
        requiredForMvp: { type: "boolean" },
      },
    },
  },
};

const task = (
  id,
  title,
  category,
  explanation,
  estimatedHours,
  riskLevel = "medium",
  requiredForMvp = true,
  dependencies = [],
) => ({
  id,
  title,
  category,
  explanation,
  estimatedHours,
  riskLevel,
  dependencies,
  requiredForMvp,
});

const DARK_MODE_TASKS = [
  task("theme-audit", "Audit every color source", "design", "Find hard-coded colors, visual assets, charts, and states before changing tokens.", 2.5, "medium", true),
  task("theme-tokens", "Build semantic theme tokens", "frontend", "Replace raw colors with background, surface, text, border, and status tokens.", 3.5, "high", true, ["theme-audit"]),
  task("system-preference", "Detect system preference", "frontend", "Respect prefers-color-scheme without flashing the wrong theme during startup.", 2, "medium", true, ["theme-tokens"]),
  task("persist-choice", "Persist the user’s choice", "data", "Store an explicit preference and define how it overrides the operating system.", 1.5, "low", true, ["system-preference"]),
  task("contrast", "Verify accessible contrast", "accessibility", "Test text, focus rings, disabled states, and status colors against WCAG targets.", 3, "high", true, ["theme-tokens"]),
  task("third-party", "Wrangle third-party components", "frontend", "Theme editors, date pickers, charts, maps, and embedded widgets that ignore your tokens.", 3.5, "high", true, ["theme-tokens"]),
  task("visual-assets", "Create dark-safe visual assets", "design", "Adjust logos, shadows, screenshots, empty states, and transparent images.", 2, "medium", false, ["theme-tokens"]),
  task("email-export", "Theme exports and emails", "product", "Decide whether emails, PDFs, screenshots, and shared previews follow the selected theme.", 2, "medium", false),
  task("regression", "Run visual regression testing", "testing", "Check core screens in both themes across common viewport sizes.", 4, "high", true, ["contrast", "third-party"]),
  task("release", "Ship without a flash", "deployment", "Add telemetry, migration handling, and a rollout check for theme initialization.", 1.5, "medium", false, ["system-preference", "regression"]),
];

const LOGIN_TASKS = [
  task("provider", "Configure the identity provider", "backend", "Create credentials, callback URLs, consent settings, and environment separation.", 2, "medium", true),
  task("session", "Design session handling", "security", "Choose cookie settings, expiry, refresh behavior, and server-side validation.", 4, "high", true, ["provider"]),
  task("account-model", "Connect identities to accounts", "data", "Handle first sign-in, returning users, duplicate emails, and provider IDs.", 4, "high", true, ["provider"]),
  task("auth-ui", "Build sign-in and error states", "frontend", "Create loading, cancellation, denied-consent, and retry experiences.", 3, "medium", true, ["provider"]),
  task("route-guards", "Protect private routes", "security", "Re-check authorization on the server instead of trusting navigation state.", 3, "high", true, ["session"]),
  task("logout", "Implement reliable logout", "backend", "Clear application sessions and communicate what remains signed in at the provider.", 1.5, "medium", true, ["session"]),
  task("linking", "Support account linking", "product", "Prevent surprise duplicate accounts when users choose another login method.", 4, "high", false, ["account-model"]),
  task("auth-tests", "Test the unhappy paths", "testing", "Cover expired codes, replay attempts, blocked cookies, and callback errors.", 4, "high", true, ["route-guards"]),
  task("audit", "Add authentication telemetry", "deployment", "Record safe, privacy-conscious success and failure events for launch.", 2, "medium", false, ["auth-tests"]),
];

const NOTIFICATION_TASKS = [
  task("events", "Define notification events", "product", "Decide exactly what triggers a notification and which events should be grouped.", 2, "medium", true),
  task("preferences", "Build preference controls", "frontend", "Give users understandable channel, frequency, and quiet-hour settings.", 3.5, "medium", true, ["events"]),
  task("subscription", "Store delivery preferences", "data", "Model per-user subscriptions, defaults, and unsubscribe history.", 3, "high", true, ["events"]),
  task("delivery", "Create a delivery pipeline", "backend", "Queue work, retry transient failures, and avoid duplicate sends.", 5, "high", true, ["subscription"]),
  task("templates", "Design message templates", "design", "Create concise copy for each channel, state, and locale.", 3, "medium", true, ["events"]),
  task("permissions", "Handle browser permissions", "frontend", "Request permission at the right moment and recover gracefully when denied.", 2.5, "high", false, ["preferences"]),
  task("unsubscribe", "Make opt-out trustworthy", "security", "Provide immediate unsubscribe behavior and enforce it in every sender.", 2.5, "high", true, ["delivery"]),
  task("delivery-tests", "Test retries and deduplication", "testing", "Prove that timeouts and worker restarts do not spam users.", 4, "high", true, ["delivery"]),
  task("analytics", "Measure useful delivery", "deployment", "Track sent, failed, opened, and muted events without leaking content.", 2, "medium", false, ["delivery"]),
];

const COMMENT_TASKS = [
  task("comment-model", "Model comments and threads", "data", "Define authorship, timestamps, edit history, replies, and deletion semantics.", 3, "medium", true),
  task("composer", "Build the comment composer", "frontend", "Handle validation, submission state, errors, and keyboard-friendly controls.", 3, "medium", true),
  task("rendering", "Render safe comment content", "security", "Escape untrusted input and define whether links or formatting are allowed.", 2.5, "high", true, ["composer"]),
  task("permissions", "Define comment permissions", "backend", "Decide who can post, edit, delete, resolve, and moderate comments.", 3.5, "high", true, ["comment-model"]),
  task("pagination", "Load long discussions", "frontend", "Paginate threads while keeping reply context and scroll position understandable.", 2.5, "medium", false, ["comment-model"]),
  task("moderation", "Add abuse controls", "security", "Create reporting, rate limits, blocked words, and moderator actions.", 4, "high", true, ["permissions"]),
  task("notifications", "Notify participants", "backend", "Avoid notification loops and respect mention and subscription preferences.", 3, "medium", false, ["comment-model"]),
  task("a11y", "Make threads navigable", "accessibility", "Use meaningful landmarks, focus behavior, and screen-reader announcements.", 2.5, "medium", true, ["composer"]),
  task("comment-tests", "Test concurrent edits", "testing", "Cover deletion, stale edits, permissions, and two people replying at once.", 4, "high", true, ["permissions", "rendering"]),
];

const GENERIC_TASKS = [
  task("success", "Define the success condition", "product", "Turn the request into a measurable outcome before implementation begins.", 1.5, "medium", true),
  task("states", "Design every interface state", "design", "Cover empty, loading, success, partial, failure, and recovery states.", 3, "medium", true, ["success"]),
  task("client", "Build the user-facing workflow", "frontend", "Implement the core interaction with validation and responsive behavior.", 5, "medium", true, ["states"]),
  task("contract", "Define the data contract", "data", "Specify inputs, outputs, ownership, and migration behavior.", 3, "high", true, ["success"]),
  task("service", "Implement server behavior", "backend", "Create the business logic, failure handling, and observability hooks.", 5, "high", true, ["contract"]),
  task("permissions", "Check access boundaries", "security", "Validate data and permissions at the point where the action happens.", 2.5, "high", true, ["service"]),
  task("a11y", "Make the workflow accessible", "accessibility", "Support keyboard use, focus management, labels, and readable contrast.", 2.5, "medium", true, ["client"]),
  task("quality", "Test the failure modes", "testing", "Cover validation, concurrency, timeouts, and recovery paths.", 4, "high", true, ["client", "service"]),
  task("telemetry", "Add launch telemetry", "deployment", "Capture success, latency, and failure signals for a safe rollout.", 2, "low", false, ["quality"]),
  task("polish", "Polish the second-use experience", "design", "Improve shortcuts, remembered choices, and small moments after validation.", 2, "low", false, ["client"]),
];

function pickTemplate(feature) {
  const normalized = feature.toLowerCase();
  if (normalized.includes("dark") || normalized.includes("theme")) return DARK_MODE_TASKS;
  if (normalized.includes("login") || normalized.includes("sign in") || normalized.includes("auth")) return LOGIN_TASKS;
  if (normalized.includes("notif") || normalized.includes("alert")) return NOTIFICATION_TASKS;
  if (normalized.includes("comment") || normalized.includes("reply")) return COMMENT_TASKS;
  return GENERIC_TASKS;
}

function cloneTask(item) {
  return { ...item, dependencies: [...item.dependencies] };
}

export function buildFallbackAnalysis(feature = "Add dark mode", estimate = 2) {
  const safeFeature = String(feature || "Add dark mode").trim().slice(0, 120);
  const originalEstimateHours = Math.max(0.5, Number(estimate) || 2);
  const allTasks = pickTemplate(safeFeature).map(cloneTask);
  const requiredTasks = allTasks.filter((item) => item.requiredForMvp);
  const laterTasks = allTasks.filter((item) => !item.requiredForMvp);
  const total = allTasks.reduce((sum, item) => sum + item.estimatedHours, 0);
  const minimum = Math.max(originalEstimateHours, Math.round(total * 0.84));
  const maximum = Math.max(minimum + 1, Math.round(total * 1.18));
  const scopeMultiplier = Number((minimum / originalEstimateHours).toFixed(1));
  const complexityScore = Math.min(10, Math.max(3, Math.round(allTasks.length * 0.62 + scopeMultiplier * 0.32)));
  const title = safeFeature.replace(/[.!?]+$/, "");

  return {
    featureSummary: title,
    originalEstimateHours,
    realisticMinimumHours: minimum,
    realisticMaximumHours: maximum,
    complexityScore,
    scopeMultiplier,
    assumptions: [
      "The feature must work on both desktop and mobile.",
      "Existing users and data cannot be disrupted.",
      "The result needs an accessible failure path, not only a happy path.",
    ],
    requiredTasks,
    laterTasks,
    dependencies: [
      "Design decisions must stabilize before final implementation.",
      "Core data and permission rules must exist before end-to-end testing.",
      "Testing depends on a complete, integrated happy path.",
    ],
    risks: [
      "The original estimate assumes implementation but omits validation and rollout.",
      "Third-party behavior and existing architecture may add integration time.",
      "Unclear edge cases can turn late in the build into scope multipliers.",
    ],
    recommendedMvp: `Ship the smallest reliable version of “${title}” with its core workflow, essential permissions, accessible states, and one tested release path.`,
    humorousVerdict: `You estimated ${formatHours(originalEstimateHours)}. Gremlin found ${minimum}–${maximum} hours and several tasks living behind the drywall.`,
  };
}

function formatHours(value) {
  return `${Number(value).toFixed(value % 1 ? 1 : 0)} ${value === 1 ? "hour" : "hours"}`;
}

function cleanString(value, fallback, max = 400) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function cleanNumber(value, fallback, min = 0, max = 10000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeTask(value, index, defaultRequired) {
  if (!value || typeof value !== "object") return null;
  const title = cleanString(value.title, "Hidden implementation task", 120);
  const idSource = cleanString(value.id, `task-${index + 1}`, 80);
  return {
    id: idSource.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || `task-${index + 1}`,
    title,
    category: CATEGORIES.includes(value.category) ? value.category : "product",
    explanation: cleanString(value.explanation, "This work is required to make the feature reliable.", 320),
    estimatedHours: cleanNumber(value.estimatedHours, 1, 0.25, 200),
    riskLevel: RISKS.includes(value.riskLevel) ? value.riskLevel : "medium",
    dependencies: Array.isArray(value.dependencies)
      ? value.dependencies.filter((item) => typeof item === "string").slice(0, 8)
      : [],
    requiredForMvp: typeof value.requiredForMvp === "boolean" ? value.requiredForMvp : defaultRequired,
  };
}

export function normalizeAnalysis(raw, feature, estimate) {
  if (!raw || typeof raw !== "object") throw new Error("Analysis is not an object");
  const fallback = buildFallbackAnalysis(feature, estimate);
  const requiredTasks = Array.isArray(raw.requiredTasks)
    ? raw.requiredTasks.map((item, index) => normalizeTask(item, index, true)).filter(Boolean)
    : [];
  const laterTasks = Array.isArray(raw.laterTasks)
    ? raw.laterTasks.map((item, index) => normalizeTask(item, requiredTasks.length + index, false)).filter(Boolean)
    : [];

  if (!requiredTasks.length) throw new Error("Analysis did not return required tasks");

  const originalEstimateHours = cleanNumber(raw.originalEstimateHours, fallback.originalEstimateHours, 0.5, 10000);
  const realisticMinimumHours = cleanNumber(raw.realisticMinimumHours, fallback.realisticMinimumHours, originalEstimateHours, 10000);
  const realisticMaximumHours = cleanNumber(raw.realisticMaximumHours, fallback.realisticMaximumHours, realisticMinimumHours, 10000);

  return {
    featureSummary: cleanString(raw.featureSummary, fallback.featureSummary, 160),
    originalEstimateHours,
    realisticMinimumHours,
    realisticMaximumHours,
    complexityScore: Math.round(cleanNumber(raw.complexityScore, fallback.complexityScore, 1, 10)),
    scopeMultiplier: cleanNumber(raw.scopeMultiplier, realisticMinimumHours / originalEstimateHours, 1, 1000),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map((item) => cleanString(item, "")).filter(Boolean).slice(0, 10) : fallback.assumptions,
    requiredTasks,
    laterTasks,
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map((item) => cleanString(item, "")).filter(Boolean).slice(0, 10) : fallback.dependencies,
    risks: Array.isArray(raw.risks) ? raw.risks.map((item) => cleanString(item, "")).filter(Boolean).slice(0, 10) : fallback.risks,
    recommendedMvp: cleanString(raw.recommendedMvp, fallback.recommendedMvp, 600),
    humorousVerdict: cleanString(raw.humorousVerdict, fallback.humorousVerdict, 400),
  };
}

export function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("The model returned no structured text output");
}
