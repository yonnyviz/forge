const {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { homedir } = require("node:os");
const { dirname, extname, isAbsolute, join, relative, resolve } = require("node:path");

const DEFAULT_CONFIG_PATH = join(homedir(), ".forge", "dashboard.json");
const DEFAULT_CONFIG = {
  initiativeRoots: [expandHome(process.env.FORGE_INITIATIVES_DIR || "~/Documents/initiatives")],
};
const APPROVED_EXTENSIONS = new Set([".md", ".json"]);
const APPROVED_FALLBACK_FILES = [
  "README.md",
  ".claude.md",
  "planning/ROADMAP.md",
  "docs/DECISIONS.md",
  ".forge/metadata.json",
];

function expandHome(value) {
  if (!value) return value;
  return value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
}

function configPath() {
  return expandHome(process.env.FORGE_DASHBOARD_CONFIG || DEFAULT_CONFIG_PATH);
}

function runtimePath() {
  return expandHome(
    process.env.FORGE_DASHBOARD_RUNTIME || join(dirname(configPath()), "dashboard-runtime.json")
  );
}

function normalizeRoot(root) {
  if (typeof root !== "string" || !root.trim()) return null;
  const expanded = expandHome(root.trim());
  const absolute = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
  return existsSync(absolute) ? realpathSync(absolute) : resolve(absolute);
}

function ensureDashboardConfig() {
  const path = configPath();
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    try {
      writeFileSync(path, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  return path;
}

function readDashboardConfig() {
  const path = ensureDashboardConfig();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Invalid dashboard configuration at ${path}: ${error.message}`);
  }

  const roots = Array.isArray(parsed.initiativeRoots)
    ? parsed.initiativeRoots.map(normalizeRoot).filter(Boolean)
    : [];
  if (!roots.length) throw new Error("Dashboard configuration must contain at least one existing initiativeRoots entry");
  return { path, initiativeRoots: [...new Set(roots)] };
}

function isInside(root, candidate) {
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${require("node:path").sep}`);
}

function safeFilePath(root, filePath, options = {}) {
  if (typeof filePath !== "string" || !filePath || filePath.includes("\\")) {
    throw new Error("A relative Markdown or JSON path is required");
  }
  const segments = filePath.split(/[\\/]+/);
  if (!options.allowHidden && segments.some((segment) => segment.startsWith("."))) {
    throw new Error("File access is restricted to visible Markdown and JSON files");
  }
  const candidate = resolve(root, filePath);
  if (!isInside(root, candidate) || !APPROVED_EXTENSIONS.has(extname(candidate).toLowerCase())) {
    throw new Error("File access is restricted to Markdown and JSON files inside the initiative root");
  }
  if (!existsSync(candidate) || !lstatSync(candidate).isFile()) throw new Error("File not found");
  const realCandidate = realpathSync(candidate);
  const realRoot = realpathSync(root);
  if (!isInside(realRoot, realCandidate)) throw new Error("Path escapes the configured initiative root");
  return realCandidate;
}

function readApprovedFile(root, filePath, options = {}) {
  return readFileSync(safeFilePath(root, filePath, options), "utf8");
}

function parseFrontMatter(content) {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  return match[1].split(/\r?\n/).reduce((result, line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return result;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key || !value) return result;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    }
    result[key] = value;
    return result;
  }, {});
}

function readTextIfPresent(root, relativePath) {
  try {
    return readApprovedFile(root, relativePath, { allowHidden: true });
  } catch {
    return "";
  }
}

function firstHeading(content) {
  const match = content.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : "";
}

function firstParagraph(content) {
  const withoutFrontMatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const lines = withoutFrontMatter.split(/\r?\n/);
  const paragraph = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[") || trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("```")) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(trimmed);
  }
  return paragraph.join(" ").slice(0, 500);
}

function parseProgress(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function findNextAction(content) {
  const match = content.match(/^\s*-\s*\[ \]\s+(.+?)\s*$/m);
  return match ? match[1].trim() : "";
}

function extractLabeledBullets(content, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\*\\*|\\n\\s*##|\\n\\s*---|$)`, "i"));
  if (!match) return [];
  return match[1].split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(?:\[[ xX]\]\s+)?(.+?)\s*$/))
    .filter(Boolean)
    .map((matchItem) => matchItem[1].trim())
    .filter(Boolean)
    .slice(0, 5);
}

function sectionContent(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp(`^##\\s+.*${escaped}.*$`, "im").exec(content);
  if (!header) return "";
  const rest = content.slice(header.index + header[0].length);
  const nextHeading = rest.search(/^##\\s+/m);
  return nextHeading < 0 ? rest : rest.slice(0, nextHeading);
}

function extractSectionBullets(content, heading) {
  const section = sectionContent(content, heading);
  if (!section) return [];
  return section.split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(?:\[[ xX]\]\s+)?(.+?)\s*$/))
    .filter(Boolean)
    .map((matchItem) => matchItem[1].trim())
    .filter(Boolean)
    .slice(0, 5);
}

function recentProgress(path, readme, claude) {
  const direct = extractLabeledBullets(claude, "Recent Progress").concat(extractLabeledBullets(readme, "Recent Progress"));
  if (direct.length) return direct.slice(0, 3);
  const sessions = readdirSafe(join(path, "sessions"))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name));
  const progress = [];
  for (const session of sessions) {
    const notes = readTextIfPresent(path, join("sessions", session.name, "notes.md"));
    progress.push(...extractSectionBullets(notes, "What Was Done"));
    if (progress.length >= 3) break;
  }
  return progress.slice(0, 3);
}

function extractSectionText(content, heading) {
  const section = sectionContent(content, heading);
  if (!section) return "";
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .join(" ")
    .slice(0, 500);
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasInitiativeFiles(path) {
  return APPROVED_FALLBACK_FILES.some((file) => existsSync(join(path, file))) || existsSync(join(path, "sessions"));
}

function initiativeDirectories(root) {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) return [];
  const rootMetadata = join(root, ".forge", "metadata.json");
  if (existsSync(rootMetadata) || (existsSync(join(root, "README.md")) && !readdirSafe(root).some((entry) => entry.isDirectory() && hasInitiativeFiles(join(root, entry.name))))) {
    return [root];
  }
  return readdirSafe(root)
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => join(root, entry.name))
    .filter(hasInitiativeFiles);
}

function readdirSafe(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function readMetadata(path) {
  try {
    const raw = readApprovedFile(path, ".forge/metadata.json");
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function discoverInitiatives(configuration = readDashboardConfig()) {
  const result = [];
  for (const configuredRoot of configuration.initiativeRoots) {
    const root = normalizeRoot(configuredRoot);
    if (!root || !existsSync(root)) continue;
    for (const path of initiativeDirectories(root)) {
      const rootRelativePath = relative(root, path) || ".";
      const id = `${configuration.initiativeRoots.indexOf(configuredRoot)}:${rootRelativePath}`;
      result.push({ id, name: path === root ? root.split(require("node:path").sep).pop() : path.split(require("node:path").sep).pop(), path, root });
    }
  }
  return result;
}

function getInitiativeById(id, configuration = readDashboardConfig()) {
  return discoverInitiatives(configuration).find((initiative) => initiative.id === id);
}

function normalizeInitiative(initiative) {
  const metadata = readMetadata(initiative.path);
  const readme = readTextIfPresent(initiative.path, "README.md");
  const claude = readTextIfPresent(initiative.path, ".claude.md");
  const frontMatter = parseFrontMatter(readme) || {};
  let updated = validDate(frontMatter.updated || metadata.updated || metadata.lastUpdated);
  if (!updated) {
    try {
      updated = statSync(join(initiative.path, "README.md")).mtime.toISOString();
    } catch {
      updated = null;
    }
  }
  const title = frontMatter.title || metadata.title || metadata.displayName || firstHeading(readme) || initiative.name;
  const status = String(frontMatter.status || metadata.status || "unknown");
  const goal = frontMatter.goal || metadata.goal || extractSectionText(readme, "Goal") || null;
  const nextAction = frontMatter.next_action || metadata.next_action || metadata.nextAction || findNextAction(claude) || null;
  const recent = recentProgress(initiative.path, readme, claude);
  const missing = [];
  if (!goal) missing.push("objective");
  if (!metadata.description && !metadata.summary && !firstParagraph(readme)) missing.push("summary");
  if (parseProgress(frontMatter.progress ?? metadata.progress) === null) missing.push("progress");
  const health = status.toLowerCase() === "blocked" ? "needs-attention" : status.toLowerCase() === "unknown" || missing.length >= 2 ? "needs-attention" : "healthy";
  return {
    id: initiative.id,
    name: metadata.name || initiative.name,
    title,
    status,
    progress: parseProgress(frontMatter.progress ?? metadata.progress),
    updated,
    next_action: nextAction,
    description: metadata.description || metadata.summary || firstParagraph(readme) || null,
    goal,
    objective: goal,
    recent_progress: recent,
    health,
    missing_fields: missing,
    owner: metadata.owner || null,
    phase: metadata.phase || null,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    source: {
      root: initiative.root,
      relativePath: relative(initiative.root, initiative.path) || ".",
    },
  };
}

function listVisibleFiles(root, current = "") {
  const directory = join(root, current);
  const files = [];
  for (const entry of readdirSafe(directory)) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = current ? join(current, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...listVisibleFiles(root, relativePath));
    else if (entry.isFile() && APPROVED_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(relativePath);
  }
  return files.sort();
}

function cleanInline(value) {
  return value.replace(/[`*_~]/g, "").trim();
}

function fieldFromSection(section, field) {
  const match = section.match(new RegExp(`^\\s*\\*\\*${field}:\\*\\*\\s*(.+?)\\s*$`, "im"));
  return match ? cleanInline(match[1]) : null;
}

function extractMilestones(roadmap, additionalDocuments = []) {
  const milestones = [];
  const seen = new Set();
  const add = (id, title, status, source = "planning/ROADMAP.md") => {
    if (!id) return;
    const normalizedId = id.toUpperCase();
    const existing = milestones.find((milestone) => milestone.id === normalizedId);
    if (existing) {
      if (existing.status === "Not stated" && status) existing.status = cleanInline(status);
      if (existing.title.startsWith("Milestone ") && title) existing.title = cleanInline(title);
      return;
    }
    seen.add(normalizedId);
    milestones.push({ id: normalizedId, title: cleanInline(title || "Untitled milestone"), status: cleanInline(status || "Not stated"), source });
  };
  const parseDocument = (document, source) => {
    const table = /^\|\s*(M\d+)(?:\s*[—:-]\s*([^|]+))?\s*\|\s*([^|]+)\|\s*([^|]+)\|/gim;
    let match;
    while ((match = table.exec(document))) {
      const title = match[2] || `Milestone ${match[1]}`;
      if (!/^[-\s]+$/.test(match[3]) && !/^[-\s]+$/.test(match[4])) add(match[1], title, match[4], source);
    }
    const sequence = /^\s*\d+\.\s+\*\*(M\d+)\s*[:—-]\s*(.+?)\*\*/gim;
    while ((match = sequence.exec(document))) add(match[1], match[2], "Not stated", source);
    const heading = /^#{1,3}\s+(M\d+)\s*[:—-]\s*(.+?)\s*$/gim;
    while ((match = heading.exec(document))) {
      const sectionStart = match.index + match[0].length;
      const next = document.slice(sectionStart).search(/^#{1,3}\s+/im);
      const section = next < 0 ? document.slice(sectionStart) : document.slice(sectionStart, sectionStart + next);
      add(match[1], match[2], fieldFromSection(section, "Status"), source);
    }
  };
  parseDocument(roadmap, "planning/ROADMAP.md");
  for (const document of additionalDocuments) parseDocument(document.content, document.source);
  return milestones;
}

function extractDecisions(decisions) {
  const result = [];
  const heading = /^##\s+(ADR[- ]?\d+)\s*[:—-]\s*(.+?)\s*$/gim;
  let match;
  while ((match = heading.exec(decisions))) {
    const sectionStart = match.index + match[0].length;
    const next = decisions.slice(sectionStart).search(/^##\s+/im);
    const section = next < 0 ? decisions.slice(sectionStart) : decisions.slice(sectionStart, sectionStart + next);
    result.push({ id: match[1].toUpperCase().replace(" ", "-"), title: cleanInline(match[2]), date: fieldFromSection(section, "Date"), status: fieldFromSection(section, "Status"), source: "docs/DECISIONS.md" });
  }
  return result;
}

function extractActivity(path) {
  return readdirSafe(join(path, "sessions"))
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const notes = readTextIfPresent(path, join("sessions", entry.name, "notes.md"));
      const completed = extractSectionBullets(notes, "What Was Done");
      const dateMatch = entry.name.match(/^\d{4}-\d{2}-\d{2}/);
      return { date: dateMatch ? dateMatch[0] : null, title: entry.name.replace(/^\\d{4}-\\d{2}-\\d{2}_?/, "").replace(/[-_]+/g, " ") || entry.name, summary: completed.length ? completed.join(" ") : firstParagraph(notes) || "Session recorded.", source: join("sessions", entry.name, "notes.md") };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function getInitiativeDetail(initiative, configuration) {
  const summary = normalizeInitiative(initiative);
  const roadmap = readTextIfPresent(initiative.path, "planning/ROADMAP.md");
  const decisions = readTextIfPresent(initiative.path, "docs/DECISIONS.md");
  const files = listVisibleFiles(initiative.path);
  const milestoneDocuments = files
    .filter((file) => /^planning\/milestones\/[^/]+\.md$/i.test(file))
    .map((file) => ({ source: file, content: readTextIfPresent(initiative.path, file) }));
  return {
    ...summary,
    files,
    milestones: extractMilestones(roadmap, milestoneDocuments),
    decisions: extractDecisions(decisions),
    activity: extractActivity(initiative.path),
  };
}

function readInitiativeFile(initiative, filePath) {
  const content = readApprovedFile(initiative.path, filePath);
  return { path: filePath, content };
}

module.exports = {
  APPROVED_EXTENSIONS,
  configPath,
  discoverInitiatives,
  ensureDashboardConfig,
  getInitiativeById,
  getInitiativeDetail,
  listVisibleFiles,
  normalizeInitiative,
  parseFrontMatter,
  readApprovedFile,
  readDashboardConfig,
  readInitiativeFile,
  runtimePath,
  safeFilePath,
};
