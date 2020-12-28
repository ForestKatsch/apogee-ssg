
import marked from 'https://cdn.skypack.dev/marked@1.2.7';
import {TemplateResult, unsafe} from '../../src/index.ts';

export function markdown(md: string): TemplateResult {
  return unsafe(marked(md));
}
