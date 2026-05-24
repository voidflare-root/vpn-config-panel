const tokenInput = document.querySelector("#token");
const configInput = document.querySelector("#config");
const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginBtn = document.querySelector("#loginBtn");
const reloadBtn = document.querySelector("#reloadBtn");
const saveBtn = document.querySelector("#saveBtn");
const copyBtn = document.querySelector("#copyBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const rawLinkInput = document.querySelector("#rawLink");
const openRawBtn = document.querySelector("#openRawBtn");
const sizeText = document.querySelector("#sizeText");
const stateText = document.querySelector("#stateText");
const loginStatusEl = document.querySelector("#loginStatus");
const statusEl = document.querySelector("#status");

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

async function loadConfig() {
  setStatus(statusEl, "Loading...");
  const response = await fetch("/api/config", { headers: tokenHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load config");
  }

  configInput.value = data.config;
  updateConfigMeta();
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
  setStatus(statusEl, `Saved at ${new Date(data.updatedAt).toLocaleString()}.`, "success");
}

rawLinkInput.value = rawUrl();
openRawBtn.href = rawUrl();
updateConfigMeta();

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
  await navigator.clipboard.writeText(rawUrl());
  setStatus(statusEl, "Raw link copied.", "success");
});

configInput.addEventListener("input", () => {
  updateConfigMeta();
});
