
import marked from 'https://cdn.skypack.dev/marked@1.2.7';
import {unsafe} from '../../src/index.ts';

export function markdown(md: string): string {
  return unsafe(marked(md));
}
