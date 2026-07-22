import { env, type LogLevel } from './env.js';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function enabled(level: LogLevel): boolean {
  return ORDER[level] >= ORDER[env.logLevel];
}

function fmt(level: LogLevel, scope: string, msg: string): string {
  return `[${level.toUpperCase()}] (${scope}) ${msg}`;
}

export function makeLogger(scope: string) {
  return {
    debug: (msg: string, ...rest: unknown[]) =>
      enabled('debug') && console.debug(fmt('debug', scope, msg), ...rest),
    info: (msg: string, ...rest: unknown[]) =>
      enabled('info') && console.info(fmt('info', scope, msg), ...rest),
    warn: (msg: string, ...rest: unknown[]) =>
      enabled('warn') && console.warn(fmt('warn', scope, msg), ...rest),
    error: (msg: string, ...rest: unknown[]) =>
      enabled('error') && console.error(fmt('error', scope, msg), ...rest),
  };
}

export type Logger = ReturnType<typeof makeLogger>;
