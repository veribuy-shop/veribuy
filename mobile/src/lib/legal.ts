import * as WebBrowser from 'expo-web-browser';

const WEBSITE = 'https://www.veribuy.shop';

/** The website holds the one current copy of each policy, so the app never shows a stale one. */
export function openLegalPage(page: 'privacy' | 'terms'): void {
  WebBrowser.openBrowserAsync(`${WEBSITE}/${page}`).catch(() => {});
}
