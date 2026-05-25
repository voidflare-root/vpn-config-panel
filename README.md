# VPN Config Panel

This panel saves the update box content directly to `data/config.json`.

No version is added. No wrapper is added. No JSON validation is done.

## Render Environment Variables

```text
ADMIN_TOKEN=your-admin-password
GITHUB_TOKEN=your-github-token
GITHUB_REPO=your-github-username/vpn-config-panel
GITHUB_BRANCH=main
GITHUB_CONFIG_PATH=data/config.json
```

`GITHUB_TOKEN` needs repository contents read/write access.

## Raw Link

Public repo:

```text
https://raw.githubusercontent.com/your-github-username/vpn-config-panel/main/data/config.json
```

Private repo raw links return 404 unless your VPN app sends GitHub authentication.
