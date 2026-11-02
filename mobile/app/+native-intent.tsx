/** Website paths differ from the app's routes, so links from emails and the web are translated here. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const url = path.replace(/^https?:\/\/[^/]+/, '');
  const rules: [RegExp, string][] = [
    [/^\/listings\/create\/?$/, '/sell'],
    [/^\/listings\/([^/?#]+)\/edit\/?$/, '/listing/edit/$1'],
    [/^\/listings\/([^/?#]+)\/?$/, '/listing/$1'],
    [/^\/orders\/([^/?#]+)(?:\/tracking)?\/?$/, '/order/$1'],
  ];
  const clean = url.split(/[?#]/)[0];
  for (const [pattern, target] of rules) {
    if (pattern.test(clean)) return clean.replace(pattern, target);
  }
  return url;
}
