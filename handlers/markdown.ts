
// Normally, this line would be the following:
//
// ```
// import {Page, TextContentHandler} from "https://<host>/apogee-ssg@^1.0.0";
// ```
//
// But here, we want to use the built-in files alongside the repository.
import {Page, TextContentHandler, html, TemplateResult} from '../src/index.ts';

import {htmlPage} from './templates/html.ts';
import {pageHeader, pageFooter} from './templates/page.ts';
import {markdown} from './templates/markdown.ts';

export default class MarkdownContentHandler extends TextContentHandler {

  async register() {
    // Tell Apogee how we want to be rendered.
    this.addRenderVariant('@page', this.renderPage);
  }

  // Called with each content file we're supposed to handle.
  addContent(filename: string) {
    // Create our page! Our beautiful, beautiful page!
    this.site.createPageFromFilename(filename, this);
  }
  
  renderPage(page: Page): TemplateResult {
    return htmlPage({
      page: page,
      
      head: html``,
      body: html`
${pageHeader(page)}
<main class="page-main">
  <section class="text">${markdown(page.contents)}</section>
</main>
${pageFooter(page)}
`
    });
  }

}
