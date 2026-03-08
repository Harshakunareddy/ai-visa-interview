/**
 * Main JS — global interactions
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ── Mobile burger menu ──────────────────────────────────────
    const burger = document.getElementById('burgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (burger && mobileMenu) {
        burger.addEventListener('click', () => {
            const open = mobileMenu.classList.toggle('open');
            burger.classList.toggle('open', open);
            burger.setAttribute('aria-expanded', String(open));
        });
    }

    // ── Navbar scroll effect ────────────────────────────────────
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const handle = () => {
            navbar.style.background = window.scrollY > 50
                ? 'rgba(10,10,15,0.95)'
                : 'rgba(10,10,15,0.85)';
        };
        window.addEventListener('scroll', handle, { passive: true });
    }

    // ── Scroll-triggered animations ─────────────────────────────
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

    // ── Smooth scroll for anchor links ─────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
