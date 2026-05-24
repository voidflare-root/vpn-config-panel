const fs = require("fs/promises");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me-now";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.txt");
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_SIZE = 1024 * 1024;
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
    await fs.writeFile(
      CONFIG_PATH,
      "# Paste your VPN config here from the admin panel.\n",
      "utf8"
    );
  }
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
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

  if (url.pathname === "/api/config" && req.method === "GET") {
    if (!isAdmin(req)) {
      return sendJson(res, 401, { error: "Invalid admin token" });
    }
    const config = await fs.readFile(CONFIG_PATH, "utf8");
    return sendJson(res, 200, { config });
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

    await fs.writeFile(CONFIG_PATH, config, "utf8");
    return sendJson(res, 200, { ok: true, updatedAt: new Date().toISOString() });
  }

  if ((url.pathname === "/raw/config" || url.pathname === "/config.txt") && req.method === "GET") {
    const config = await fs.readFile(CONFIG_PATH, "utf8");
    return send(res, 200, config, "text/plain; charset=utf-8");
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
        sendJson(res, 500, { error: "Server error" });
      });
    })
    .listen(PORT, () => {
      console.log(`VPN config panel running at http://localhost:${PORT}`);
      console.log(`Raw config link: http://localhost:${PORT}/raw/config`);
    });
});
