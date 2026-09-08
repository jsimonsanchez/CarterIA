/** Inyectado por `define` en vite.config.ts — ver `readAppVersion` ahí y `AppVersionPopover` para dónde se usa. */
declare const __APP_VERSION__: {
  sha: string
  commitDate: string // ISO 8601
  /** AAMMDD.HHmm derivado de commitDate, p.ej. "260908.1751" — ver `buildNumberFrom` en vite.config.ts. */
  build: string
}
