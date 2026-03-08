/**
 * Theme Manager — Dark/Light mode toggle with persistence
 * Defaults to DARK on first visit regardless of system preference.
 */
(function () {
    'use strict';

    const THEME_KEY = 'embassy_ai_theme';
    const root = document.documentElement;

    // Default to dark theme on first visit. Only use saved pref if user explicitly toggled.
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    root.setAttribute('data-theme', saved);

    function setTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    function toggleTheme() {
        const current = root.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Attach all toggle buttons after DOM loads
    document.addEventListener('DOMContentLoaded', () => {
        const toggles = document.querySelectorAll('#themeToggle, #themeToggleSidebar');
        toggles.forEach(btn => btn.addEventListener('click', toggleTheme));
    });
})();
