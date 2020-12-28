
import {Page, html, TemplateResult} from '../../src/index.ts';

type HTMLTemplateParameters = {
  page: Page,
  title?: string,
  head?: TemplateResult,
  body: TemplateResult
};

export function htmlPage({
  page,
  title = undefined,
  head = undefined,
  body
}: HTMLTemplateParameters): TemplateResult {
  
  return html`
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="${page.static('style.css')}" />
    <title>${title ?? page.meta.title}</title>
${head}
  </head>
  <body>
${body}
  </body>
</html>
`;
}
