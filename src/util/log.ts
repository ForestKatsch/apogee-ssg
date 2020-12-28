
import * as color from "https://deno.land/std@0.82.0/fmt/colors.ts";

export enum Level {
  Debug = 0,
  Info,
  Warn,
  Error,
  Vis
};

const LevelDisplay = {
  [Level.Debug]: color.gray   ('--'),
  [Level.Info]:  color.green  ('=='),
  [Level.Warn]:  color.yellow (' !'),
  [Level.Error]: color.red    ('!!'),
  [Level.Vis]:   color.magenta('##'),
};

export interface LogEntry {
  level: Level;
  message: string;
  data: any;
}

export class Transport {

  constructor() {
  }

  log(entry: LogEntry) {
  }
  
}

export class ConsoleTransport extends Transport {

  log(entry: LogEntry) {

    let message = entry.message;
    
    switch(entry.level) {
      case Level.Debug:
        message = color.dim(message);
        break;
      case Level.Warn:
        message = color.yellow(message);
        break;
      case Level.Error:
        message = color.red(message);
        break;
      case Level.Vis:
        message = color.bold(color.magenta(message));
        break;

        // No color by default.
      default:
        break;
    }

    console.log(`${LevelDisplay[entry.level]} ${message}`);
    
    if(entry.data) {
      console.log(entry.data);
    }
  }
}

// The logger instance.
export class Logger {

  private transports: Transport[] = [];

  constructor(transports?: Transport[]) {

    if(transports) {
      this.transports = transports;
    } else {
      // HOW THE F*CK DO WE LOG AN ERROR
      // JK

      console.warn(`heads up: no log transports defined`);
    }
  }

  log(level: Level, message: string, data: any) {

    this.transports.forEach((transport) => {
      transport.log({
        level: level,
        message: message,
        data: data
      })
    });
    
  }

  debug(message: string, data?: any) {
    this.log(Level.Debug, message, data);
  }
  
  info(message: string, data?: any) {
    this.log(Level.Info, message, data);
  }
  
  warn(message: string, data?: any) {
    this.log(Level.Warn, message, data);
  }
  
  error(message: string, data?: any) {
    this.log(Level.Error, message, data);
  }
  
  vis(message: string, data?: any) {
    this.log(Level.Vis, message, data);
  }
  
}
