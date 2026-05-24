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
- Alternative raw link: `http://localhost:3000/config.txt`

Use the same `ADMIN_TOKEN` in the admin panel to load and save config.
Config is saved inside `DATA_DIR`. For local use, it defaults to `./data`.

## Deploy

Deploy this Node app to Render, Railway, VPS, or any hosting that supports Node.js.
Set `ADMIN_TOKEN` in the hosting environment variables.
For production, use a persistent disk or volume and set `DATA_DIR` to that mounted path.

## Render

- Build command: leave blank or use `npm install`
- Start command: `npm start`
- Environment variable: `ADMIN_TOKEN=your-secret-token`
- Optional persistent disk mount path: `/var/data`
- Environment variable for persistent storage: `DATA_DIR=/var/data`

After deploy, your raw link will be:

```text
https://your-render-app.onrender.com/raw/config
```

## Railway

- Start command: `npm start`
- Environment variable: `ADMIN_TOKEN=your-secret-token`
- Optional volume mount path: `/data`
- Environment variable for persistent storage: `DATA_DIR=/data`

After deploy, your raw link will be:

```text
https://your-railway-domain.up.railway.app/raw/config
```
