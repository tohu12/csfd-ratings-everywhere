import type { TitleKind } from '../../src/lib/vod/detect';

export interface CanaryPage {
  /** Fixture the page was captured as (tests/fixtures/pages/vod/). */
  fixture: string;
  url: string;
  /** Accepted titles; the first is what the page shows in Czech. */
  titles: readonly string[];
  kind: TitleKind;
  /** Not served to the US-based GitHub runners: checked only by a local `pnpm canary`. */
  euOnly?: true;
}

/**
 * One public, logged-out detail page per VOD service, the same URLs as the fixtures. Netflix,
 * Disney+ and HBO Max need a login; MUBI, JustWatch and Canal+ refuse headless browsers and we do
 * not get around that (owner, 2026-11-01). Never add ČSFD here (AGENTS.md).
 */
export const CANARY_PAGES: readonly CanaryPage[] = [
  {
    fixture: 'appletv-film',
    url: 'https://tv.apple.com/cz/movie/f1-the-movie/umc.cmc.3t6dvnnr87zwd4wmvpdx5came',
    titles: ['F1 The Movie'],
    kind: 'film',
  },
  {
    fixture: 'prime-film',
    url: 'https://www.primevideo.com/detail/0FC3O0LQUX1IKRA19XD4UKJASF',
    // The Czech UI calls Road House (2024) "Hrozba smrti"; the fixture was captured in English.
    titles: ['Hrozba smrti', 'Road House'],
    kind: 'film',
  },
  {
    fixture: 'skyshowtime-film',
    url: 'https://www.skyshowtime.com/cz/stream/movies/top-gun-maverick/0c637094-0783-3e48-b533-41626b09cbfc',
    titles: ['Top Gun: Maverick'],
    kind: 'film',
    euOnly: true,
  },
  {
    fixture: 'oneplay-series',
    url: 'https://www.oneplay.cz/porad/9486-extraktori',
    titles: ['Extraktoři'],
    kind: 'series',
  },
  {
    fixture: 'ct-film',
    url: 'https://www.ceskatelevize.cz/porady/14106473148-wind-river/',
    titles: ['Wind River'],
    kind: 'film',
  },
  {
    fixture: 'prima-film',
    url: 'https://www.iprima.cz/filmy/prava-blondynka',
    titles: ['Pravá blondýnka'],
    kind: 'film',
  },
  {
    fixture: 'voyo-sk-film',
    url: 'https://voyo.markiza.sk/titul/7572-tiche-miesto',
    titles: ['Tiché miesto'],
    kind: 'film',
    euOnly: true,
  },
  {
    fixture: 'kviff-film',
    url: 'https://kviff.tv/videos/az-na-veky',
    titles: ['Až na věky'],
    kind: 'film',
  },
  {
    fixture: 'rakuten-film',
    url: 'https://www.rakuten.tv/cz?content_type=movies&content_id=oppenheimer',
    titles: ['Oppenheimer'],
    kind: 'film',
    euOnly: true,
  },
];
