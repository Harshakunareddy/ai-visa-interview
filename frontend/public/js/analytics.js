/**
 * Analytics Charts JS
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textClr = isDark ? '#94a3b8' : '#64748b';

    // Score trend
    const scoreCanvas = document.getElementById('scoreChart');
    if (scoreCanvas && typeof chartData !== 'undefined' && chartData.length) {
        new Chart(scoreCanvas, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.date),
                datasets: [
                    { label: 'Score', data: chartData.map(d => d.overall), borderColor: '#6366f1', fill: true, backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366f1' },
                    { label: 'Confidence', data: chartData.map(d => d.confidence), borderColor: '#a855f7', fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#a855f7' },
                    { label: 'Communication', data: chartData.map(d => d.communication), borderColor: '#06b6d4', fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#06b6d4' },
                    { label: 'Approval %', data: chartData.map(d => d.approval), borderColor: '#22c55e', fill: true, backgroundColor: 'rgba(34,197,94,0.06)', tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e' },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textClr, usePointStyle: true, padding: 16 } }, tooltip: { backgroundColor: isDark ? '#0f0f1a' : '#fff', titleColor: isDark ? '#f1f5f9' : '#0f172a', bodyColor: textClr, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 10 } },
                scales: { x: { grid: { color: grid }, ticks: { color: textClr } }, y: { min: 0, max: 100, grid: { color: grid }, ticks: { color: textClr } } },
            },
        });
    }

    // Country chart
    const countryCanvas = document.getElementById('countryChart');
    if (countryCanvas && typeof countryMap !== 'undefined') {
        const entries = Object.entries(countryMap);
        const flags = { USA: '🇺🇸', Canada: '🇨🇦', UK: '🇬🇧', Australia: '🇦🇺', Germany: '🇩🇪' };
        new Chart(countryCanvas, {
            type: 'doughnut',
            data: {
                labels: entries.map(([k]) => `${flags[k] || ''} ${k}`),
                datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#6366f1', '#a855f7', '#06b6d4', '#22c55e', '#f59e0b'], borderWidth: 2, borderColor: isDark ? '#0f0f1a' : '#fff' }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: textClr, padding: 12 } } },
            },
        });
    }

    // Verdict chart
    const verdictCanvas = document.getElementById('verdictChart');
    if (verdictCanvas && typeof verdictMap !== 'undefined') {
        const entries = Object.entries(verdictMap);
        const colors = { 'Strong Approval': '#22c55e', 'Likely Approved': '#86efac', 'Borderline': '#f59e0b', 'Likely Rejected': '#fb923c', 'Strong Rejection': '#ef4444', 'Pending': '#64748b' };
        new Chart(verdictCanvas, {
            type: 'bar',
            data: {
                labels: entries.map(([k]) => k),
                datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([k]) => colors[k] || '#6366f1'), borderRadius: 8 }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { grid: { color: grid }, ticks: { color: textClr } }, y: { grid: { color: grid }, ticks: { color: textClr } } },
            },
        });
    }
});
