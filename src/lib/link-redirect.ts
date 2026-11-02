/** Outbound-link redirect pages: host → path and the query parameters holding the target. */
const FACEBOOK = { path: '/l.php', params: ['u'] };
// Google search results send the target in `url` (with `q` empty or the search terms); Gmail and Docs in `q`.
const GOOGLE = { path: '/url', params: ['url', 'q'] };
const FACEBOOK_HOSTS = new Set(['l.facebook.com', 'lm.facebook.com', 'l.messenger.com']);
/** Google in every country: google.com, google.cz, google.de, google.co.uk, google.com.au… */
const GOOGLE_HOST = /^(?:www\.)?google\.(?:com?\.)?[a-z]{2,3}$/;

/**
 * The target of a known redirect page (Facebook and Messenger send every outbound link through
 * `l.php?u=`), unwrapped one level; any other URL unchanged. The target is still untrusted.
 */
export function unwrapRedirect(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const host = url.hostname.toLowerCase();
  const redirect = FACEBOOK_HOSTS.has(host) ? FACEBOOK : GOOGLE_HOST.test(host) ? GOOGLE : null;
  if (redirect?.path !== url.pathname || !/^https?:$/.test(url.protocol)) {
    return href;
  }
  return redirect.params.map((name) => url.searchParams.get(name)).find(Boolean) ?? '';
}
