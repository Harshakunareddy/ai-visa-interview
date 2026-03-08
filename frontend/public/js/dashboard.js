/**
 * Dashboard JS — sidebar, topbar dropdown, logout
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ── Sidebar Toggle (mobile) ─────────────────────────────────
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');

    function openSidebar() {
        sidebar?.classList.add('open');
        sidebarOverlay?.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        sidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('visible');
        document.body.style.overflow = '';
    }

    sidebarToggle?.addEventListener('click', openSidebar);
    sidebarClose?.addEventListener('click', closeSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // ── Topbar Dropdown ────────────────────────────────────────
    const avatarBtn = document.getElementById('topbarAvatarBtn');
    const dropdown = document.getElementById('topbarDropdown');
    if (avatarBtn && dropdown) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = dropdown.classList.toggle('open');
            avatarBtn.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('click', () => dropdown.classList.remove('open'));
        dropdown.addEventListener('click', e => e.stopPropagation());
    }

    // ── Logout ─────────────────────────────────────────────────
    async function logout() {
        try {
            if (window.__firebaseAuth) {
                const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
                await signOut(window.__firebaseAuth);
            }
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (err) {
            console.error('Logout error:', err);
            window.location.href = '/';
        }
    }

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('logoutBtnTop')?.addEventListener('click', logout);
});
