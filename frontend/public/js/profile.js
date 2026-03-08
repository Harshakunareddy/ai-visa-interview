/**
 * Profile Page JS
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ── Profile form ─────────────────────────────────────────────
    const profileForm = document.getElementById('profileForm');
    const saveBtn = document.getElementById('saveProfileBtn');

    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving...';

        const fd = new FormData(profileForm);
        const body = {};
        fd.forEach((v, k) => { if (v) body[k] = v; });

        try {
            const res = await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Profile saved successfully!', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            showToast('⚠️ ' + err.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile';
        }
    });

    // ── Photo Upload ──────────────────────────────────────────────
    document.getElementById('photoUpload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('photo', file);
        const res = await fetch('/api/profile/photo', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Profile photo updated!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('⚠️ ' + data.message, 'error');
        }
    });

    // ── Resume Upload ─────────────────────────────────────────────
    document.getElementById('resumeUpload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('resume', file);
        showToast('⏳ Uploading resume...', 'info');
        const res = await fetch('/api/profile/resume', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Resume uploaded!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('⚠️ ' + data.message, 'error');
        }
    });

    function showToast(msg, type = 'info') {
        const el = document.createElement('div');
        el.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'warning'}`;
        el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;max-width:360px;animation:fadeInUp 0.3s ease';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    async function apiFetch(url, opts = {}) {
        return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, credentials: 'include' });
    }
});
