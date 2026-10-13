/* Halo Strategic — shared site motion.
   Scroll-reveal for section content blocks.
   No dependencies. Respects prefers-reduced-motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent =
    '.reveal{opacity:0;transform:translateY(22px);transition:opacity 700ms cubic-bezier(.4,0,.2,1),transform 700ms cubic-bezier(.4,0,.2,1);}' +
    '.reveal.is-visible{opacity:1;transform:none;}' +
    '.card,.stat,.evidence-claim{transition:box-shadow 220ms cubic-bezier(.4,0,.2,1),transform 220ms cubic-bezier(.4,0,.2,1);}' +
    '.card:hover{transform:translateY(-3px);}';
  document.head.appendChild(style);

  if (reduce) return;

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
    { threshold: 0, rootMargin: '0px 0px -10% 0px' }
  );

  targets.forEach(function (el) {
    var rect = el.getBoundingClientRect();
    var alreadyVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
    if (!alreadyVisible) {
      el.classList.add('reveal');
    }
    io.observe(el);
  });
})();
