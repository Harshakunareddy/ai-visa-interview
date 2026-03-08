/**
 * Setup Admin JS — Tab-based navigation
 * Handles: tab switching, save sections, test connections,
 * reveal secrets, generate secrets, token actions, progress,
 * toasts, and theme detection.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {

    // ── Theme ────────────────────────────────────────────────────────────────
    const savedTheme = localStorage.getItem('embassy_ai_theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);

    // ── Tab Navigation ───────────────────────────────────────────────────────
    const tabs = document.querySelectorAll('.setup-tab');
    const sections = document.querySelectorAll('.config-section');

    function activateTab(tabId) {
        // Update tab buttons
        tabs.forEach(t => {
            const isActive = t.dataset.tab === tabId;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        // Update panels
        sections.forEach(s => {
            const isActive = s.dataset.section === tabId;
            s.classList.toggle('active', isActive);
        });

        // Remember last active tab
        try { sessionStorage.setItem('setup_active_tab', tabId); } catch (_) { }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    // Restore last active tab on load
    try {
        const last = sessionStorage.getItem('setup_active_tab');
        if (last && document.querySelector(`.setup-tab[data-tab="${last}"]`)) {
            activateTab(last);
        }
    } catch (_) { }

    // ── Dismiss Welcome Banner ───────────────────────────────────────────────
    document.getElementById('closeBanner')?.addEventListener('click', () => {
        const banner = document.getElementById('welcomeBanner');
        if (banner) {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-8px)';
            banner.style.transition = 'all 0.3s ease';
            setTimeout(() => banner.remove(), 300);
        }
    });

    // ── Save Section ──────────────────────────────────────────────────────────
    document.querySelectorAll('.save-section-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const section = btn.dataset.section;
            const sectionEl = document.getElementById(`section-${section}`);
            if (!sectionEl) return;

            // Collect all inputs in this section
            const inputs = sectionEl.querySelectorAll('input, select, textarea');
            const payload = {};
            inputs.forEach(inp => {
                const name = inp.name?.trim();
                if (!name) return;

                if (inp.type === 'checkbox') {
                    payload[name] = inp.checked;
                } else {
                    const val = inp.value?.trim();
                    if (val !== undefined) payload[name] = val;
                }
            });

            if (Object.keys(payload).length === 0) {
                showToast('⚠️ No fields filled. Please enter at least one value.', 'warning');
                return;
            }

            const oldText = btn.textContent;
            btn.classList.add('loading');
            btn.disabled = true;
            btn.textContent = 'Saving…';

            try {
                const res = await fetch(`/setup/section/${section}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });
                const data = await res.json();

                if (data.success) {
                    showToast(`✅ ${capitalize(section)} configuration saved!`, 'success');
                    markSectionDone(section, true);
                    if (data.allConfigured) updateProgress(100);
                } else {
                    throw new Error(data.message || 'Save failed');
                }
            } catch (err) {
                showToast(`⚠️ ${err.message}`, 'error');
            } finally {
                btn.classList.remove('loading');
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    });

    // ── Test Connection Buttons ───────────────────────────────────────────────
    document.querySelectorAll('.test-service-btn').forEach(btn => {
        btn.addEventListener('click', () => testService(btn.dataset.service));
    });

    async function testService(service) {
        showToast(`🔌 Testing ${service} connection…`, 'info');
        try {
            const res = await fetch(`/setup/test/${service}`, { credentials: 'include' });
            const data = await res.json();
            const r = data.result;

            // Update topbar dot
            const dot = document.getElementById(`dot-${service}`);
            if (dot) dot.className = `status-dot-sm ${r.ok ? 'dot-green' : 'dot-red'}`;

            showToast(
                r.ok ? `✅ ${r.msg}` : `❌ ${service}: ${r.msg}`,
                r.ok ? 'success' : 'error'
            );
        } catch (err) {
            showToast(`❌ Test failed: ${err.message}`, 'error');
        }
    }

    // ── Reveal / Hide Secret Fields ───────────────────────────────────────────
    document.querySelectorAll('.reveal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrap = btn.closest('.secret-input-wrap');
            const input = wrap?.querySelector('input, textarea');
            if (input && input.tagName === 'INPUT') {
                const hidden = input.type === 'password';
                input.type = hidden ? 'text' : 'password';
                btn.textContent = hidden ? '🙈' : '👁';
            }
        });
    });

    // ── Auto-generate Secrets ─────────────────────────────────────────────────
    document.querySelectorAll('.generate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetName = btn.dataset.target;
            const input = document.querySelector(`input[name="${targetName}"]`);
            if (input) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}';
                const secret = Array.from({ length: 40 }, () =>
                    chars[Math.floor(Math.random() * chars.length)]
                ).join('');
                input.value = secret;
                input.type = 'text';
                showToast('⚡ Secret generated! Click Save to store it.', 'info');
            }
        });
    });

    // ── Copy Admin Token ──────────────────────────────────────────────────────
    document.getElementById('copyTokenBtn')?.addEventListener('click', async () => {
        const token = document.getElementById('adminTokenDisplay')?.textContent?.trim();
        if (token && token !== '—' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(token);
                const btn = document.getElementById('copyTokenBtn');
                const old = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => { btn.textContent = old; }, 2000);
                showToast('📋 Admin token copied to clipboard!', 'info');
            } catch (_) {
                showToast('❌ Could not copy token — check browser permissions', 'error');
            }
        } else {
            showToast('ℹ️ No token available yet', 'info');
        }
    });

    // ── Regenerate Token ──────────────────────────────────────────────────────
    document.getElementById('regenTokenBtn')?.addEventListener('click', async () => {
        if (!confirm('Regenerate the admin token? The old token will stop working immediately.')) return;
        try {
            const res = await fetch('/setup/regenerate-token', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                const display = document.getElementById('adminTokenDisplay');
                if (display) display.textContent = data.token;
                showToast('🔑 Admin token regenerated. Copy and save the new one!', 'warning');
            }
        } catch (err) {
            showToast('❌ Failed to regenerate token', 'error');
        }
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function markSectionDone(section, done) {
        // Update badge inside the section card
        const badge = document.getElementById(`badge-${section}`);
        if (badge) {
            badge.className = `section-badge ${done ? 'done' : 'pending'}`;
            badge.textContent = done ? '✓ Configured' : 'Not Set';
        }

        // Update dot on the tab button
        const tabDot = document.getElementById(`tab-status-${section}`);
        if (tabDot) {
            tabDot.className = `tab-status-dot ${done ? 'dot-done' : 'dot-pending'}`;
        }

        // Recalculate overall completion
        const allBadges = document.querySelectorAll('.section-badge');
        const doneBadges = document.querySelectorAll('.section-badge.done');
        const pct = allBadges.length
            ? Math.round((doneBadges.length / allBadges.length) * 100)
            : 0;
        updateProgress(pct);
    }

    function updateProgress(pct) {
        const fill = document.getElementById('progressFill');
        const pctEl = document.getElementById('completionPct');
        const chip = document.querySelector('.completion-chip');

        if (fill) fill.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
        if (chip) {
            chip.textContent = pct === 100 ? '✅ All Set' : `${pct}% Done`;
            chip.classList.toggle('complete', pct === 100);
        }
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ── Toast Notifications ───────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const stack = document.getElementById('toastStack');
        if (!stack) return;

        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
        toast.addEventListener('click', () => dismissToast(toast));
        stack.appendChild(toast);

        setTimeout(() => dismissToast(toast), 4500);
    }

    function dismissToast(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }

});
