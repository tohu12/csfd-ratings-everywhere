import { describe, expect, it } from 'vitest';
import { unwrapRedirect } from '@/lib/link-redirect';

describe('unwrapRedirect', () => {
  const FILM = 'https://www.csfd.cz/film/1913273-cunk-on-cinema/videa/';
  const wrapped = encodeURIComponent(FILM);

  it.each([
    // Real link from facebook.com/www.CSFD.cz (2026-11-02), `h` shortened.
    `https://l.facebook.com/l.php?u=${wrapped}&h=AUDChyeEExkThRWD8Pc5KHxg`,
    `https://lm.facebook.com/l.php?u=${wrapped}`,
    `https://l.messenger.com/l.php?u=${wrapped}&h=x`,
    `https://L.FACEBOOK.COM/l.php?u=${wrapped}`,
    `https://www.google.com/url?q=${wrapped}&sa=D`,
    `https://www.google.cz/url?sa=t&url=${wrapped}`,
    `https://google.sk/url?q=${FILM}`,
    // Google in other countries and languages.
    `https://www.google.de/url?q=${wrapped}`,
    `https://www.google.co.uk/url?q=${wrapped}`,
    `https://www.google.com.au/url?q=${wrapped}`,
    `https://google.at/url?q=${wrapped}`,
    // Google search results: an empty `q` (or the search terms) before `url`.
    `https://www.google.com/url?sa=t&rct=j&q=&esrc=s&url=${wrapped}`,
    `https://www.google.cz/url?q=cunk+on+cinema&url=${wrapped}`,
  ])('returns the target of %s', (url) => {
    expect(unwrapRedirect(url)).toBe(FILM);
  });

  it('keeps the target as it is, e.g. the Slovak ČSFD', () => {
    const sk = 'https://www.csfd.sk/film/1913273-cunk-on-cinema/prehlad/';
    expect(unwrapRedirect(`https://l.facebook.com/l.php?u=${encodeURIComponent(sk)}`)).toBe(sk);
  });

  it('unwraps only one level', () => {
    const inner = `https://www.google.com/url?q=${wrapped}`;
    expect(unwrapRedirect(`https://l.facebook.com/l.php?u=${encodeURIComponent(inner)}`)).toBe(
      inner,
    );
  });

  it('returns an empty target for a redirect page without one', () => {
    expect(unwrapRedirect('https://l.facebook.com/l.php?h=x')).toBe('');
    expect(unwrapRedirect('https://www.google.com/url?q=&sa=D')).toBe('');
  });

  it.each([
    FILM,
    'not a url',
    `https://www.facebook.com/l.php?u=${wrapped}`,
    `https://l.facebook.com/other.php?u=${wrapped}`,
    `https://www.google.com/search?q=${wrapped}`,
    `https://www.google.evil.example/url?q=${wrapped}`,
    `https://google.example.com/url?q=${wrapped}`,
    `https://notgoogle.com/url?q=${wrapped}`,
    `https://www.google.co.evil/url?q=${wrapped}`,
    `https://mail.google.com/url?q=${wrapped}`,
    `https://evil.example/l.php?u=${wrapped}`,
    `javascript://l.facebook.com/l.php?u=${wrapped}`,
    `ftp://www.google.com/url?q=${wrapped}`,
  ])('leaves %s unchanged', (url) => {
    expect(unwrapRedirect(url)).toBe(url);
  });
});
