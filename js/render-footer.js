/**
 * render-footer.js — builds and injects the footer from FOOTER_CONFIG.
 * Called once on DOMContentLoaded. Works on both the home and series pages.
 */

import { FOOTER_CONFIG } from './footer.js';

export function renderFooter() {
  const cfg  = FOOTER_CONFIG;
  const brand = cfg.brand;

  const currentYear = new Date().getFullYear();
  const yearRange   = currentYear > brand.year
    ? `${brand.year}–${currentYear}`
    : `${brand.year}`;

  // ── Columns ──────────────────────────────────────────────────
  const colsHtml = (cfg.columns || []).map(col => `
    <div class="ft-col">
      <div class="ft-col-heading">${col.heading}</div>
      <ul class="ft-col-links">
        ${(col.links || []).map(link => {
          const ext = link.external
            ? ' target="_blank" rel="noopener noreferrer"'
            : '';
          const extIcon = link.external ? '<span class="ft-ext-icon">↗</span>' : '';
          return `<li><a href="${link.href}"${ext}>${link.label}${extIcon}</a></li>`;
        }).join('')}
      </ul>
    </div>
  `).join('');

  // ── Disclaimer ───────────────────────────────────────────────
  const disclaimerHtml = cfg.disclaimer
    ? `<p class="ft-disclaimer">${cfg.disclaimer}</p>`
    : '';

  // ── Full footer ──────────────────────────────────────────────
  const footer = document.createElement('footer');
  footer.id = 'site-footer';
  footer.innerHTML = `
    <div class="ft-inner">
      <div class="ft-top">
        <div class="ft-brand">
          <span class="ft-brand-logo-wrap"><img class="ft-brand-logo" src="/assets/img/logo.png" alt="${brand.name}"></span>
          <span class="ft-brand-tagline">${brand.tagline}</span>
          <span class="ft-origin">${brand.origin}</span>
        </div>
        <div class="ft-divider"></div>
        <div class="ft-cols">${colsHtml}</div>
      </div>
      <div class="ft-bottom">
        ${disclaimerHtml}
        <p class="ft-copy">© ${yearRange} ${brand.name} — Open source under the MIT License.</p>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
}
