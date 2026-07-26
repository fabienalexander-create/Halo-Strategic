/*
 * Halo Strategic — Pricing Configuration
 * Sprint 5.6. Single source of truth for product prices shown across the site.
 *
 * To change a price: edit the `display` value below and redeploy. No HTML edits needed.
 * To add a currency (e.g. GBP): add a new key under `currencies` with the same shape as
 * USD, then set `activeCurrency` to it, or extend the detection logic below. No GBP
 * figures are set yet, Fabien has only approved USD pricing so far (Sprint 5.6);
 * inventing a converted GBP figure here would misrepresent an undecided price as final.
 */
window.HALO_PRICING = {
  activeCurrency: 'USD',
  currencies: {
    USD: {
      healthCheck: { display: 'Free' },
      diagnostic: { display: '$995' },
      audit: { display: '$7,500+', note: 'scope-dependent' }
    }
  }
};

document.addEventListener('DOMContentLoaded', function () {
  var cfg = window.HALO_PRICING;
  var currency = cfg.currencies[cfg.activeCurrency];
  if (!currency) return;
  document.querySelectorAll('[data-price]').forEach(function (el) {
    var key = el.getAttribute('data-price');
    if (currency[key] && currency[key].display) {
      el.textContent = currency[key].display;
    }
  });
});
