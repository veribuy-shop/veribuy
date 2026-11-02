/**
 * Evidence subpath entrypoint — dependency-free so the Next.js frontend can
 * import it without pulling NestJS modules into the client bundle.
 */
export * from './requirements';
export * from './imei';
