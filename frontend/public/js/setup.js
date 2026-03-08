/**
 * Interview Setup JS
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('interviewSetupForm');
    const requestBtn = document.getElementById('requestPermBtn');
    const permStatus = document.getElementById('permissionStatus');
    const previewVid = document.getElementById('previewVideo');
    const startBtn = document.getElementById('startBtn');
    const isDemo = document.getElementById('isDemoFlag')?.value === 'true';
    let stream = null;

    // Ensure button is disabled on load
    if (startBtn) startBtn.disabled = true;

    // Check if permission was already granted previously
    async function checkPermissions() {
        try {
            const result = await navigator.permissions.query({ name: 'camera' });
            if (result.state === 'granted') {
                // If granted, try to auto-start stream
                initCamera();
            }
            result.onchange = () => {
                if (result.state === 'granted') initCamera();
            };
        } catch (e) {
            console.log('Permissions API not fully supported');
        }
    }

    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (previewVid) {
                previewVid.srcObject = stream;
                previewVid.style.display = 'block';
            }
            if (permStatus) permStatus.style.display = 'none';
            if (startBtn) startBtn.disabled = false;
        } catch (err) {
            console.error('Camera/mic access failed:', err);
            if (permStatus) {
                permStatus.innerHTML = `
                    <div class="perm-icon">🚫</div>
                    <p style="color:var(--danger)">Access denied. Please enable camera/mic in browser settings.</p>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="location.reload()">Retry</button>
                `;
            }
        }

    }

    checkPermissions();


    // ── Camera Permission ───────────────────────────────────────
    requestBtn?.addEventListener('click', () => {
        initCamera();
    });


    // ── Form Submit ─────────────────────────────────────────────
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        startBtn.disabled = true;
        startBtn.textContent = '⏳ Creating session...';

        const fd = new FormData(form);
        const country = fd.get('targetCountry');
        const visa = fd.get('visaType');

        try {
            const endpoint = isDemo ? '/demo/create' : '/api/interview/create';
            const res = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({ targetCountry: country, visaType: visa }),
            });

            const data = await res.json();
            if (data.success) {
                // Stop preview stream before navigating
                stream?.getTracks().forEach(t => t.stop());
                const redirectPath = isDemo ? `/demo/room/${data.data.sessionId}` : `/interview/${data.data.sessionId}`;
                window.location.href = redirectPath;
            } else {

                throw new Error(data.message);
            }
        } catch (err) {
            showAlert(err.message || 'Failed to create interview session');
            startBtn.disabled = false;
            startBtn.textContent = '🚀 Start Interview →';
        }
    });

    function showAlert(msg) {
        let el = document.querySelector('.setup-alert');
        if (!el) {
            el = document.createElement('div');
            el.className = 'alert alert-error setup-alert';
            form.prepend(el);
        }
        el.textContent = '⚠️ ' + msg;
        setTimeout(() => el.remove(), 5000);
    }
});

/** Authenticated fetch helper */
async function apiFetch(url, opts = {}) {
    return fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        credentials: 'include',
    });
}
