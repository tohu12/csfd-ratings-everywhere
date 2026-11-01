// Turns the VOD canary results (test-results/canary.jsonl) into Markdown for the job summary and
// the alarm issue. Usage: node tools/canary-report.mjs [run URL] > report.md
// Exit code 1 when a page is `gone` or `broken` (the workflow then opens or updates the issue).
import { readFile } from 'node:fs/promises';

const runUrl = process.argv[2] ?? '';
const text = await readFile('test-results/canary.jsonl', 'utf8').catch(() => '');
// A retried test appends a line per attempt: the last one wins.
const byFixture = new Map();
for (const line of text.split('\n').filter(Boolean)) {
  const result = JSON.parse(line);
  byFixture.set(result.fixture, result);
}
const results = [...byFixture.values()];
const failed = results.filter((r) => r.status === 'gone' || r.status === 'broken');
const icon = { ok: '✅', unavailable: '⚪', gone: '🟠', broken: '🔴' };
// Details carry text from third-party pages: a code span keeps @-mentions, links and HTML inert
// in the issue, and `|` would break the table.
const inert = (text) =>
  `\`${String(text).slice(0, 200).replaceAll('`', "'").replaceAll('|', '\\|')}\``;

const lines = [
  failed.length
    ? `**${failed.length} VOD page(s) need attention.**`
    : '**All VOD pages detected.**',
  '',
  '| | Page | Result |',
  '|---|---|---|',
  ...results.map(
    (r) => `| ${icon[r.status]} ${r.status} | [${r.fixture}](${r.url}) | ${inert(r.detail)} |`,
  ),
  '',
  '- 🟠 **gone**: the title left the catalogue. Pick another public title of that service and update `tests/canary/sites.ts` (and the fixture, see the VOD fixture README).',
  '- 🔴 **broken**: the service changed its page. Recapture the fixture with `tools/capture-vod-page.mjs`, then follow `/add-vod-site` to fix its `VOD_SITES` entry.',
  '- ⚪ **unavailable**: outage, geo-blocking or a bot wall on the CI runner. Never an alarm on its own.',
];
if (results.length === 0) {
  lines.unshift('**The canary produced no results** (it crashed before testing any page).', '');
}
if (runUrl) {
  lines.push('', `Run: ${runUrl}`);
}
console.log(lines.join('\n'));
process.exit(failed.length || results.length === 0 ? 1 : 0);
