const STORAGE_KEY = "gremlin-scope-state-v1";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  landing: document.querySelector("#landing-view"),
  workspace: document.querySelector("#workspace-view"),
  form: document.querySelector("#scope-form"),
  featureInput: document.querySelector("#feature-input"),
  estimateInput: document.querySelector("#estimate-input"),
  featureError: document.querySelector("#feature-error"),
  estimateError: document.querySelector("#estimate-error"),
  overlay: document.querySelector("#reveal-overlay"),
  revealTitle: document.querySelector("#reveal-title"),
  scanPercent: document.querySelector("#scan-percent"),
  scanProgress: document.querySelector("#scan-progress"),
  consoleLog: document.querySelector("#console-log"),
  featureTitle: document.querySelector("#feature-title"),
  source: document.querySelector("#analysis-source"),
  gremlinHost: document.querySelector("#gremlin-host"),
  gremlinArena: document.querySelector("#gremlin-arena"),
  previewCreature: document.querySelector("#preview-creature"),
  victory: document.querySelector("#victory-state"),
  threat: document.querySelector("#threat-badge"),
  mutationLabel: document.querySelector("#mutation-label"),
  remainingLabel: document.querySelector("#remaining-label"),
  progressPercent: document.querySelector("#progress-percent"),
  progressTrack: document.querySelector("#progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  progressCopy: document.querySelector("#progress-copy"),
  originalEstimate: document.querySelector("#original-estimate"),
  realisticEstimate: document.querySelector("#realistic-estimate"),
  scopeGrowth: document.querySelector("#scope-growth"),
  complexity: document.querySelector("#complexity-score"),
  hiddenCount: document.querySelector("#hidden-count"),
  verdict: document.querySelector("#verdict"),
  mvp: document.querySelector("#mvp-recommendation"),
  remainingHours: document.querySelector("#remaining-hours"),
  buildList: document.querySelector("#build-list"),
  completedList: document.querySelector("#completed-list"),
  laterList: document.querySelector("#later-list"),
  buildCount: document.querySelector("#build-count"),
  completedCount: document.querySelector("#completed-count"),
  laterCount: document.querySelector("#later-count"),
  assumptions: document.querySelector("#assumption-list"),
  dependencies: document.querySelector("#dependency-list"),
  risks: document.querySelector("#risk-list"),
  shareDialog: document.querySelector("#share-dialog"),
  shareCanvas: document.querySelector("#share-canvas"),
  shareTitle: document.querySelector("#share-title"),
  shareCopy: document.querySelector("#share-copy"),
  toastRegion: document.querySelector("#toast-region"),
  loopSteps: [...document.querySelectorAll(".loop-steps li")],
};

let state = readSavedState();
let mutationTimer = null;

renderPreviewCreature();

if (state) {
  showWorkspace(false);
  renderWorkspace();
}

elements.form.addEventListener("submit", handleSubmit);

document.addEventListener("click", (event) => {
  const example = event.target.closest("[data-example]");
  if (example) {
    elements.featureInput.value = example.dataset.example;
    elements.estimateInput.value = example.dataset.estimate;
    elements.featureInput.focus();
    clearErrors();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, taskId } = actionButton.dataset;

  if (action === "home") showLanding();
  if (action === "new-feature") startNewFeature();
  if (action === "cut-mvp") cutToMvp();
  if (action === "share") openShareDialog();
  if (action === "download-card") downloadShareCard();
  if (action === "copy-result") copyShareText();
  if (action === "task-start") updateTask(taskId, "in-progress");
  if (action === "task-todo") updateTask(taskId, "todo");
  if (action === "task-complete") updateTask(taskId, "completed");
  if (action === "task-later") updateTask(taskId, "later");
  if (action === "task-restore") updateTask(taskId, "todo");
});

async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();

  const feature = elements.featureInput.value.trim();
  const estimate = Number(elements.estimateInput.value);
  let valid = true;

  if (feature.length < 3) {
    elements.featureError.textContent = "Give the gremlin at least three characters to chew on.";
    valid = false;
  }

  if (!Number.isFinite(estimate) || estimate < 0.5 || estimate > 10000) {
    elements.estimateError.textContent = "Enter an estimate between 0.5 and 10,000 hours.";
    valid = false;
  }

  if (!valid) return;

  openRevealOverlay();
  const scanPromise = playScanSequence(feature);
  const analysisPromise = requestAnalysis(feature, estimate);

  try {
    const [result] = await Promise.all([analysisPromise, scanPromise]);
    const analysis = result.analysis;
    const required = (analysis.requiredTasks || []).map((task) => ({ ...task, status: "todo", suggestedLater: false }));
    const optional = (analysis.laterTasks || []).map((task) => ({
      ...task,
      requiredForMvp: false,
      status: "todo",
      suggestedLater: true,
    }));

    state = {
      analysis,
      tasks: ensureUniqueIds([...required, ...optional]),
      source: result.source || "demo",
      notice: result.notice || "Analysis complete.",
      createdAt: new Date().toISOString(),
    };

    saveState();
    finishScan();
    await wait(REDUCED_MOTION.matches ? 20 : 420);
    closeRevealOverlay();
    showWorkspace(true);
    renderWorkspace(true);
    toast(state.notice);
  } catch (error) {
    console.error(error);
    closeRevealOverlay();
    toast("Gremlin could not analyze that request. Please try again.");
  }
}

async function requestAnalysis(feature, estimate) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, estimate }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Analysis request failed");
    }

    const result = await response.json();
    if (!result.analysis?.requiredTasks?.length) throw new Error("Incomplete analysis");
    return result;
  } catch (error) {
    console.warn("Using browser demo analysis", error);
    return {
      analysis: makeClientFallback(feature, estimate),
      source: "demo",
      notice: "Demo analysis — connect the server and API key for live GPT-5.6 scoping.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function makeClientFallback(feature, estimate) {
  const safeFeature = feature.replace(/[.!?]+$/, "");
  const tasks = [
    clientTask("define-success", "Define the success condition", "product", 1.5, "medium", true, "Turn the request into a measurable outcome before implementation begins."),
    clientTask("interface-states", "Design every interface state", "design", 3, "medium", true, "Cover empty, loading, success, failure, and recovery states."),
    clientTask("core-workflow", "Build the core workflow", "frontend", 5, "medium", true, "Implement the primary interaction with validation and responsive behavior."),
    clientTask("data-contract", "Define the data contract", "data", 3, "high", true, "Specify inputs, outputs, ownership, and migration behavior."),
    clientTask("server-logic", "Implement server behavior", "backend", 5, "high", true, "Create business logic, failure handling, and observable outcomes."),
    clientTask("access-boundaries", "Check access boundaries", "security", 2.5, "high", true, "Validate untrusted data and permissions where the action occurs."),
    clientTask("accessible-path", "Make it keyboard-accessible", "accessibility", 2.5, "medium", true, "Add focus behavior, labels, readable contrast, and announcements."),
    clientTask("failure-tests", "Test the failure modes", "testing", 4, "high", true, "Cover validation, timeouts, concurrency, and recovery paths."),
    clientTask("launch-telemetry", "Add launch telemetry", "deployment", 2, "low", false, "Measure success, latency, and failures during rollout."),
    clientTask("second-use-polish", "Polish the second use", "design", 2, "low", false, "Improve shortcuts, remembered choices, and return visits."),
  ];
  const requiredTasks = tasks.filter((task) => task.requiredForMvp);
  const laterTasks = tasks.filter((task) => !task.requiredForMvp);
  const total = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const minimum = Math.max(Math.ceil(total * 0.82), estimate);
  const maximum = Math.ceil(total * 1.2);

  return {
    featureSummary: safeFeature,
    originalEstimateHours: estimate,
    realisticMinimumHours: minimum,
    realisticMaximumHours: maximum,
    complexityScore: Math.min(10, Math.max(4, Math.round(tasks.length * 0.72))),
    scopeMultiplier: Number((minimum / estimate).toFixed(1)),
    assumptions: [
      "The feature must work on mobile and desktop.",
      "Existing users and data cannot be disrupted.",
      "The failure path needs to be as intentional as the happy path.",
    ],
    requiredTasks,
    laterTasks,
    dependencies: [
      "Design decisions must stabilize before final implementation.",
      "Data and permission rules must exist before integrated testing.",
      "Testing depends on a complete end-to-end path.",
    ],
    risks: [
      "The original estimate omits validation, accessibility, and rollout.",
      "Existing architecture may add integration time.",
      "Late edge cases can multiply the scope.",
    ],
    recommendedMvp: `Ship the smallest reliable version of “${safeFeature}” with the core workflow, essential permissions, accessible states, and one tested release path.`,
    humorousVerdict: `You estimated ${formatHours(estimate)}. Gremlin found ${minimum}–${maximum} hours and a suspicious amount of work behind the wall.`,
  };
}

function clientTask(id, title, category, estimatedHours, riskLevel, requiredForMvp, explanation) {
  return { id, title, category, explanation, estimatedHours, riskLevel, requiredForMvp, dependencies: [] };
}

function ensureUniqueIds(tasks) {
  const used = new Set();
  return tasks.map((task, index) => {
    let id = String(task.id || `task-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-");
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return { ...task, id };
  });
}

function openRevealOverlay() {
  elements.overlay.classList.remove("is-hidden");
  elements.overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  elements.scanProgress.style.width = "0%";
  elements.scanPercent.textContent = "00%";
  elements.consoleLog.textContent = "";
}

function closeRevealOverlay() {
  elements.overlay.classList.add("is-hidden");
  elements.overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function playScanSequence(feature) {
  const messages = [
    [12, "Checking your assumptions…", `> request acquired: ${feature}`],
    [31, "Looking underneath the frontend…", "> interface states are multiplying"],
    [53, "Something moved in the backend…", "> dependencies detected behind the happy path"],
    [74, "Testing the estimate’s structural integrity…", "> original estimate is making a concerning noise"],
    [91, "Your feature has started growing teeth…", "> containment unit ready"],
  ];

  for (const [percent, title, log] of messages) {
    elements.scanPercent.textContent = `${String(percent).padStart(2, "0")}%`;
    elements.scanProgress.style.width = `${percent}%`;
    elements.revealTitle.textContent = title;
    elements.consoleLog.textContent = log;
    await wait(REDUCED_MOTION.matches ? 30 : 470);
  }
}

function finishScan() {
  elements.scanPercent.textContent = "100%";
  elements.scanProgress.style.width = "100%";
  elements.revealTitle.textContent = "Gremlin detected.";
  elements.consoleLog.textContent = "> specimen contained / scope exposed";
}

function showWorkspace(shouldScroll = true) {
  elements.landing.classList.add("is-hidden");
  elements.workspace.classList.remove("is-hidden");
  if (shouldScroll) window.scrollTo({ top: 0, behavior: REDUCED_MOTION.matches ? "auto" : "smooth" });
}

function showLanding() {
  elements.workspace.classList.add("is-hidden");
  elements.landing.classList.remove("is-hidden");
  if (state?.analysis) {
    elements.featureInput.value = state.analysis.featureSummary;
    elements.estimateInput.value = state.analysis.originalEstimateHours;
  }
  window.scrollTo({ top: 0, behavior: REDUCED_MOTION.matches ? "auto" : "smooth" });
}

function startNewFeature() {
  state = null;
  localStorage.removeItem(STORAGE_KEY);
  elements.featureInput.value = "";
  elements.estimateInput.value = "2";
  clearErrors();
  showLanding();
  window.setTimeout(() => elements.featureInput.focus(), 100);
}

function renderWorkspace(animate = false) {
  if (!state) return;
  const { analysis, tasks } = state;
  const buildTasks = tasks.filter((task) => task.status === "todo" || task.status === "in-progress");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const laterTasks = tasks.filter((task) => task.status === "later");
  const activeTasks = tasks.filter((task) => task.status !== "later");
  const totalActiveHours = sumHours(activeTasks);
  const completedHours = sumHours(completedTasks);
  const remainingHours = sumHours(buildTasks);
  const progress = totalActiveHours > 0 ? Math.round((completedHours / totalActiveHours) * 100) : 0;
  const isVictory = buildTasks.length === 0 && completedTasks.length > 0;

  const featureSummary = String(analysis.featureSummary || "Untitled feature").trim();
  elements.featureTitle.textContent = featureSummary;
  elements.featureTitle.classList.toggle("is-long", featureSummary.length > 24);
  elements.featureTitle.classList.toggle("is-very-long", featureSummary.length > 38);
  const isLive = state.source === "openai" || state.source === "openrouter";
  elements.source.textContent = state.source === "openrouter"
    ? "LIVE / OPENROUTER"
    : state.source === "openai"
      ? "LIVE / GPT-5.6"
      : "DEMO BRAIN";
  elements.source.classList.toggle("live", isLive);
  elements.originalEstimate.textContent = compactHours(analysis.originalEstimateHours);
  elements.realisticEstimate.textContent = `${compactNumber(analysis.realisticMinimumHours)}–${compactNumber(analysis.realisticMaximumHours)}H`;
  elements.scopeGrowth.textContent = `${Number(analysis.scopeMultiplier).toFixed(1)}× SCOPE GROWTH`;
  elements.complexity.textContent = `${String(analysis.complexityScore).padStart(2, "0")}/10`;
  elements.hiddenCount.textContent = String(tasks.length).padStart(2, "0");
  elements.verdict.textContent = `“${analysis.humorousVerdict}”`;
  elements.mvp.textContent = analysis.recommendedMvp;
  elements.remainingHours.textContent = compactHours(remainingHours);
  elements.remainingLabel.textContent = `${compactHours(remainingHours)} REMAINING`;
  elements.progressPercent.textContent = `${progress}%`;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(progress));
  elements.progressCopy.textContent = isVictory
    ? `All ${completedTasks.length} active tasks complete. The gremlin is gone.`
    : progress > 0
      ? `${completedTasks.length} task${completedTasks.length === 1 ? "" : "s"} complete. Keep removing mutations.`
      : "Complete tasks to weaken the gremlin.";

  elements.threat.textContent = isVictory ? "THREAT 00" : `THREAT ${String(currentThreat(buildTasks, analysis.complexityScore)).padStart(2, "0")}`;
  elements.mutationLabel.textContent = isVictory ? "NO MUTATIONS DETECTED" : `${mutationCount(buildTasks)} MUTATIONS DETECTED`;

  renderCreature(elements.gremlinHost, buildTasks, analysis, { isVictory, animate });
  elements.victory.classList.toggle("is-hidden", !isVictory);
  elements.gremlinHost.classList.toggle("is-hidden", isVictory);
  elements.gremlinArena.classList.toggle("is-victory", isVictory);

  renderTaskList(elements.buildList, buildTasks, "No active work. The containment unit is quiet.");
  renderTaskList(elements.completedList, completedTasks, "Completed tasks will weaken the gremlin.");
  renderTaskList(elements.laterList, laterTasks, "Cut optional work to make the gremlin smaller.");
  elements.buildCount.textContent = taskCountLabel(buildTasks.length);
  elements.completedCount.textContent = taskCountLabel(completedTasks.length);
  elements.laterCount.textContent = taskCountLabel(laterTasks.length);

  renderIntelList(elements.assumptions, analysis.assumptions);
  renderIntelList(elements.dependencies, analysis.dependencies);
  renderIntelList(elements.risks, analysis.risks);
  renderLoop(progress, laterTasks.length, isVictory);
}

function renderTaskList(container, tasks, emptyCopy) {
  container.replaceChildren();
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-column";
    empty.textContent = emptyCopy;
    container.append(empty);
    return;
  }

  tasks.forEach((task) => container.append(createTaskCard(task)));
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.dataset.status = task.status;

  const top = document.createElement("div");
  top.className = "task-topline";
  const badges = document.createElement("div");
  badges.className = "task-badges";
  const category = document.createElement("span");
  category.className = "category-badge";
  category.textContent = task.category;
  const risk = document.createElement("span");
  risk.className = `risk-badge ${task.riskLevel}`;
  risk.textContent = `${task.riskLevel} risk`;
  badges.append(category, risk);
  if (task.suggestedLater && task.status !== "later") {
    const optional = document.createElement("span");
    optional.className = "category-badge";
    optional.textContent = "MVP optional";
    badges.append(optional);
  }
  const hours = document.createElement("span");
  hours.className = "task-hours";
  hours.textContent = compactHours(task.estimatedHours);
  top.append(badges, hours);

  const title = document.createElement("h4");
  title.textContent = task.title;
  const explanation = document.createElement("p");
  explanation.textContent = task.explanation;
  const actions = document.createElement("div");
  actions.className = "task-actions";

  if (task.status === "todo") {
    actions.append(taskButton("task-start", task.id, "Start"));
    if (!task.requiredForMvp) actions.append(taskButton("task-later", task.id, "Later"));
    actions.append(taskButton("task-complete", task.id, "Complete", "done"));
  } else if (task.status === "in-progress") {
    actions.append(taskButton("task-todo", task.id, "Pause"));
    if (!task.requiredForMvp) actions.append(taskButton("task-later", task.id, "Later"));
    actions.append(taskButton("task-complete", task.id, "Complete", "done"));
  } else if (task.status === "completed") {
    actions.append(taskButton("task-restore", task.id, "Reopen", "undo"));
  } else {
    actions.append(taskButton("task-restore", task.id, "Return to build"));
  }

  card.append(top, title, explanation, actions);
  return card;
}

function taskButton(action, taskId, label, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `task-action ${className}`.trim();
  button.dataset.action = action;
  button.dataset.taskId = taskId;
  button.textContent = label;
  return button;
}

function renderIntelList(container, items) {
  container.replaceChildren();
  (items || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.append(li);
  });
}

function updateTask(taskId, status) {
  if (!state) return;
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status === status) return;
  const oldStatus = task.status;
  task.status = status;
  saveState();
  renderWorkspace(true);

  if (status === "completed") toast(`Mutation removed: ${task.title}`);
  if (status === "later") toast(`Scope reduced by ${compactHours(task.estimatedHours)}.`);
  if (oldStatus === "completed" && status !== "completed") toast("The gremlin noticed that task reopening.");
}

function cutToMvp() {
  if (!state) return;
  const candidates = state.tasks.filter((task) => !task.requiredForMvp && task.status !== "completed" && task.status !== "later");
  if (!candidates.length) {
    toast("This is already the smallest credible MVP.");
    return;
  }

  const removedHours = sumHours(candidates);
  candidates.forEach((task) => { task.status = "later"; });
  saveState();
  renderWorkspace(true);
  toast(`MVP cut complete. ${compactHours(removedHours)} moved out of the containment unit.`);
}

function renderCreature(host, tasks, analysis, options = {}) {
  if (options.isVictory) {
    host.replaceChildren();
    return;
  }

  const remainingHours = sumHours(tasks);
  const totalHours = Math.max(remainingHours, Number(analysis.realisticMinimumHours) || 1);
  const ratio = Math.min(1, remainingHours / totalHours);
  const eyeCount = Math.min(8, Math.max(2, 2 + Math.floor(tasks.length / 2)));
  const highRisk = tasks.filter((task) => task.riskLevel === "high").length;
  const dependencyCount = tasks.reduce((sum, task) => sum + (task.dependencies?.length || 0), 0);
  const categories = new Set(tasks.map((task) => task.category));
  const scale = options.preview ? 1 : 0.72 + ratio * 0.3;

  const wrap = document.createElement("div");
  wrap.className = "creature-wrap";
  wrap.style.setProperty("--creature-scale", scale.toFixed(2));
  const shadow = document.createElement("div");
  shadow.className = "creature-shadow";
  const body = document.createElement("div");
  body.className = "gremlin-body";
  body.append(makeElement("div", "ear left"), makeElement("div", "ear right"));

  const eyes = makeElement("div", "eye-field");
  for (let index = 0; index < eyeCount; index += 1) {
    const eye = makeElement("span", "eye");
    const size = 30 + ((index * 7 + tasks.length * 3) % 15);
    eye.style.setProperty("--eye-size", `${size}px`);
    eye.style.setProperty("--eye-tilt", `${((index * 13) % 18) - 9}deg`);
    eyes.append(eye);
  }
  body.append(eyes, makeElement("div", "mouth"));

  wrap.append(
    shadow,
    makeElement("div", "arm left"),
    makeElement("div", "arm right"),
    makeElement("div", "leg left"),
    makeElement("div", "leg right"),
  );

  if (dependencyCount > 2 || tasks.length > 7) {
    wrap.append(makeElement("div", "arm extra left"), makeElement("div", "arm extra right"));
  }
  if (analysis.complexityScore >= 7 || remainingHours > 18) {
    wrap.append(makeElement("div", "horn left"), makeElement("div", "horn right"));
  }
  for (let index = 0; index < Math.min(5, highRisk); index += 1) {
    wrap.append(makeElement("span", `spike s${index + 1}`));
  }
  if (categories.has("security")) body.append(makeElement("div", "armor"));
  if (categories.has("accessibility") && eyeCount <= 4) body.append(makeElement("div", "glasses"));
  if (categories.has("backend")) body.append(makeElement("div", "mechanical"));
  if ((analysis.assumptions?.length || 0) > 2 && tasks.length > 3) {
    const mark = makeElement("div", "question-mark");
    mark.textContent = "?";
    wrap.append(mark);
  }

  wrap.append(body);
  host.replaceChildren(wrap);

  if (options.animate && !REDUCED_MOTION.matches) {
    clearTimeout(mutationTimer);
    wrap.classList.add("mutating");
    mutationTimer = window.setTimeout(() => wrap.classList.remove("mutating"), 650);
  }
}

function renderPreviewCreature() {
  const tasks = Array.from({ length: 9 }, (_, index) => ({
    estimatedHours: 2 + (index % 3),
    riskLevel: index < 4 ? "high" : "medium",
    dependencies: index % 2 ? ["other"] : [],
    category: ["security", "backend", "frontend", "testing"][index % 4],
  }));
  renderCreature(elements.previewCreature, tasks, { complexityScore: 8, realisticMinimumHours: 27, assumptions: ["a", "b", "c"] }, { preview: true });
}

function renderLoop(progress, laterCount, victory) {
  elements.loopSteps.forEach((step) => step.classList.remove("is-active", "is-complete"));
  elements.loopSteps[0].classList.add("is-complete");
  if (victory) {
    elements.loopSteps.slice(0, 3).forEach((step) => step.classList.add("is-complete"));
    elements.loopSteps[3].classList.add("is-active");
  } else if (progress > 0) {
    elements.loopSteps[1].classList.add("is-complete");
    elements.loopSteps[2].classList.add("is-active");
  } else {
    elements.loopSteps[1].classList.add("is-active");
    if (laterCount > 0) elements.loopSteps[1].classList.add("is-complete");
  }
}

function openShareDialog() {
  if (!state) return;
  drawShareCard();
  const victory = isVictoryState();
  elements.shareTitle.textContent = victory ? "Share the victory" : "Share the specimen";
  elements.shareCopy.textContent = getShareText();
  if (typeof elements.shareDialog.showModal === "function") {
    elements.shareDialog.showModal();
  } else {
    elements.shareDialog.setAttribute("open", "");
  }
}

function drawShareCard() {
  const canvas = elements.shareCanvas;
  const context = canvas.getContext("2d");
  const { analysis, tasks } = state;
  const buildTasks = tasks.filter((task) => task.status === "todo" || task.status === "in-progress");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const victory = buildTasks.length === 0 && completedTasks.length > 0;
  const remaining = sumHours(buildTasks);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#080a08";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(199,255,40,.07)";
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 48) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }

  context.fillStyle = "#c7ff28";
  context.fillRect(0, 0, 18, canvas.height);
  context.font = "900 28px Arial";
  context.fillText("GREMLIN / FEATURE CONTAINMENT", 64, 65);
  context.fillStyle = "#778073";
  context.font = "700 18px monospace";
  context.fillText(victory ? "STATUS: DEFEATED" : "STATUS: SCOPE EXPOSED", 64, 101);

  context.fillStyle = victory ? "#c7ff28" : "#f1f2e9";
  context.font = "900 80px Impact, Arial Black, sans-serif";
  const headline = victory ? "GREMLIN DEFEATED" : "SMALL REQUEST.\nBIG GREMLIN.";
  drawMultiline(context, headline, 64, 195, 92);

  context.fillStyle = "#f1f2e9";
  context.font = "800 28px Arial";
  drawWrappedText(context, analysis.featureSummary.toUpperCase(), 64, victory ? 325 : 390, 590, 36, 2);

  context.fillStyle = "#9fa79c";
  context.font = "700 18px monospace";
  context.fillText(`ORIGINAL  ${compactHours(analysis.originalEstimateHours)}`, 66, 518);
  context.fillText(victory ? `COMPLETED  ${completedTasks.length} TASKS` : `REALISTIC  ${compactNumber(analysis.realisticMinimumHours)}–${compactNumber(analysis.realisticMaximumHours)}H`, 66, 553);
  context.fillStyle = "#c7ff28";
  context.fillText(victory ? "FEATURE COMPLETE" : `REMAINING  ${compactHours(remaining)}`, 66, 588);

  drawCanvasGremlin(context, 930, 332, buildTasks, victory);
  context.fillStyle = "#636c61";
  context.font = "700 15px monospace";
  context.textAlign = "right";
  context.fillText("REVEAL IT · SCOPE IT · BUILD IT · DEFEAT IT", 1140, 585);
  context.textAlign = "left";
}

function drawCanvasGremlin(context, x, y, tasks, victory) {
  context.save();
  if (victory) {
    context.strokeStyle = "#c7ff28";
    context.lineWidth = 5;
    for (let radius = 70; radius <= 170; radius += 50) {
      context.globalAlpha = 1 - radius / 230;
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.stroke();
    }
    context.globalAlpha = 1;
    context.fillStyle = "#c7ff28";
    context.font = "900 92px Arial";
    context.textAlign = "center";
    context.fillText("✓", x, y + 30);
    context.restore();
    return;
  }

  const eyes = Math.min(7, Math.max(2, 2 + Math.floor(tasks.length / 2)));
  context.translate(x, y);
  context.rotate(-0.04);
  context.fillStyle = "#9e6bff";
  context.beginPath(); context.ellipse(12, 28, 178, 160, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#c7ff28";
  context.strokeStyle = "#080a08";
  context.lineWidth = 10;
  context.beginPath(); context.ellipse(0, 12, 166, 154, 0, 0, Math.PI * 2); context.fill(); context.stroke();

  context.fillStyle = "#ff4fa3";
  context.beginPath(); context.moveTo(-152, -70); context.lineTo(-245, -135); context.lineTo(-175, -8); context.fill(); context.stroke();
  context.beginPath(); context.moveTo(152, -70); context.lineTo(245, -135); context.lineTo(175, -8); context.fill(); context.stroke();

  for (let index = 0; index < eyes; index += 1) {
    const angle = ((index / eyes) * Math.PI * 1.2) + Math.PI * .9;
    const ex = Math.cos(angle) * 94;
    const ey = Math.sin(angle) * 58 - 24;
    context.fillStyle = "#f1f2e9";
    context.beginPath(); context.ellipse(ex, ey, 25, 22, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = "#080a08";
    context.beginPath(); context.arc(ex + 3, ey + 2, 8, 0, Math.PI * 2); context.fill();
  }

  context.fillStyle = "#2c1020";
  context.beginPath(); context.ellipse(0, 70, 78, 43, 0, 0, Math.PI * 2); context.fill(); context.stroke();
  context.restore();
}

function downloadShareCard() {
  drawShareCard();
  const link = document.createElement("a");
  link.download = `gremlin-${slugify(state.analysis.featureSummary)}.png`;
  link.href = elements.shareCanvas.toDataURL("image/png");
  link.click();
  toast("Field report downloaded.");
}

async function copyShareText() {
  try {
    await navigator.clipboard.writeText(getShareText());
    toast("Result copied to clipboard.");
  } catch {
    toast("Clipboard access was blocked. Select the text in the share window instead.");
  }
}

function getShareText() {
  const { analysis, tasks } = state;
  const buildTasks = tasks.filter((task) => task.status === "todo" || task.status === "in-progress");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  if (buildTasks.length === 0 && completedTasks.length > 0) {
    return `Gremlin defeated. I finished “${analysis.featureSummary}” after completing ${completedTasks.length} hidden tasks.`;
  }
  return `I estimated ${formatHours(analysis.originalEstimateHours)} for “${analysis.featureSummary}.” Gremlin found ${compactNumber(analysis.realisticMinimumHours)}–${compactNumber(analysis.realisticMaximumHours)} hours and grew ${mutationCount(buildTasks)} mutations.`;
}

function isVictoryState() {
  if (!state) return false;
  const buildTasks = state.tasks.filter((task) => task.status === "todo" || task.status === "in-progress");
  const completedTasks = state.tasks.filter((task) => task.status === "completed");
  return buildTasks.length === 0 && completedTasks.length > 0;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast("Progress works now, but this browser blocked local saving.");
  }
}

function readSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.analysis?.featureSummary || !Array.isArray(saved.tasks)) return null;
    return saved;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearErrors() {
  elements.featureError.textContent = "";
  elements.estimateError.textContent = "";
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  elements.toastRegion.append(item);
  window.setTimeout(() => item.remove(), 3800);
}

function makeElement(tag, className) {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function sumHours(tasks) {
  return tasks.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);
}

function compactHours(value) {
  return `${compactNumber(value)}H`;
}

function compactNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatHours(value) {
  const number = Number(value) || 0;
  return `${compactNumber(number)} ${number === 1 ? "hour" : "hours"}`;
}

function taskCountLabel(count) {
  return `${count} ${count === 1 ? "TASK" : "TASKS"}`;
}

function currentThreat(tasks, originalThreat) {
  const ratioThreat = Math.ceil(tasks.length * .7 + sumHours(tasks) / 8);
  return Math.min(10, Math.max(1, Math.min(originalThreat, ratioThreat)));
}

function mutationCount(tasks) {
  if (!tasks.length) return 0;
  const highRisk = tasks.filter((task) => task.riskLevel === "high").length;
  return Math.min(19, 2 + Math.ceil(tasks.length * .7) + highRisk);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "result";
}

function drawMultiline(context, text, x, y, lineHeight) {
  text.split("\n").forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (context.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  lines.slice(0, maxLines).forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}
