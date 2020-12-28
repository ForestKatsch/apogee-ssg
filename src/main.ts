
import {parse as parseFlags} from "https://deno.land/std@0.82.0/flags/mod.ts";

import {Site, Generator, ApogeeError} from './index.ts';

async function run() {
  //console.dir(parseFlags(Deno.args));

  const site = new Site();
  const generator = new Generator(site);

  try {
    // Read the config file.
    await site.loadConfig('config.toml');

    // Build once.
    await generator.build();
    
  } catch(err) {
    if(err instanceof ApogeeError) {
      site.log.error(err.message, err.data || err);
    } else {
      site.log.error('unexpected error', err);
    }
  }
}

run();
