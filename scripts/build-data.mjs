// Walk the sibling task folders and produce data/tasks.json + public/models/*.glb
// for the website. Run from the website directory: `npm run build:data`

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(__dirname, "..");
const TASKS_ROOT = resolve(WEBSITE_ROOT, "..");
const MODELS_OUT = join(WEBSITE_ROOT, "public", "models");
const SCHEMAS_OUT = join(WEBSITE_ROOT, "public", "schemas");
const DATA_OUT = join(WEBSITE_ROOT, "data", "tasks.json");
const STEP_TO_GLB = join(WEBSITE_ROOT, "scripts", "step_to_glb.py");

const SKIP_DIRS = new Set(["website", "tools", ".git", "node_modules"]);

function log(...args) {
  console.log("[build-data]", ...args);
}

function readToml(path) {
  // Very lightweight TOML parser — only what we need (top-level key=value + [section]).
  const text = readFileSync(path, "utf8");
  const out = {};
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (!out[section]) out[section] = {};
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z0-9_\-\.]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;
    let val = kvMatch[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (section) out[section][kvMatch[1]] = val;
    else out[kvMatch[1]] = val;
  }
  return out;
}

function findStep(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const stepFile = files.find((f) => /\.(step|STEP|stp|STP)$/i.test(f));
  return stepFile ? join(dir, stepFile) : null;
}

function findPdf(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const pdfFile = files.find((f) => /\.pdf$/i.test(f));
  return pdfFile ? join(dir, pdfFile) : null;
}

function findLatestTrialOfModel(taskDir, modelKey) {
  const jobsDir = join(taskDir, "jobs");
  if (!existsSync(jobsDir)) return null;
  const batches = readdirSync(jobsDir)
    .map((name) => ({ name, path: join(jobsDir, name) }))
    .filter((b) => statSync(b.path).isDirectory());
  // newest first by lexicographic batch timestamp (works because naming is YYYY-MM-DD__HH-MM-SS)
  batches.sort((a, b) => b.name.localeCompare(a.name));
  for (const batch of batches) {
    const resultPath = join(batch.path, "result.json");
    if (!existsSync(resultPath)) continue;
    let result;
    try {
      result = JSON.parse(readUtf8(resultPath));
    } catch {
      continue;
    }
    const evals = result.stats?.evals ?? {};
    const evalName = Object.keys(evals).find((k) => k.includes(modelKey));
    if (!evalName) continue;
    // Find the trial folder inside this batch
    const trialDir = readdirSync(batch.path)
      .map((name) => ({ name, path: join(batch.path, name) }))
      .find((t) => statSync(t.path).isDirectory());
    if (!trialDir) continue;
    return { batch, trialPath: trialDir.path, evalName, evalResult: evals[evalName] };
  }
  return null;
}

function readUtf8(path) {
  let text = readFileSync(path, "utf8");
  // PowerShell writes UTF-8 with BOM by default; strip it so JSON.parse works.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function loadRunSummary(trialPath) {
  const sumPath = join(trialPath, "run_summary.json");
  if (!existsSync(sumPath)) return null;
  try {
    return JSON.parse(readUtf8(sumPath));
  } catch (e) {
    log(`  failed to parse ${sumPath}: ${e.message?.slice(0, 100)}`);
    return null;
  }
}

function findOutStep(trialPath) {
  const candidates = [
    join(trialPath, "artifacts", "out.step"),
    join(trialPath, "artifacts", "out.STEP"),
    join(trialPath, "out.step"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

function convertStepToGlb(srcStep, dstGlb) {
  log(`  converting -> ${dstGlb.substring(WEBSITE_ROOT.length + 1)}`);
  try {
    execSync(
      `uvx --python 3.12 --with build123d==0.10.0 --with trimesh python "${STEP_TO_GLB}" "${srcStep}" "${dstGlb}"`,
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    return existsSync(dstGlb);
  } catch (e) {
    log(`  conversion failed for ${srcStep}: ${(e.stderr || e.message || "").toString().slice(0, 200)}`);
    return false;
  }
}

function summaryToRecord(summary) {
  if (!summary) return null;
  return {
    reward: summary.outcome?.reward ?? null,
    tests_passed: summary.outcome?.tests_passed ?? null,
    tests_total: summary.outcome?.tests_total ?? null,
    duration_sec: summary.trial?.duration_sec ?? null,
    cost_usd: summary.performance?.cost_usd_estimated ?? null,
    tool_calls: summary.trajectory_analysis?.tool_calls_total ?? null,
    tools_by_type: summary.trajectory_analysis?.tool_calls_by_type ?? null,
    libraries: (summary.libraries_detected ?? [])
      .filter((l) => l.likely_used)
      .map((l) => l.name),
    stuck_points: summary.trajectory_analysis?.stuck_points_count ?? null,
  };
}

function processTask(taskDir) {
  const id = taskDir.split(/[/\\]/).pop();
  log(`\nTask: ${id}`);

  const tomlPath = join(taskDir, "task.toml");
  if (!existsSync(tomlPath)) {
    log("  no task.toml; skipping");
    return null;
  }
  const toml = readToml(tomlPath);
  const sw = toml["metadata.steadyworks"] ?? {};

  const instructionPath = join(taskDir, "instruction.md");
  const prompt = existsSync(instructionPath)
    ? readFileSync(instructionPath, "utf8").replace(/^<!--.*?-->\s*/m, "").trim()
    : "";

  const inputStep = findStep(join(taskDir, "environment"));
  const inputPdf = findPdf(join(taskDir, "environment"));
  const refStep = findStep(join(taskDir, "solution"));

  const opusTrial = findLatestTrialOfModel(taskDir, "opus-4-7");
  const haikuTrial = findLatestTrialOfModel(taskDir, "haiku-4-5");
  const opusOutStep = opusTrial ? findOutStep(opusTrial.trialPath) : null;
  const haikuOutStep = haikuTrial ? findOutStep(haikuTrial.trialPath) : null;

  // Ensure model output dir
  const modelsDir = join(MODELS_OUT, id);
  mkdirSync(modelsDir, { recursive: true });

  function maybeConvert(src, name) {
    if (!src) return null;
    const dst = join(modelsDir, `${name}.glb`);
    if (convertStepToGlb(src, dst)) {
      return `/models/${id}/${name}.glb`;
    }
    return null;
  }

  const models = {
    input: maybeConvert(inputStep, "input"),
    reference: maybeConvert(refStep, "reference"),
    opus: maybeConvert(opusOutStep, "opus"),
    haiku: maybeConvert(haikuOutStep, "haiku"),
  };

  // Copy PDF schematic (if any) so tasks like corner-bracket-v2 / bore-socket
  // can show the schematic as the "Input" panel instead of an empty model viewer.
  let inputPdfUrl = null;
  if (inputPdf) {
    const schemaDir = join(SCHEMAS_OUT, id);
    mkdirSync(schemaDir, { recursive: true });
    // Normalize the filename — strip spaces and special chars from URL to avoid encoding issues
    const safeName = "schematic.pdf";
    const dst = join(schemaDir, safeName);
    copyFileSync(inputPdf, dst);
    inputPdfUrl = `/schemas/${id}/${safeName}`;
    log(`  copied schematic -> ${inputPdfUrl}`);
  }

  const results = {
    opus: summaryToRecord(opusTrial ? loadRunSummary(opusTrial.trialPath) : null),
    haiku: summaryToRecord(haikuTrial ? loadRunSummary(haikuTrial.trialPath) : null),
  };

  return {
    id,
    category: sw.category ?? null,
    sub_category: sw.sub_category ?? null,
    task_class: sw.task_class ?? null,
    difficulty: sw.difficulty ?? null,
    discriminator: sw.discriminator ?? null,
    prompt,
    input_pdf: inputPdfUrl,
    models,
    results,
  };
}

function main() {
  log("Scanning tasks under", TASKS_ROOT);
  mkdirSync(MODELS_OUT, { recursive: true });
  mkdirSync(dirname(DATA_OUT), { recursive: true });

  const taskDirs = readdirSync(TASKS_ROOT)
    .filter((name) => !SKIP_DIRS.has(name) && !name.startsWith("."))
    .map((name) => join(TASKS_ROOT, name))
    .filter((path) => statSync(path).isDirectory());

  log(`Found ${taskDirs.length} candidate task folders`);

  const tasks = [];
  for (const dir of taskDirs) {
    const t = processTask(dir);
    if (t) tasks.push(t);
  }

  const out = {
    tasks,
    generated_at: new Date().toISOString(),
    note: "Auto-generated by scripts/build-data.mjs",
  };
  writeFileSync(DATA_OUT, JSON.stringify(out, null, 2));
  log(`\nWrote ${tasks.length} tasks to ${DATA_OUT}`);
}

main();
