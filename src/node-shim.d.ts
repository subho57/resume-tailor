// Fallback ambient declarations for the Node built-ins this project uses.
// In a normal install, @types/node (a devDependency) supersedes these with full
// definitions. This shim only exists so the project compiles in environments
// where @types/node cannot be fetched. It declares just what cli/pack/autofit use.

declare module "fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: any, encoding?: string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, opts?: { recursive?: boolean; force?: boolean }): void;
}
declare module "path" {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function basename(p: string, ext?: string): string;
  export function dirname(p: string): string;
}
declare module "os" {
  export function tmpdir(): string;
}
declare module "child_process" {
  export function execFileSync(file: string, args?: string[], opts?: any): any;
}

declare const __dirname: string;
declare const process: {
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
  env: Record<string, string | undefined>;
};
declare const console: {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
};
declare class Buffer {}
declare const require: any;
declare const module: any;
