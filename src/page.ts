
import * as path from 'https://deno.land/std@0.82.0/path/mod.ts';

import toml from 'https://cdn.skypack.dev/toml@3.0.0';
import _ from 'https://cdn.skypack.dev/lodash@4.17.19';

import {OutputPath, ContentPath, StaticPath} from './path.ts';

import {ApogeeError} from './error.ts';

import {ContentHandler} from './handler.ts';
import {Site} from './site.ts';
import {TemplateResult} from './template.ts';

type PageMetadata = {
  title: string;

  author: string;

  publishDate: Date;
  updateDate: Date;
  
  draft: boolean;

  tags: string[];

  static: boolean;

  handler?: string;

  [key: string]: any;
};

const DEFAULT_METADATA: PageMetadata = {
  title: '',

  author: '',
  
  publishDate: new Date(0),
  updateDate: new Date(0),
  
  draft: false,

  tags: [],

  static: false
};

export type PageCriteriaFilter = {
  tags: string[],
  category?: boolean,
  allTags?: boolean,
};

export type PageCriteria = {
  include?: PageCriteriaFilter,
  exclude?: PageCriteriaFilter
};

// # Page

export class Page {

  site: Site;

  // The user-facing path of this page, relative to the site root.
  _path: string;

  get path(): OutputPath {
    return this._path;
  }

  // This is the metadata, as read from the page.
  _meta: {[key: string]: any} = {
    title: '',
    tags: [],
  };

  get meta(): PageMetadata {
    return _.merge(
      {},
      DEFAULT_METADATA,
      this.handler.meta,
      this._meta
    );
  }

  get title(): string {
    return this.meta.title;
  }

  set title(newTitle: string) {
    this._meta.title = newTitle;
  }

  get tags(): string[] {
    return this.meta.tags;
  }

  addTag(tag: string) {
    if(this.hasTag(tag)) {
      return;
    }
    
    this._meta.tags.push(tag);
  }

  hasTag(tag: string): boolean {
    return this.tags.indexOf(tag) >= 0;
  }

  handler: ContentHandler;

  // The content-root-relative filename.
  contentPath?: ContentPath;

  // This is an amorphous blob that changes type between `transform` calls.
  // We do not know what it is.
  // We only must keep it safe for the next transform call.
  contents: any;

  // The time at which the most recent invocation to `output` was completed.
  outputTime: Date = new Date();

  // `site` is the relevant `Site` instance; `outputPath` is the output root-relative path with a leading '/',
  // and `handler` is the relevant `ContentHandler` responsible for this page.
  constructor(site: Site, outputPath: string, handler: ContentHandler, contentPath?: string) {
    this.site = site;
    this._path = outputPath;
    this.handler = handler;
    this.contentPath = contentPath;

    if(!path.isAbsolute(this.path)) {
      throw new ApogeeError(`page path '${this.path}' must be absolute`);
    }
  }

  get hasPublishDate(): boolean {
    return this.meta.publishDate > new Date(3600);
  }

  // Matches if any filter matches.
  matchesFilter(filter: PageCriteriaFilter, all = false): boolean {
    let matchedTags: boolean | null = this.matchesFilterTags(filter, all);
    let matchedCategory: boolean | null = filter.category ? this.meta.category === filter.category : null;

    let allMatched = true;

    const checkMatch = (value: boolean | null) => {
      if(value === null) {
        return;
      }

      if(!value) {
        allMatched = false;
      }
    };

    checkMatch(matchedTags);
    checkMatch(matchedCategory);

    return allMatched;
  }

  matchesFilterTags(filter: PageCriteriaFilter, all = false): boolean | null {
    if(!filter.tags) {
      return null;
    }
    
    let allMatched = true;
    let someMatched = false;

    for(let tag of filter.tags) {
      if(this.hasTag(tag)) {
        someMatched = true;
        continue;
      }

      allMatched = false;
    }

    if(all) {
      return allMatched;
    } else {
      return someMatched;
    }
  }

  // Returns the filename of the metadata file.
  get absoluteMetadataFilename(): string {
    if(!this.contentPath) {
      throw new ApogeeError(`cannot get metadata filename for page without a content filename set`);
    }
    
    return path.join(this.site.contentRoot, this.contentPath + '.toml');
  }

  // A path, suitable for use in log messages.
  get sourcePath(): string {
    return this.contentPath ?? this.path;
  }

  // Returns the absolute filesystem-based filename for the content path of this page.
  get contentFilename(): string {
    return path.join(this.site.contentRoot, this.contentPath);
  }

  // Returns the absolute output path of this file itself relative to outputRoot.
  // For a page with a path `falcon9`, this would be `falcon9/index.html`.
  get outputPath(): string {
    return path.join(this.path, 'index.html');
  }

  // Returns the filesystem output path.
  //
  // For a page with a path `falcon9`, this would be `$OUTPUT_ROOT/falcon9/index.html`.
  get outputFilename(): string {
    return path.join(this.site.outputRoot, this.outputPath);
  }

  // Given a path relative to the static root, returns the output path relative to this page.
  static(filename: string): string {
    let pagePath = path.join('/', path.dirname(this.outputPath));
    let staticPath = path.join('/', path.relative(this.site.outputRoot, this.site.staticOutputRoot), filename);

    // Force static files to be not cached across compiles.
    // This is BAD. Don't do this.
    // TODO: fix this.
    return path.relative(pagePath, staticPath) + `?gen=${Math.round(Date.now() / 1000)}`;
  }

  // Given a content path relative to the content root (if prefixed with '/'), returns the path relative to this page.
  link(filename: string | Page, absolute: boolean = false): string {

    if(filename instanceof Page) {
      filename = filename.path;
    }

    if(absolute) {
      return this.site.link(filename);
    }

    let pagePath = path.dirname(this.outputPath);
    let staticPath = filename as string;

    //console.log(pagePath, staticPath, path.relative(pagePath, staticPath));

    return path.relative(pagePath, staticPath);
  }

  // Splits (and parses) metadata from `contents`.
  splitFrontmatter() {
    let [meta, contents] = this.contents.split('\n+++\n', 2);

    this.contents = contents;
    
    this.parseMeta(meta);
  }

  parseMeta(meta: string) {
    try {
      this._meta = toml.parse(meta);
      
      if(!this._meta.tags) {
        this._meta.tags = [];
      }
    } catch(err) {
      throw new ApogeeError(`could not parse metadata for page '${this.sourcePath}'; toml error at [${err.line}:${err.column}]: ${err.message}`);
    }
    
    if(this.meta.handler) {
      this.site.log.debug(`page '${this.sourcePath}' requested to use handler '${this.meta.handler}'`);

      this.handler = this.site.getHandler(this.meta.handler);
      
      this.handler.inheritPage(this);
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
  render(variant: string, data?: any): TemplateResult {
    return this.site.renderPage(this, variant, data);
  }

  async output(): Promise<void> {
    if(!this.meta.title) {
      this.site.log.warn(`page '${this.sourcePath}' has no title`);
    }

    await this.site.outputPage(this);
  }
  
}
