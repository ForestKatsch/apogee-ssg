
import * as path from 'https://deno.land/std@0.82.0/path/mod.ts';

import {Logger} from './util/log.ts';
import {Site} from './site.ts';

import {ApogeeError} from './error.ts';

export class Generator {
  
  log: Logger;
  
  site: Site;

  constructor(site: Site) {
    this.log = site.log;
    
    this.site = site;
  }
  
  // Removes all files in the output directory, and return `true` if the output directory is empty or does not exist, `false` otherwise.
  // To avoid potentially removing the wrong directory, a check is made for a "flag" file, `apogee.buildinfo.json`.
  // If this file is not present, no files are deleted and `false` is returned.
  // Note that this will still delete the wrong files if the config `output.path` was set to an existing path.
  //
  // TL;DR: be careful running this function.
  //
  // If `force` is true, then the output directory will be cleared no matter what.
  async clean(force = false): Promise<boolean> {
    if(!this.isOutputFlagPresent()) {
      if(!force) {
        this.log.warn(`refusing to remove output directory without flag file or 'force' parameter`);
        return false;
      } else {
        this.log.warn(`clearing all files and directories in output location without flag file ('force' parameter was set.)`);
      }
    }
    
    // TODO: implement clean.
    throw new ApogeeError('not implemented yet');
    
    return false;
  }

  // Builds the output files.
  async build() {
    this.log.debug(`building from content root: '${this.site.contentRoot}'`);

    // Start time, in seconds.
    const startTime = Date.now() / 1000;
    
    let contentFilenames = await this.site.collectContentFiles();

    this.log.debug('content files to ingest:', contentFilenames);

    // Now, invoke the appropriate `ContentHandler` for each content file.
    contentFilenames.forEach((filename) => {
      let handler = this.site.handlers.getHandlerForExtension(path.extname(filename));

      handler.addContent(filename);
    });

    await this.site.ingest();
    await this.site.transform();
    await this.site.output();

    await this.site.copyStatic();
    
    const endTime = Date.now() / 1000;
    const elapsed = endTime - startTime;
    
    let pageCount = this.site.pages.size;

    this.log.info(`build complete; generated ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} in ${elapsed.toFixed(4)}s`);
  }

  async rebuild() {
    await this.clean();
    await this.build();
  }

  async watch() {
    // TODO
    throw new ApogeeError('not implemented yet');
  }
  
  //
  // # Output Path
  //

  // TODO
  isOutputFlagPresent() {
    // TODO
    throw new ApogeeError('not implemented yet');
    return false;
  }

}
