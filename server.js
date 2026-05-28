const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const PASSWORD = process.env.WEBSITE_PASSWORD || process.env.PASSWORD || 'admin123';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const CONFIG_PATH = (process.env.CONFIG_PATH || 'data/config.json').replace(/^\/+/, '');
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || '';

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function assertGithubConfig() {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
        const missing = [];
        if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
        if (!GITHUB_REPO) missing.push('GITHUB_REPO');
        const err = new Error(`Missing ${missing.join(', ')} in .env`);
        err.status = 500;
        throw err;
    }

    if (!/^[^/\s]+\/[^/\s]+$/.test(GITHUB_REPO)) {
        const err = new Error('GITHUB_REPO must be in owner/repo format');
        err.status = 500;
        throw err;
    }
}

function githubHeaders() {
    return {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'vpn-config-panel'
    };
}

function githubContentUrl() {
    const encodedPath = CONFIG_PATH.split('/').map(encodeURIComponent).join('/');
    return `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}`;
}

function branchQuery() {
    return GITHUB_BRANCH ? `?ref=${encodeURIComponent(GITHUB_BRANCH)}` : '';
}

function rawConfigUrl() {
    const branch = GITHUB_BRANCH || 'main';
    const encodedPath = CONFIG_PATH.split('/').map(encodeURIComponent).join('/');
    return `https://raw.githubusercontent.com/${GITHUB_REPO}/${encodeURIComponent(branch)}/${encodedPath}`;
}

function appRawUrl(req) {
    return `${req.protocol}://${req.get('host')}/config.json`;
}

function encodeBase64(text) {
    return Buffer.from(text, 'utf8').toString('base64');
}

function decodeBase64(text) {
    return Buffer.from(text || '', 'base64').toString('utf8');
}

async function githubRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...githubHeaders(),
            ...(options.headers || {})
        }
    });

    const responseText = await response.text();
    let data = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { message: responseText };
        }
    }

    if (!response.ok) {
        const message = data?.message || `GitHub request failed with ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.github = data;
        throw err;
    }

    return data;
}

async function getGithubFile() {
    assertGithubConfig();
    return githubRequest(`${githubContentUrl()}${branchQuery()}`);
}

async function getCurrentConfig() {
    const file = await getGithubFile();
    const content = decodeBase64(file.content);

    return {
        data: { config: content },
        sha: file.sha
    };
}

async function saveConfig(configText, sha) {
    const body = {
        message: 'Update VPN config',
        content: encodeBase64(configText)
    };

    if (sha) {
        body.sha = sha;
    }

    if (GITHUB_BRANCH) {
        body.branch = GITHUB_BRANCH;
    }

    return githubRequest(githubContentUrl(), {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

app.get('/api/meta', (req, res) => {
    res.json({
        repo: GITHUB_REPO || '-',
        configPath: CONFIG_PATH,
        branch: GITHUB_BRANCH || 'main',
        rawLink: appRawUrl(req),
        githubRawLink: GITHUB_REPO ? rawConfigUrl() : ''
    });
});

app.get('/api/config', async (req, res) => {
    try {
        const { data } = await getCurrentConfig();
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({
            config: '',
            error: err.message || 'Failed to load GitHub config'
        });
    }
});

app.get('/config.json', async (req, res) => {
    try {
        const { data } = await getCurrentConfig();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send(data.config);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Config not found' });
    }
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (password === PASSWORD) {
        res.json({ success: true });
        return;
    }

    res.status(401).json({ success: false, message: 'Invalid password' });
});

app.post('/api/update', async (req, res) => {
    const { password, config } = req.body;

    if (password !== PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!config || !String(config).trim()) {
        return res.status(400).json({ success: false, message: 'Config text is required' });
    }

    try {
        let sha = null;

        try {
            const current = await getCurrentConfig();
            sha = current.sha;
        } catch (err) {
            if (err.status !== 404) throw err;
        }

        const configText = String(config).trim();
        await saveConfig(configText, sha);
        res.json({ success: true, data: { config: configText }, rawLink: appRawUrl(req) });
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Failed to update GitHub configuration'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
