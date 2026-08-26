/* Halo Strategic — shared site motion.
   Scroll-reveal for section content + hero diagnostic-diagram draw-in.
   No dependencies. Respects prefers-reduced-motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent =
    '.reveal{opacity:0;transform:translateY(22px);transition:opacity 700ms cubic-bezier(.4,0,.2,1),transform 700ms cubic-bezier(.4,0,.2,1);}' +
    '.reveal.is-visible{opacity:1;transform:none;}' +
    '.card,.stat,.evidence-claim{transition:box-shadow 220ms cubic-bezier(.4,0,.2,1),transform 220ms cubic-bezier(.4,0,.2,1);}' +
    '.card:hover{transform:translateY(-3px);}' +
    '.hero-line{stroke-dasharray:900;stroke-dashoffset:900;transition:stroke-dashoffset 1300ms cubic-bezier(.4,0,.2,1);}' +
    '.hero-line.is-drawn{stroke-dashoffset:0;}' +
    '.hero-node{opacity:0;transform:scale(.35);transform-origin:center;transition:opacity 450ms ease,transform 450ms cubic-bezier(.34,1.56,.64,1);}' +
    '.hero-node.is-drawn{opacity:1;transform:scale(1);}' +
    '.hero-node-constraint.is-drawn{animation:haloPulse 2600ms ease-in-out 2200ms infinite;}' +
    '@keyframes haloPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(176,141,87,0));}50%{filter:drop-shadow(0 0 7px rgba(176,141,87,.9));}}';
  document.head.appendChild(style);

  if (reduce) return;

  // Hero diagram draw-in
  var heroSvg = document.querySelector('.hero-pattern');
  if (heroSvg) {
    requestAnimationFrame(function () {
      setTimeout(function () {
        heroSvg.querySelectorAll('.hero-line, .hero-node').forEach(function (el) {
          el.classList.add('is-drawn');
        });
      }, 250);
    });
  }

  // Scroll reveal for section content blocks
  var targets = document.querySelectorAll(
    [
      'section:not(.hero) > .container',
      '.card', '.story', '.principle', '.step-row .step',
      '.evidence', '.pull', '.experience-panel', '.final-cta'
    ].join(',')
  );

  if (!('IntersectionObserver' in window) || targets.length === 0) return;

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  targets.forEach(function (el) {
    el.classList.add('reveal');
    io.observe(el);
  });
})();
