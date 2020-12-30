
import * as path from 'https://deno.land/std@0.82.0/path/mod.ts';
import {walk, copy, exists, ensureDir} from 'https://deno.land/std@0.82.0/fs/mod.ts';

import toml from 'https://cdn.skypack.dev/toml@3.0.0';
import _ from 'https://cdn.skypack.dev/lodash@4.17.19';

import {Logger, ConsoleTransport} from './util/log.ts';
import {ApogeeError} from './error.ts';

import {Page, PageCriteria} from './page.ts';

import {ContentHandler, ContentHandlerWrangler} from './handler.ts';

export type SiteMetadata = {
  title: string
};

// # Config

export type Config = {
  site: SiteMetadata,

  handlers: {[handlerName: string]: {
    extensions: string[],
    handler: string,
    options?: {[key: string]: any}
  }},

  transform: {
    operations: string[]
  },

  static: {
    path: string,
    output: string,
    copy: boolean
  },
  
  content: {
    path: string
  },

  output: {
    path: string
  }
}

// # Site

export class Site {

  log: Logger;

  // Our site configuration.
  config: Config;

  // A map of all handlers for our content pages.
  handlers = new ContentHandlerWrangler();

  // Contains every page.
  pages = new Map<string, Page>();
  
  constructor(logger?: Logger) {

    this.log = logger || new Logger([
      new ConsoleTransport()
    ]);

    this.config = {

      site: {
        title: 'My Apogee Site',
      },

      // The location of static files.
      static: {
        path: 'static',
        output: 'static',
        copy: true
      },

      handlers: {
      },

      // Settings relating to the ingestion of content.
      content: {
        path: 'content'
      },

      transform: {
        operations: []
      },

      output: {
        path: 'dist'
      }
    };

  }

  get meta(): SiteMetadata {
    return this.config.site;
  }

  get contentRoot(): string {
    return path.resolve(Deno.cwd(), this.config.content.path);
  }

  get outputRoot(): string {
    return path.resolve(Deno.cwd(), this.config.output.path);
  }

  get staticRoot(): string {
    return path.resolve(Deno.cwd(), this.config.static.path);
  }

  get staticOutputRoot(): string {
    return path.join(this.outputRoot, this.config.static.output);
  }

  // Returns a list of pages that match `criteria`.
  getPages(criteria?: PageCriteria): Page[] {
    let pages = [...this.pages.values()]
                  .sort((a, b) => {
                    if(a.meta.publishDate.getTime() < b.meta.publishDate.getTime()) {
                      return 1;
                    } else if(a.meta.publishDate.getTime() > b.meta.publishDate.getTime()) {
                      return -1;
                    } else {
                      return 0;
                    }
                  })
                  .filter((page) => !page.meta.static);

    if(criteria) {
      if(criteria.include) {
        pages = pages.filter((page) => page.matchesFilter(criteria.include));
      }
      
      if(criteria.exclude) {
        pages = pages.filter((page) => !page.matchesFilter(criteria.exclude));
      }
    }
    
    return pages;
  }

  getPage(path: string): Page {
    if(!this.pages.has(path)) {
      throw new ApogeeError(`no page with path '${path}'`);
    }
    return this.pages.get(path);
  }

  getPageFrom(page: Page, pagePath: string): Page {
    return this.getPage(path.resolve(path.join(page.path, '/'), pagePath));
  }

  getHandler(handlerName: string): ContentHandler {
    if(!this.handlers.has(handlerName)) {
      throw new ApogeeError(`cannot find handler named '${handlerName}' (is it defined in the site configuration?)`);
    }

    return this.handlers.get(handlerName);
  }

  // Loads a TOML config from `configFilename` and applies it to the config object.
  async loadConfig(configFilename: string) {
    const configRoot = path.dirname(configFilename);

    if((await Deno.permissions.request({ name: 'read', path: configRoot })).state !== 'granted') {
      throw new ApogeeError(`configuration file read permission denied; make sure to allow read access to the configuration file`);
    }

    this.log.debug(`loading config file '${configFilename}'`);

    let configContents: string = '';
    try {
      configContents = await Deno.readTextFile(configFilename);
    } catch(err) {
      throw new ApogeeError(`could not open configuration file '${configFilename}' for reading`, err);
    }

    try {
      let config = toml.parse(configContents);

      this.config = _.merge(this.config, config);
    } catch(err) {
      throw new ApogeeError(`could not parse configuration file '${configFilename}' at [${err.line}:${err.column}]: ${err.message}`);
    }

    // Request permissions to read from the main repository.
    if((await Deno.permissions.request({ name: 'read', path: this.contentRoot })).state !== 'granted') {
      throw new ApogeeError(`content directory read permission denied; make sure to allow read access to the content directory`);
    }
    
    // And permissions to write to the output folder.
    if((await Deno.permissions.request({ name: 'write', path: this.outputRoot })).state !== 'granted') {
      throw new ApogeeError(`output directory write permission denied; make sure to allow write access to the output directory`);
    }

    // Update content handlers.

    // TODO: properly handle hot-reloading all handlers instead of brute-force unloading/reloading.
    await this.handlers.removeAll();
    await this.removeAllPages();

    const handlerCount = Object.keys(this.config.handlers).length;

    // Add all the handlers. See above TODO.
    this.log.debug(`importing ${handlerCount} ${handlerCount === 1 ? 'handler' : 'handlers'} (this may take a few moments.)`);
    
    for(let handlerName of Object.keys(this.config.handlers)) {
      let handlerConfig = this.config.handlers[handlerName];
      
      let handlerModulePath = handlerConfig.handler;
      handlerModulePath = 'file://' + path.resolve(configRoot, handlerModulePath);
    
      let extensions = handlerConfig.extensions;
      let options = handlerConfig.options || {};

      this.log.debug(`importing handler '${handlerName}' from '${handlerModulePath}'`);

      let handler = new (await import(handlerModulePath)).default(this, handlerName, options, extensions);

      this.handlers.add(handler);
    }

    this.ensureTransformOperation('@render');
  }

  //
  // # Pages
  //

  async removeAllPages() {
    this.pages.clear();
  }

  // `contentFilename` here is relative to `contentRoot` already.
  createPageFromFilename(contentFilename: string, handler: ContentHandler): Page {
    return this.createPage(this.getPathFromFilename(contentFilename), handler, contentFilename);
  }

  // Given a content filename relative to `contentRoot`, returns the output path.
  //
  // For example, 'index.md' returns '/', and 'foo/bar/baz.gif' would return 'foo/bar/baz'.
  getPathFromFilename(contentFilename: string) {
    let p = path.parse(contentFilename);
    
    if(p.name === 'index') {
      return path.join('/', p.dir);
    } else {
      return path.join('/', p.dir, p.name);
    }
  }

  createPage(outputPath: string, handler: ContentHandler, contentFilename?: string): Page {
    if(this.pages.has(outputPath)) {
      throw new ApogeeError(`cannot add duplicate page '${outputPath}'`);
    }
    
    let page = new Page(this, outputPath, handler, contentFilename);

    this.pages.set(page.path, page);

    return page;
  }

  //
  // # Content
  //

  // Returns the list of files relative to the content root.
  async collectContentFiles(): Promise<string[]> {
    let filenames = await this.collect(this.contentRoot);

    // Filter out any file we don't know how to handle extension-wise.
    filenames = filenames.filter((filename) => {
      let extension = path.extname(filename);
      
      return this.handlers.hasExtension(extension);
    })
      .map((filename) => path.join('/', path.relative(this.contentRoot, filename)));

    return filenames;
  }

  //
  // # Collecting files
  //

  // Resolves with a list of all files in the directory, recursively, with absolute paths.
  // `rootDirectory` must be an absolute path.
  async collect(rootDirectory: string): Promise<string[]> {
    if(!path.isAbsolute(rootDirectory)) {
      throw new ApogeeError(`Site.rootDirectory path must be absolute`);
    }

    const files: string[] = [];

    for await (let entry of walk(rootDirectory, { includeDirs: false })) {
      files.push(entry.path);
    }

    return files;
  }

  //
  // # Copy static files
  //

  async copyStatic(): Promise<void> {
    if(!this.config.static.copy) {
      return;
    }

    if(!await exists(this.staticRoot)) {
      this.log.info(`static file directory '${this.staticRoot}' is not a directory or does not exist; skipping copy`);
      return;
    }
    
    let staticFiles = await this.collect(this.staticRoot);

    await Promise.all(staticFiles.map((filename) => this.copyStaticFile(filename)));
  }

  async copyStaticFile(filename: string): Promise<void> {
    let destinationFilename = path.resolve(this.staticOutputRoot, path.relative(this.staticRoot, filename));

    await ensureDir(path.dirname(destinationFilename));

    return copy(filename, destinationFilename, {overwrite: true});
  }

  //
  // # Ingesting pages
  //

  async ingestPage(page: Page) {
    await page.handler._ingest(page);
  }

  // Ingest all pages.
  async ingest() {
    let tasks = [...this.pages.values()].map((page) => page.ingest());

    await Promise.all(tasks);
  }

  //
  // # Transforming pages
  //

  get transformOperations(): string[] {
    return this.config.transform.operations;
  }

  // Throws an error if `operation` is not a transform operation.
  ensureTransformOperation(operation: string) {
    if(this.transformOperations.indexOf(operation) < 0) {
      throw new ApogeeError(`site configuration does not specify required operation '${operation}' in transform.operations array`);
    }
  }

  // If `operation` is not provided, then the operations as set in the site configuration file are run in order.
  async transformPage(page: Page, operation?: string) {
    if(!operation) {
      for(let operationName of this.transformOperations) {
        await this.transformPage(page, operationName);
      }

      return;
    }
    
    await page.handler._transform(page, operation);
  }

  async transform(operation?: string) {

    if(!operation) {
      await this.transform('@start');
      
      for(let operationName of this.transformOperations) {
        await this.transform(operationName);
      }

      await this.transform('@end');
      
      return;
    }

    // Run the pre transforms.
    await this.handlers.forEach((handler) => handler._transformGlobal(operation + '-pre'));

    // Transform operations are run on all pages in parallel, one operation at a time.
    let tasks = [...this.pages.values()].map((page) => page.transform(operation));

    // And run our post transforms.
    await this.handlers.forEach((handler) => handler._transformGlobal(operation + '-post'));

    await Promise.all(tasks);

  }

  //
  // # Rendering pages
  //

  renderPage(page: Page, variant: string, data?: any): string {
    return page.handler._render(page, variant, data);
  }

  async outputPage(page: Page): Promise<void> {
    await page.handler._output(page);
  }

  async output() {
    let tasks = [...this.pages.values()].map((page) => page.output());

    await Promise.all(tasks);
  }

}
