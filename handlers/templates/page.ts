
import {Page, html, TemplateResult} from '../../src/index.ts';

export function pageHeader(page: Page): TemplateResult {
  
  return html`
<header class="page-header">
  <h1 class="page-header__title"><a href="${page.link('/')}">${page.site.meta.title}</a></h1>
  <a class="page-header__about" href="${page.link('/about')}">About</a>
</header>
`;
}

export function pageFooter(page: Page): TemplateResult {
  return html`
<footer class="page-footer">
  <span class="page-footer__generation-date">This page was generated from <code>${page.contentFilename}</code> by Apogee on <code>${new Date().toISOString()}</code></span>
</footer>
`;
}
