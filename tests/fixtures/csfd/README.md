# ČSFD response fixtures

| file                                                              | origin                                                                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `anubis-reject.html`                                              | **Real** response from www.csfd.cz (2026-10-31), the Anubis "Oh noes!" page served to non-browser clients. Protected by a hook; do not edit. |
| `anubis-challenge.html`                                           | Synthetic, modelled on the Anubis v1.28 challenge page markup.                                                                               |
| `film.html`, `episode.html`, `no-rating.html`, `markup-only.html` | **Synthetic**, modelled on ČSFD film page markup (JSON-LD `aggregateRating`, `.film-rating-average`, `h1`).                                  |
| `search-silo.html`, `search-duna.html` | **Real** ČSFD search pages saved by the owner in a browser (2026-11-01, logged out). The users section, scripts and styles were removed (other people's nicknames; tracking). |

ČSFD blocks automated clients with Anubis, and this project never circumvents it, so real film pages cannot be downloaded by scripts or agents.

**To replace the synthetic film fixtures with real ones:** open the film in your normal browser and use _Save Page As → Webpage, HTML only_. Save to this folder under the same name and run `pnpm test`. A failure means the parser needs updating for real-world markup.
