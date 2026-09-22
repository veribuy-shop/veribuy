/**
 * Shipping subpath entrypoint.
 *
 * Exposed separately from the package root so that browser/edge consumers
 * (the Next.js frontend) can use the Royal Mail rate engine and device weight
 * catalogue without pulling the NestJS-dependent modules in `../index` into
 * the client bundle. Everything re-exported here must stay dependency-free.
 */
export * from './weight-mapping';
export * from './royal-mail-rates';
