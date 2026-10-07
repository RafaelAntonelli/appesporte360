/** Emitted bundler helpers cannot rely on import.meta.url in hosted Workers. */
export function guardWorkerRequire(code: string): string {
  return code.replace(
    /\bcreateRequire\(\s*import\.meta\.url(?:\s*\|\|\s*["']file:\/\/\/["'])?\s*\)/g,
    'createRequire("file:///")',
  );
}