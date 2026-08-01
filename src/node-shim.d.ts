// Fallback ambient declarations for the Node built-ins this project uses.
// In a normal install, @types/node (a devDependency) supersedes these with full
// definitions. This shim only exists so the project compiles in environments
// where @types/node cannot be fetched. It declares just what cli/pack/autofit/
// generate-skill-bundle use — all `node:`-prefixed, matching the actual imports
// (readFileSync/writeFileSync/existsSync/execFileSync are gone: those calls were
// converted to Bun.file/Bun.write/Bun Shell, which are typed by @types/bun instead,
// unrelated to @types/node availability).

declare module "node:fs" {
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, opts?: { recursive?: boolean; force?: boolean }): void;
  export function chmodSync(path: string, mode: number): void;
}
declare module "node:path" {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function basename(p: string, ext?: string): string;
  export function dirname(p: string): string;
  export function relative(from: string, to: string): string;
}
declare module "node:os" {
  export function tmpdir(): string;
  export function homedir(): string;
}

declare const __dirname: string;
declare const process: {
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
  env: Record<string, string | undefined>;
  platform: string;
};
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
declare class Buffer {}
declare const require: (id: string) => unknown;
declare const module: { exports: unknown };
