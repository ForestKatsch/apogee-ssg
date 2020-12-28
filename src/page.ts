
import * as path from 'https://deno.land/std@0.82.0/path/mod.ts';

import toml from 'https://cdn.skypack.dev/toml@3.0.0';
import _ from 'https://cdn.skypack.dev/lodash@4.17.19';

import {ApogeeError} from './error.ts';

import {ContentHandler} from './handler.ts';
import {Site} from './site.ts';

type PageMetadata = {
  title: string;

  author: string;

  publishDate: Date;
  updateDate: Date;
  
  draft: boolean;

  tags: string[];
};

const DEFAULT_METADATA: PageMetadata = {
  title: '',

  author: '',
  
  publishDate: new Date(0),
  updateDate: new Date(0),
  
  draft: false,

  tags: []
};

export class Page {

  site: Site;

  // The user-facing path of this page, relative to the site root.
  _path: string;

  get path(): string {
    return this._path;
  }

  // This is the metadata, as read from the page.
  _meta: {[key: string]: any} = {};

  get meta(): PageMetadata {
    return _.merge(
      {},
      DEFAULT_METADATA,
      this._meta
    );
  }

  handler: ContentHandler;

  // The content-root-relative filename.
  contentFilename?: string;

  // This is an amorphous blob that changes type between `transform` calls.
  // We do not know what it is.
  // We only must keep it safe for the next transform call.
  contents: any;

  // The time at which the most recent invocation to `output` was completed.
  outputTime: Date = new Date();

  // `site` is the relevant `Site` instance; `outputPath` is the output root-relative path with a leading '/',
  // and `handler` is the relevant `ContentHandler` responsible for this page.
  constructor(site: Site, outputPath: string, handler: ContentHandler, contentFilename?: string) {
    this.site = site;
    this._path = outputPath;
    this.handler = handler;
    this.contentFilename = contentFilename;

    if(!path.isAbsolute(this.path)) {
      throw new ApogeeError(`page path '${this.path}' must be absolute`);
    }
  }

  // Returns `contentFilename` relative to `contentRoot`.
  get absoluteContentFilename(): string {
    if(!this.contentFilename) {
      throw new ApogeeError(`cannot get absolute content filename for page without a content filename set`);
    }
    
    return path.join(this.site.contentRoot, this.contentFilename);
  }

  // Returns the filename of the metadata file.
  get absoluteMetadataFilename(): string {
    if(!this.contentFilename) {
      throw new ApogeeError(`cannot get metadata filename for page without a content filename set`);
    }
    
    return path.join(this.site.contentRoot, this.contentFilename + '.toml');
  }

  // A path, suitable for use in log messages.
  get sourcePath(): string {
    return this.contentFilename ?? this.path;
  }

  // Returns the absolute output path of this file itself relative to outputRoot.
  // For a page with a path `falcon9`, this would be `falcon9/index.html`.
  get absoluteOutputPath(): string {
    return path.join(this.path, 'index.html');
  }

  // Returns the filesystem output path.
  //
  // For a page with a path `falcon9`, this would be `$OUTPUT_ROOT/falcon9/index.html`.
  get filesystemOutputPath(): string {
    return path.join(this.site.outputRoot, this.absoluteOutputPath);
  }

  // Given a path relative to the static root, returns the path relative to this page.
  static(filename: string): string {
    let pagePath = path.join('/', path.dirname(this.absoluteOutputPath));
    let staticPath = path.join('/', path.relative(this.site.outputRoot, this.site.staticOutputRoot), filename);
    
    return path.relative(pagePath, staticPath);
  }

  // Given a path relative to the content root, returns the path relative to this page.
  link(filename: string): string {
    let pagePath = path.join(path.dirname(this.absoluteOutputPath));
    let staticPath = path.join('/', filename);
    
    return path.relative(pagePath, staticPath);
  }

  parseMeta(meta: string) {
    try {
      this._meta = toml.parse(meta);
    } catch(err) {
      throw new ApogeeError(`could not parse metadata for page '${this.sourcePath}'; toml error at [${err.line}:${err.column}]: ${err.message}`);
    }
  }

  // ## Utility functions
  //
  // These simply call the site functions.

  // Ingests the input files and metadata information.
  async ingest() {
    await this.site.ingestPage(this);
  }

  // Performs the given transform operation.
  // It is the caller's responsibility to run this in the correct order, for all modified pages.
  // If `operation` isn't provided, all operations are called in order.
  async transform(operation?: string): Promise<void> {
    return await this.site.transformPage(this, operation);
  }

  // Renders a variant of this page and returns the output.
  async render(variant: string): Promise<string> {
    return await this.site.renderPage(this, variant);
  }

  async output(): Promise<void> {
    await this.site.outputPage(this);
  }
  
}
