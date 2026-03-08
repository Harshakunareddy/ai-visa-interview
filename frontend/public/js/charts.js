/**
 * Charts JS — powered by Chart.js
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ── Timeline Chart ────────────────────────────────────────
    const canvas = document.getElementById('timelineChart');

    // Check if timelineData exists (it should be injected in the template)
    if (!canvas || typeof window.timelineData === 'undefined' || !Array.isArray(window.timelineData) || window.timelineData.length === 0) {
        return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Prepare data
    const labels = window.timelineData.map(d => d.date);
    const scoreData = window.timelineData.map(d => d.score);
    const approvalData = window.timelineData.map(d => d.approval);

    // If only one data point, add a slight offset so the chart shows the point clearly
    // or just ensure the point is visible with pointRadius

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Overall Score',
                    data: scoreData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: isDark ? '#0a0a0f' : '#fff',
                    pointBorderWidth: 2,
                },
                {
                    label: 'Approval %',
                    data: approvalData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: isDark ? '#0a0a0f' : '#fff',
                    pointBorderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e1e2d' : '#fff',
                    titleColor: isDark ? '#fff' : '#0a0a0f',
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 4,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + (context.datasetIndex === 1 ? '%' : '');
                            }
                            return label;
                        }
                    }
                },
            },
            scales: {
                x: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: textColor, padding: 10 },
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        color: textColor,
                        padding: 10,
                        stepSize: 20,
                        callback: (value) => value + '%'
                    },
                },
            },
        },
    };

    // If only one data point, adjust x-axis to center it
    if (labels.length === 1) {
        chartConfig.options.scales.x.offset = true;
    }

    try {
        new Chart(canvas, chartConfig);
    } catch (err) {
        console.error('Error creating Chart.js instance:', err);
    }
});
