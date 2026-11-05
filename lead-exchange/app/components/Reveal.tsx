'use client';

import { useEffect } from 'react';

// Adds a gentle fade-up to any element marked data-reveal as it scrolls into view.
// Content is fully visible by default: elements are only hidden once this runs and adds
// .reveal-ready to <html>, so if JavaScript fails nothing disappears. Visitors with
// prefers-reduced-motion get no hiding and no animation at all.
export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.documentElement.classList.add('reveal-ready');
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      document.documentElement.classList.remove('reveal-ready');
    };
  }, []);

  return null;
}
