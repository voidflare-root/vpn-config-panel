const fs = require("fs/promises");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me-now";
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "data");
const CONFIG_FILE_NAME = "config.json";
const CONFIG_PATH = path.join(DATA_DIR, CONFIG_FILE_NAME);
const PUBLIC_DIR = path.join(__dirname, "public");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_CONFIG_PATH = process.env.GITHUB_CONFIG_PATH || `data/${CONFIG_FILE_NAME}`;
const MAX_BODY_SIZE = 1024 * 1024;
const DEFAULT_CONFIG = JSON.stringify(
  { version: "1.0.0", updatedAt: null, config: "Paste your VPN config here" },
  null,
  2
);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

async function ensureConfigFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CONFIG_PATH);
  } catch {
    await fs.writeFile(CONFIG_PATH, DEFAULT_CONFIG, "utf8");
  }
}

function useGithubStorage() {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO);
}

function githubApiUrl() {
  return `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(GITHUB_CONFIG_PATH).replace(/%2F/g, "/")}`;
}

function githubRawUrl() {
  return `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_CONFIG_PATH}`;
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "vpn-config-panel",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || "GitHub API request failed");
  }

  return data;
}

async function readGithubConfig() {
  try {
    const data = await githubRequest(`${githubApiUrl()}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
    return Buffer.from(String(data.content || "").replace(/\n/g, ""), "base64").toString("utf8");
  } catch (error) {
    if (String(error.message).includes("Not Found")) {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

async function saveGithubConfig(config) {
  let sha;
  try {
    const existing = await githubRequest(`${githubApiUrl()}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
    sha = existing.sha;
  } catch (error) {
    if (!String(error.message).includes("Not Found")) {
      throw error;
    }
  }

  await githubRequest(githubApiUrl(), {
    method: "PUT",
    body: JSON.stringify({
      message: `Update VPN config ${new Date().toISOString()}`,
      content: Buffer.from(config, "utf8").toString("base64"),
      branch: GITHUB_BRANCH,
      sha
    })
  });

  const savedConfig = await readGithubConfig();
  if (savedConfig !== config) {
    throw new Error("GitHub config save verification failed");
  }
}

async function readConfig() {
  if (useGithubStorage()) {
    return readGithubConfig();
  }
  await ensureConfigFile();
  return fs.readFile(CONFIG_PATH, "utf8");
}

async function saveConfig(config) {
  if (useGithubStorage()) {
    return saveGithubConfig(config);
  }

  await ensureConfigFile();
  const tempPath = `${CONFIG_PATH}.tmp`;
  await fs.writeFile(tempPath, config, "utf8");
  await fs.rename(tempPath, CONFIG_PATH);
}

function extractVersionFromText(config) {
  const patterns = [
    /^\s*(?:#|\/\/)?\s*(?:config[_ -]?version|app[_ -]?version|version|ver)\s*[:=]\s*["']?([^"'\r\n,;]+)["']?\s*$/im,
    /^\s*(?:CONFIG_VERSION|APP_VERSION|VERSION|VER)\s*=\s*["']?([^"'\r\n,;]+)["']?\s*$/m
  ];

  for (const pattern of patterns) {
    const match = config.match(pattern);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }

  return "1.0.0";
}

function normalizeConfigJson(config) {
  try {
    return JSON.stringify(JSON.parse(config), null, 2);
  } catch {
    return JSON.stringify(
      {
        version: extractVersionFromText(config),
        updatedAt: new Date().toISOString(),
        config
      },
      null,
      2
    );
  }
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, PUT, OPTIONS",
    "access-control-allow-headers": "content-type, x-admin-token",
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    expires: "0",
    pragma: "no-cache"
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), "application/json; charset=utf-8");
}

function isAdmin(req) {
  return req.headers["x-admin-token"] === ADMIN_TOKEN;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return send(res, 403, "Forbidden");
  }

  try {
    const file = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    return send(res, 200, file, contentType);
  } catch {
    return send(res, 404, "Not found");
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    return send(res, 204, "");
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    if (!isAdmin(req)) {
      return sendJson(res, 401, { error: "Invalid admin token" });
    }
    const config = await readConfig();
    return sendJson(res, 200, {
      config,
      rawUrl: useGithubStorage() ? githubRawUrl() : `${url.origin}/raw/config`,
      storage: useGithubStorage() ? "github" : "local"
    });
  }

  if (url.pathname === "/api/config" && req.method === "PUT") {
    if (!isAdmin(req)) {
      return sendJson(res, 401, { error: "Invalid admin token" });
    }

    const body = await readJsonBody(req);
    const config = typeof body.config === "string" ? body.config : "";
    if (!config.trim()) {
      return sendJson(res, 400, { error: "Config cannot be empty" });
    }

    const normalizedConfig = normalizeConfigJson(config);
    await saveConfig(normalizedConfig);
    return sendJson(res, 200, {
      ok: true,
      updatedAt: new Date().toISOString(),
      bytes: Buffer.byteLength(normalizedConfig, "utf8"),
      rawUrl: useGithubStorage() ? githubRawUrl() : `${url.origin}/raw/config`,
      storage: useGithubStorage() ? "github" : "local"
    });
  }

  if (
    (url.pathname === "/raw/config" ||
      url.pathname === "/config.json" ||
      url.pathname === "/config.txt") &&
    req.method === "GET"
  ) {
    const config = await readConfig();
    return send(res, 200, config, "application/json; charset=utf-8");
  }

  if (req.method === "GET") {
    return serveStatic(res, url.pathname);
  }

  return send(res, 405, "Method not allowed");
}

ensureConfigFile().then(() => {
  http
    .createServer((req, res) => {
      handleRequest(req, res).catch((error) => {
        console.error(error);
        sendJson(res, 500, { error: error.message || "Server error" });
      });
    })
    .listen(PORT, () => {
      console.log(`VPN config panel running at http://localhost:${PORT}`);
      console.log(`Raw config link: ${useGithubStorage() ? githubRawUrl() : `http://localhost:${PORT}/raw/config`}`);
    });
});
