const tokenInput = document.querySelector("#token");
const configInput = document.querySelector("#config");
const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginBtn = document.querySelector("#loginBtn");
const reloadBtn = document.querySelector("#reloadBtn");
const saveBtn = document.querySelector("#saveBtn");
const copyBtn = document.querySelector("#copyBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const rawLinkInput = document.querySelector("#rawLink");
const openRawBtn = document.querySelector("#openRawBtn");
const sizeText = document.querySelector("#sizeText");
const stateText = document.querySelector("#stateText");
const screenTitle = document.querySelector("#screenTitle");
const versionText = document.querySelector("#versionText");
const updatedText = document.querySelector("#updatedText");
const appUrlText = document.querySelector("#appUrlText");
const loginStatusEl = document.querySelector("#loginStatus");
const statusEl = document.querySelector("#status");
let activeRawUrl = rawUrl();

const savedToken = localStorage.getItem("vpn-admin-token");
if (savedToken) {
  tokenInput.value = savedToken;
}

function rawUrl() {
  if (window.location.protocol === "file:") {
    return "http://localhost:3000/raw/config";
  }
  return `${window.location.origin}/raw/config`;
}

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `status ${type}`.trim();
  stateText.textContent = type === "error" ? "Error" : "Ready";
  stateText.classList.toggle("error", type === "error");
}

function setDashboard(open) {
  loginView.classList.toggle("hidden", open);
  dashboardView.classList.toggle("hidden", !open);
}

function tokenHeaders() {
  const token = tokenInput.value.trim();
  if (token) {
    localStorage.setItem("vpn-admin-token", token);
  }
  return { "x-admin-token": token };
}

function updateConfigMeta() {
  const bytes = new Blob([configInput.value]).size;
  sizeText.textContent = `${bytes.toLocaleString()} B`;
}

function findConfigVersion(config) {
  const trimmed = config.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    const version =
      parsed.version ||
      parsed.configVersion ||
      parsed.config_version ||
      parsed.appVersion ||
      parsed.app_version ||
      parsed.ver;
    if (version !== undefined && version !== null && String(version).trim()) {
      return String(version).trim();
    }
  } catch {
    // Continue with text based config formats.
  }

  const versionPatterns = [
    /^\s*(?:#|\/\/)?\s*(?:config[_ -]?version|app[_ -]?version|version|ver)\s*[:=]\s*["']?([^"'\r\n,;]+)["']?\s*$/im,
    /^\s*(?:CONFIG_VERSION|APP_VERSION|VERSION|VER)\s*=\s*["']?([^"'\r\n,;]+)["']?\s*$/m
  ];

  for (const pattern of versionPatterns) {
    const match = config.match(pattern);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }

  return "";
}

function updateVersionMeta(updatedAt) {
  const realVersion = findConfigVersion(configInput.value);
  versionText.textContent = realVersion || "Not found";
  updatedText.textContent = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleString()}`
    : localStorage.getItem("vpn-config-updated") || "Not updated yet";
}

function activateTab(tabId, title) {
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  screenTitle.textContent = title;
}

async function loadConfig() {
  setStatus(statusEl, "Loading...");
  const response = await fetch("/api/config", { headers: tokenHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load config");
  }

  configInput.value = data.config;
  if (data.rawUrl) {
    activeRawUrl = data.rawUrl;
    rawLinkInput.value = activeRawUrl;
    openRawBtn.href = activeRawUrl;
  }
  updateConfigMeta();
  updateVersionMeta();
  setDashboard(true);
  setStatus(statusEl, "Config loaded.", "success");
}

async function saveConfig() {
  setStatus(statusEl, "Saving...");
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...tokenHeaders()
    },
    body: JSON.stringify({ config: configInput.value })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not save config");
  }

  updateConfigMeta();
  if (data.rawUrl) {
    activeRawUrl = data.rawUrl;
    rawLinkInput.value = activeRawUrl;
    openRawBtn.href = activeRawUrl;
  }
  const updatedMessage = `Updated ${new Date(data.updatedAt).toLocaleString()}`;
  localStorage.setItem("vpn-config-updated", updatedMessage);
  updateVersionMeta(data.updatedAt);
  activateTab("homeTab", "Home");
  setStatus(
    statusEl,
    `Saved ${Number(data.bytes || 0).toLocaleString()} bytes at ${new Date(data.updatedAt).toLocaleString()}.`,
    "success"
  );
}

rawLinkInput.value = activeRawUrl;
openRawBtn.href = activeRawUrl;
appUrlText.textContent = window.location.protocol === "file:" ? "Local preview" : window.location.host;
updateConfigMeta();
updateVersionMeta();

loginBtn.addEventListener("click", () => {
  if (!tokenInput.value.trim()) {
    setStatus(loginStatusEl, "Enter admin token first.", "error");
    return;
  }

  setStatus(loginStatusEl, "Checking token...");
  loadConfig()
    .then(() => setStatus(loginStatusEl, ""))
    .catch((error) => {
      if (window.location.protocol === "file:") {
        setStatus(loginStatusEl, "Open this website through the server URL, not file://.", "error");
        return;
      }
      setStatus(loginStatusEl, error.message, "error");
    });
});

tokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginBtn.click();
  }
});

reloadBtn.addEventListener("click", () => {
  loadConfig().catch((error) => setStatus(statusEl, error.message, "error"));
});

saveBtn.addEventListener("click", () => {
  saveConfig().catch((error) => setStatus(statusEl, error.message, "error"));
});

logoutBtn.addEventListener("click", () => {
  setDashboard(false);
  configInput.value = "";
  updateConfigMeta();
  setStatus(loginStatusEl, "Panel locked.", "success");
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(activeRawUrl);
  setStatus(statusEl, "Raw link copied.", "success");
});

configInput.addEventListener("input", () => {
  updateConfigMeta();
  updateVersionMeta();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab, button.dataset.title);
  });
});
