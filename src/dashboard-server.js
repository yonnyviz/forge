#!/usr/bin/env node

const http = require("node:http");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const identity = argument("--identity", "forge-dashboard-v1");
const config = argument("--config", "");
if (config) process.env.FORGE_DASHBOARD_CONFIG = config;

const {
  discoverInitiatives,
  getInitiativeById,
  getInitiativeDetail,
  listVisibleFiles,
  readDashboardConfig,
  readInitiativeFile,
  safeFilePath,
} = require("./dashboard-store.js");

const port = Number.parseInt(argument("--port", "4317"), 10);
const html = readFileSync(join(__dirname, "dashboard.html"), "utf8");

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}

function jsonError(response, status, message) {
  send(response, status, { error: message });
}

function handle(request, response) {
  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  } catch {
    return jsonError(response, 400, "Invalid URL");
  }
  if (request.method !== "GET") return jsonError(response, 405, "Only GET is supported");
  if (url.pathname === "/_forge/health") {
    return send(response, 200, { service: "forge-dashboard", launchIdentity: identity, pid: process.pid });
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return send(response, 200, html, "text/html; charset=utf-8");
  }

  if (url.pathname === "/api/initiatives") {
    try {
      const configuration = readDashboardConfig();
      return send(response, 200, discoverInitiatives(configuration).map((initiative) => getInitiativeDetail(initiative, configuration)));
    } catch (error) {
      return jsonError(response, 500, error.message);
    }
  }

  const match = url.pathname.match(/^\/api\/initiatives\/([^/]+)(?:\/files)?$/);
  if (!match) return jsonError(response, 404, "Not found");
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return jsonError(response, 400, "Invalid initiative id");
  }
  try {
    const configuration = readDashboardConfig();
    const initiative = getInitiativeById(id, configuration);
    if (!initiative) return jsonError(response, 404, "Initiative not found");
    if (url.pathname.endsWith("/files")) {
      const requested = url.searchParams.get("path");
      if (!requested) return send(response, 200, { files: listVisibleFiles(initiative.path) });
      safeFilePath(initiative.path, requested);
      return send(response, 200, readInitiativeFile(initiative, requested));
    }
    return send(response, 200, getInitiativeDetail(initiative, configuration));
  } catch (error) {
    return jsonError(response, /restricted|escapes|hidden|browsable/.test(error.message) ? 403 : 500, error.message);
  }
}

const server = http.createServer(handle);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen({ port: Number.isInteger(port) ? port : 0, host: "127.0.0.1" }, () => {
  console.log(`FORGE_DASHBOARD_READY ${server.address().port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 1000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
