
import * as path from 'https://deno.land/std@0.82.0/path/mod.ts';
import {ensureDir} from "https://deno.land/std@0.82.0/fs/mod.ts";

import {ApogeeError} from './error.ts';

import {Site} from './site.ts';
import {Page} from './page.ts';
import {TemplateResult, templateToUnsafeString, LiteralString} from './template.ts';

type GlobalTransformCallback = (operation: string) => Promise<any>;
type TransformCallback = (page: Page, operation: string, data: any) => Promise<any>;

type RenderCallback = (page: Page, variant: string, data: any) => TemplateResult;

export class ContentHandler {

  site: Site;

  name: string;

  // Extra metadata that's automatically set on every page.
  meta: {[key: string]: any} = {};

  // A list of extensions that are handled by this handler.
  extensions: string[] = [];

  options: {[key: string]: any} = {};

  globalTransformOperations = new Map<string, GlobalTransformCallback>();
  
  transformOperations = new Map<string, TransformCallback>();
  renderVariants = new Map<string, RenderCallback>();

  constructor(site: Site, name: string, options?: {[key: string]: any}, extensions?: string[]) {
    this.site = site;
    
    this.name = name;

    this.extensions = extensions ?? [];

    this.options = options ?? {};
  }

  async _register(): Promise<void> {
    // Always add the @render operation.
    this.addTransformOperation('@render', async (page) => {
      return (this._render(page, '@page') as LiteralString).contents;
    });

    await this.register();
  }
  
  async _unregister(): Promise<void> {
    await this.unregister();
  }

  inheritPage(page: Page) {
  }

  // These functions can (and should) be overridden by the individual content handlers.
  async register(): Promise<void> {}
  async unregister(): Promise<void> {}

  // Specifies the `callback` to be run on global transforms.
  // Old callbacks will be clobbered.
  addGlobalTransformOperation(operation: string, callback: GlobalTransformCallback) {
    this.globalTransformOperations.set(operation, callback);

    this.site.ensureTransformOperation(operation.replace(/\-[pre|post]$/, ''));
  }

  addTransformOperation(operation: string, callback: TransformCallback) {
    this.transformOperations.set(operation, callback);

    this.site.ensureTransformOperation(operation);
  }

  // Adds a function to be called for the given variant.
  addRenderVariant(variant: string, callback: RenderCallback) {
    this.renderVariants.set(variant, callback);
  }

  // The `filename` is a content-root-relative filename.
  addContent(filename: string) {
    this.site.log.warn(`content handler '${this.name}' (as set in site configuration) should override 'addContent'`);
  }

  // Ingests the given page.
  async _ingest(page: Page): Promise<void> {
    this.site.log.warn(`content handler '${this.name}' (as set in site configuration) should override 'ingest'`);
  }

  async loadMetadataFile(page: Page): Promise<void> {
    try {
      let meta = await Deno.readTextFile(page.absoluteMetadataFilename);

      page.contents = meta;
      
      page.splitFrontmatter();
    } catch(err) {
      throw new ApogeeError(`could not read metadata file for '${page.sourcePath}' ('${page.absoluteMetadataFilename}')`, err);
    }
  }

  async _transformGlobal(operation: string): Promise<void> {
    if(this.globalTransformOperations.has(operation)) {
      await (this.globalTransformOperations.get(operation)!.call(this, operation));
    }
  }

  // Transform
  async _transform(page: Page, operation: string): Promise<void> {
    if(this.transformOperations.has(operation)) {
      let results = await (this.transformOperations.get(operation)!.call(this, page, operation, page.contents));

      if(results !== undefined) {
        page.contents = results;
      }
    }

    // We silently ignore transforms if we don't support them. (This is normal.)
  }

  // Render
  _render(page: Page, variant: string, data?: any): TemplateResult {
    if(this.renderVariants.has(variant)) {
      let callback = this.renderVariants.get(variant)!;
      return templateToUnsafeString(callback.call(this, page, variant, data));
    }

    this.site.log.warn(`content handler '${this.name}' has not set a render handler for the '${variant}' variant (used on '${page.sourcePath}')`)

    return '';
  }

  // Output
  async _output(page: Page): Promise<void> {
    this.site.log.warn(`content handler '${this.name}' (as set in site configuration) should override 'outputPage'`);
  }

}

// A content handler for text input and output.
// Automatically reads the content file and outputs the result of rendering 'page'.
export abstract class TextContentHandler extends ContentHandler {

  outputFilename: string = 'index.html';

  async _ingest(page: Page): Promise<void> {
    page.contents = await Deno.readTextFile(page.contentFilename);

    page.splitFrontmatter();
  }
  
  async _output(page: Page): Promise<void> {
    this.site.log.debug(`outputting page '${page.sourcePath}' to '${page.outputFilename}'`);

    await ensureDir(path.dirname(page.outputFilename));

    await Deno.writeTextFile(page.outputFilename, page.contents);
  }
  
}

// # `ContentHandlerWrangler`
//
// Manages the content handlers and keeps track of supported extensions.
export class ContentHandlerWrangler {

  // A map from the handler name to the handler itself.
  handlers = new Map<string, ContentHandler>();

  // Stores an array of mappings from extensions, including the leading '.', to the handler name.
  // This list must be sorted when new handlers are added.
  extensions: {extension: string, handlerName: string}[] = [];

  constructor() {

  }

  // Adds the handler, removing stale handlers if necessary.
  async add(handler: ContentHandler) {

    // Make sure to remove the old one.
    if(this.has(handler.name)) {
      this.remove(handler.name);
    }

    this.handlers.set(handler.name, handler);

    for(let extension of handler.extensions) {
      if(this.hasExtension(extension)) {
        throw new ApogeeError(`content handler '${handler.name}' declares existing extension '${extension}'`);
      }
      
      this.extensions.push({
        extension: extension,
        handlerName: handler.name
      });
    }

    this.extensions.sort((a, b) => {
      if(a.extension.length < b.extension.length) {
        return -1;
      } else if(a.extension.length > b.extension.length) {
        return 1;
      } else {
        return 0;
      }
    });

    await handler._register();
  }

  has(handlerName: string): boolean {
    return this.handlers.has(handlerName);
  }

  get(handlerName: string): ContentHandler {
    return this.handlers.get(handlerName)!;
  }

  async remove(handlerName: string) {
    throw new ApogeeError('not implemented');

    // await handler.unregister();
  }

  async removeAll() {
    this.handlers.clear();
    this.extensions = [];
  }

  // Returns `true` if `extension` is already registered, `false` otherwise.
  hasExtension(extension: string) {
    for(let ext of this.extensions) {
      if(ext.extension === extension) {
        return true;
      }
    }

    return false;
  }

  // Returns the handler for the given extension.
  getHandlerForExtension(extension: string): ContentHandler {
    for(let ext of this.extensions) {
      if(ext.extension === extension) {
        return this.handlers.get(ext.handlerName)!;
      }
    }

    throw new ApogeeError(`no content handler for extension '${extension}'`);
  }

  forEach(callback: (handler: ContentHandler) => Promise<any>) {
    let tasks: Promise<any>[] = [];
    
    this.handlers.forEach((handler) => {
      tasks.push(callback(handler));
    });
    
    return Promise.all(tasks);
  }
}
