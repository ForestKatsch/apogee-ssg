
export function escapeHTML(safe: string) {
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

type LiteralString = {_literal: true, contents: string};

type HTMLTemplateItem = null | undefined | number | string | LiteralString | HTMLTemplate;

class HTMLTemplate {
  items: HTMLTemplateItem[] = [];

  push(item: HTMLTemplateItem) {
    this.items.push(item);
  }
}

export type TemplateResult = HTMLTemplate | HTMLTemplateItem;

export function unsafe(str: string): LiteralString {
  return {_literal: true, contents: str};
};

// Usage:
//
// ```
// html`<strong>${'haha, this <b> is escaped!'}</strong>`
// ```
//
export function html(...args: any[]): HTMLTemplate {
  let strings: string[] = args[0];

  let values: any[] = [...args].splice(1);

  let output = new HTMLTemplate();

  strings.forEach((part, index) => {
    output.push(unsafe(part));

    if(index < values.length) {
      output.push(values[index]);
    }
  });

  return output;
}

// Converts a template or a template item to a fully escaped string.
export function templateToString(template: TemplateResult): string {
  if(Array.isArray(template)) {
    return template.map(e => templateToString(e)).join('');
  } else if(template instanceof HTMLTemplate) {
    return template.items.map(e => templateToString(e)).join('');
  } else if(typeof template === typeof '') {
    return escapeHTML(template as string);
  } else if(typeof template === typeof 0) {
    return escapeHTML(template + '');
  } else if(typeof template === typeof {} && (template as LiteralString)._literal === true) {
    return (template as LiteralString).contents;
  } else {
    return '';
  }
}

export function templateToUnsafeString(template: TemplateResult): string {
  return unsafe(templateToString(template));
}
