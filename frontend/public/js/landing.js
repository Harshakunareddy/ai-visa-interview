/**
 * Landing page JS
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ── Animated score bars on hero load ─────────────────────────
    setTimeout(() => {
        document.querySelectorAll('.score-fill').forEach(fill => {
            const width = fill.style.width;
            fill.style.width = '0%';
            requestAnimationFrame(() => {
                fill.style.transition = 'width 1.5s cubic-bezier(0.4,0,0.2,1)';
                fill.style.width = width;
            });
        });
    }, 600);

    // ── Mock timer countdown ──────────────────────────────────────
    let t = 300;
    const timerEl = document.querySelector('.interview-timer');
    if (timerEl) {
        setInterval(() => {
            t = Math.max(0, t - 1);
            if (t <= 0) t = 300;
            const m = Math.floor(t / 60);
            const s = t % 60;
            timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 1000);
    }
});
