import { describe, expect, it } from 'vitest';
import { isAnubisPage, parseFilmPage } from '@/lib/rating-parser';
import { fixture } from '../helpers/fixtures';

const ld = (json: unknown) =>
  `<html><script type="application/ld+json">${JSON.stringify(json)}</script></html>`;

describe('isAnubisPage', () => {
  it('detects the real ČSFD Anubis reject page', () => {
    expect(isAnubisPage(fixture('csfd/anubis-reject.html'))).toBe(true);
  });

  it('detects the Anubis challenge page', () => {
    expect(isAnubisPage(fixture('csfd/anubis-challenge.html'))).toBe(true);
  });

  it('does not flag film pages', () => {
    expect(isAnubisPage(fixture('csfd/film.html'))).toBe(false);
  });
});

describe('parseFilmPage', () => {
  it('returns blocked for an Anubis page', () => {
    expect(parseFilmPage(fixture('csfd/anubis-reject.html'))).toEqual({ status: 'blocked' });
  });

  it('reads rating, count and decoded title from JSON-LD', () => {
    expect(parseFilmPage(fixture('csfd/film.html'))).toEqual({
      status: 'ok',
      percent: 65,
      count: 1234,
      title: 'Coutures & spol.',
    });
  });

  it('reads string values from a JSON-LD @graph (episode page)', () => {
    expect(parseFilmPage(fixture('csfd/episode.html'))).toEqual({
      status: 'ok',
      percent: 81,
      count: 57,
      title: 'To: Vítejte v Derry - A Story of Derry',
    });
  });

  it('returns none for a film without rating', () => {
    expect(parseFilmPage(fixture('csfd/no-rating.html'))).toEqual({
      status: 'none',
      title: 'Poberta',
    });
  });

  it('falls back to .film-rating-average markup and the h1 title', () => {
    expect(parseFilmPage(fixture('csfd/markup-only.html'))).toEqual({
      status: 'ok',
      percent: 23,
      count: null,
      title: 'Pobuda – Urchin ★ &bogus;',
    });
  });

  it('prefers the rated item over an earlier site-wide block', () => {
    const html = `${ld({ '@type': 'WebSite', name: 'ČSFD.cz' })}${ld({ '@type': 'Movie', name: 'Film', aggregateRating: { ratingValue: 70 } })}`;
    expect(parseFilmPage(html)).toMatchObject({ percent: 70, title: 'Film' });
  });

  it('uses an unrated film item (also with an array @type) for the title', () => {
    const html = `${ld({ '@type': 'Organization', name: 'ČSFD' })}${ld({ '@type': ['TVEpisode', 'Thing'], name: 'Epizoda' })}`;
    expect(parseFilmPage(html)).toEqual({ status: 'none', title: 'Epizoda' });
  });

  it('treats a page with only non-film JSON-LD as unrecognisable', () => {
    expect(parseFilmPage(ld({ '@type': 'WebSite', name: 'ČSFD.cz' }))).toEqual({ status: 'error' });
  });

  it('returns error for an unrecognisable page', () => {
    expect(parseFilmPage('<html><body>Not found</body></html>')).toEqual({ status: 'error' });
  });

  it('returns none without title when markup has no h1', () => {
    expect(parseFilmPage('<div class="film-rating-average">?</div>')).toEqual({
      status: 'none',
      title: null,
    });
  });

  it('normalises a non-100 bestRating scale and clamps to 0–100', () => {
    expect(parseFilmPage(ld({ aggregateRating: { ratingValue: 4, bestRating: 5 } }))).toEqual({
      status: 'ok',
      percent: 80,
      count: null,
      title: null,
    });
    expect(parseFilmPage(ld({ aggregateRating: { ratingValue: 130 } }))).toMatchObject({
      percent: 100,
    });
    expect(parseFilmPage(ld({ aggregateRating: { ratingValue: -5 } }))).toMatchObject({
      percent: 0,
    });
  });

  it('accepts a top-level JSON-LD array', () => {
    expect(
      parseFilmPage(
        ld([{ '@type': 'Thing' }, { name: 'A', aggregateRating: { ratingValue: 50 } }]),
      ),
    ).toMatchObject({ percent: 50, title: 'A' });
  });

  it.each([
    ['invalid count', { name: 'A', aggregateRating: { ratingValue: 50, ratingCount: -3 } }],
    ['fractional count', { name: 'A', aggregateRating: { ratingValue: 50, ratingCount: 1.5 } }],
  ])('drops an %s', (_, json) => {
    expect(parseFilmPage(ld(json))).toMatchObject({ status: 'ok', count: null });
  });

  it.each([
    ['missing ratingValue', { name: 'A', aggregateRating: {} }],
    ['non-numeric ratingValue', { name: 'A', aggregateRating: { ratingValue: 'abc' } }],
    ['zero bestRating', { name: 'A', aggregateRating: { ratingValue: 5, bestRating: 0 } }],
    ['non-object aggregateRating', { name: 'A', aggregateRating: 'x' }],
  ])('treats %s as no rating', (_, json) => {
    expect(parseFilmPage(ld(json))).toEqual({ status: 'none', title: 'A' });
  });

  it('skips broken JSON-LD blocks and non-film items', () => {
    const html = `<script type="application/ld+json">{broken</script>
      <script type="application/ld+json">"just a string"</script>
      <script type='application/ld+json'>{"@type":"Organization","logo":"x"}</script>
      <script type="application/ld+json">{"name":"Film","aggregateRating":{"ratingValue":90}}</script>`;
    expect(parseFilmPage(html)).toMatchObject({ status: 'ok', percent: 90, title: 'Film' });
  });

  it('ignores a non-string name', () => {
    expect(parseFilmPage(ld({ name: 7, aggregateRating: { ratingValue: 50 } }))).toMatchObject({
      title: null,
    });
  });

  it('does not double-decode entities', () => {
    expect(
      parseFilmPage('<h1>a &amp;lt;b&amp;gt; &AMP;</h1><div class="film-rating-average">1%</div>'),
    ).toMatchObject({
      title: 'a &lt;b&gt; &',
    });
  });

  it('decodes numeric entities but keeps invalid code points literally', () => {
    expect(
      parseFilmPage(
        '<h1>A &#0; B &#x110000; &quot;C&quot;&nbsp;&apos;D&apos; &lt;&gt;</h1><div class="film-rating-average">10%</div>',
      ),
    ).toMatchObject({
      title: 'A &#0; B &#x110000; "C" \'D\' <>',
    });
  });
});
