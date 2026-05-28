# VPN Config Hub

Render-ready Node.js website for updating a VPN app config JSON file in GitHub.

## What It Does

- Password protected admin login.
- App-style UI with bottom Home and Update taskbar.
- Home shows GitHub repo, JSON file path, app update link, and current file content.
- Update tab saves only the pasted text into your GitHub repo JSON file.
- `.env` controls the login password, repo name, GitHub token, JSON path, and branch.

## Required GitHub JSON

Create this file in your GitHub repo. Default path is `data/config.json`.

```text
PASTE_CONFIG_HERE
```

When you update from the website, this file is replaced with the trimmed text from the update box. The app does not add version, date, time, or any extra JSON wrapper.

## Environment Variables

Copy `.env.example` to `.env` locally, or add these variables in Render.

```env
WEBSITE_PASSWORD=change-this-login-password
GITHUB_REPO=your-github-username/your-repo-name
GITHUB_TOKEN=github_pat_your_token_here
CONFIG_PATH=data/config.json
GITHUB_BRANCH=main
```

`GITHUB_REPO` must be in `owner/repo` format.

`GITHUB_TOKEN` needs permission to read and write repository contents.

For a classic token, use `repo` scope for private repos. For a fine-grained token, allow Contents read/write on the selected repo.

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Deploy On Render

1. Upload this folder to GitHub.
2. Create a Render Web Service.
3. Select your GitHub repo.
4. Build command:

```bash
npm install
```

5. Start command:

```bash
npm start
```

6. Add the environment variables from `.env.example`.
7. Deploy.

Your VPN app should use the app update link shown on the Home tab. It points to `/config.json` on your Render website and serves the latest GitHub `data/config.json` without cache.
