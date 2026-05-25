# VPN Config Panel

Simple website for updating a VPN config online and exposing it as a raw link.

## Run locally

```powershell
$env:ADMIN_TOKEN="your-secret-token"
npm start
```

Open:

- Admin panel: `http://localhost:3000`
- Raw config link: `http://localhost:3000/raw/config`
- Alternative raw link: `http://localhost:3000/config.json`

Use the same `ADMIN_TOKEN` in the admin panel to load and save config.
Config is saved to GitHub when `GITHUB_TOKEN` and `GITHUB_REPO` are set. Otherwise it saves locally to `DATA_DIR`.

## Deploy

Deploy this Node app to Render, Railway, VPS, or any hosting that supports Node.js.
Set `ADMIN_TOKEN` in the hosting environment variables.

For GitHub-backed live updates, add these environment variables:

```text
GITHUB_TOKEN=your_github_token
GITHUB_REPO=your-github-username/vpn-config-panel
GITHUB_BRANCH=main
GITHUB_CONFIG_PATH=data/config.json
```

The GitHub token needs repository contents read/write access.

## Render

- Build command: leave blank or use `npm install`
- Start command: `npm start`
- Environment variable: `ADMIN_TOKEN=your-secret-token`
- Add `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, and `GITHUB_CONFIG_PATH`

After deploy, your raw link will be:

```text
https://your-render-app.onrender.com/raw/config
```

## Railway

- Start command: `npm start`
- Environment variable: `ADMIN_TOKEN=your-secret-token`
- Add `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, and `GITHUB_CONFIG_PATH`

After deploy, your raw link will be:

```text
https://your-railway-domain.up.railway.app/raw/config
```
