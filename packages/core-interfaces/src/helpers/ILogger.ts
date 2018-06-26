export interface ILogger {
  none: (message?: string, data?: string | any) => void;
  trace: (message?: string, data?: string | any) => void;
  debug: (message?: string, data?: string | any) => void;
  log: (message?: string, data?: string | any) => void;
  info: (message?: string, data?: string | any) => void;
  warn: (message?: string, data?: string | any) => void;
  error: (message?: string, data?: string | any) => void;
  fatal: (message?: string, data?: string | any) => void;

  setLevel(lvl: string): void;
}
