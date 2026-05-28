let sessionPassword = '';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginBtn = document.getElementById('loginBtn');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

const lblRepo = document.getElementById('lblRepo');
const lblPath = document.getElementById('lblPath');
const configPreview = document.getElementById('configPreview');
const rawLinkInput = document.getElementById('rawLinkInput');
const copyBtn = document.getElementById('copyBtn');

const configInput = document.getElementById('configInput');
const updateBtn = document.getElementById('updateBtn');
const updateMessage = document.getElementById('updateMessage');

loadMeta();

// --- Login Logic ---
loginBtn.addEventListener('click', async () => {
    const pwd = passwordInput.value;
    if (!pwd) return;
    
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    loginBtn.disabled = true;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        
        if (data.success) {
            sessionPassword = pwd;
            loginScreen.classList.remove('active');
            appScreen.classList.add('active');
            fetchCurrentConfig();
        } else {
            loginError.textContent = 'Incorrect password!';
        }
    } catch (err) {
        loginError.textContent = 'Server error.';
    } finally {
        loginBtn.innerHTML = 'Login';
        loginBtn.disabled = false;
    }
});

// Allow Enter key on password input
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// --- Tab Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        tabContents.forEach(tab => tab.classList.remove('active'));
        
        // Add active class to clicked
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        
        // If switching to home, refresh data
        if(targetId === 'homeTab') {
            fetchCurrentConfig();
        }
    });
});

// --- Fetch Config Logic ---
async function fetchCurrentConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to load config');
        }
        
        configPreview.textContent = data.config || '--';
    } catch (err) {
        configPreview.textContent = '--';
        console.error(err);
    }
}

async function loadMeta() {
    try {
        const res = await fetch('/api/meta');
        const meta = await res.json();

        lblRepo.textContent = meta.repo || '--';
        lblPath.textContent = `${meta.branch || 'main'} / ${meta.configPath || 'config.json'}`;
        rawLinkInput.value = meta.rawLink || (window.location.origin + '/config.json');
    } catch (err) {
        lblRepo.textContent = '--';
        lblPath.textContent = '--';
        rawLinkInput.value = window.location.origin + '/config.json';
    }
}

// --- Update Config Logic ---
updateBtn.addEventListener('click', async () => {
    const newConfig = configInput.value;
    
    if(!newConfig.trim()) {
        showMessage('Please paste update text.', 'error');
        return;
    }

    updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    updateBtn.disabled = true;

    try {
        const res = await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                password: sessionPassword,
                config: newConfig
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showMessage('Configuration updated successfully!', 'success');
            configInput.value = ''; // clear input after success
            fetchCurrentConfig();
            loadMeta();
        } else {
            showMessage(data.message || 'Update failed', 'error');
        }
    } catch (err) {
        showMessage('Server connection error.', 'error');
    } finally {
        updateBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Update Configuration';
        updateBtn.disabled = false;
    }
});

function showMessage(msg, type) {
    updateMessage.textContent = msg;
    updateMessage.className = 'msg ' + type;
    setTimeout(() => {
        updateMessage.textContent = '';
    }, 3000);
}

// --- Copy Raw Link Logic ---
copyBtn.addEventListener('click', () => {
    rawLinkInput.select();
    document.execCommand('copy');
    
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
    }, 2000);
});
