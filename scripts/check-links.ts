import { readFile } from 'node:fs/promises';
import { LOCALES, categoryUrl, topicUrl, validateData } from './catalog.ts';

const data = validateData(JSON.parse(await readFile(new URL('../data/cases.json', import.meta.url), 'utf8')));
const urls = [...new Set([
  ...LOCALES.flatMap(locale => [topicUrl(locale), categoryUrl(locale)]),
  ...data.cases.flatMap(entry => [entry.coverUrl, entry.videoUrl, ...LOCALES.map(locale => entry.locales[locale].detailUrl)]),
])];
let cursor = 0;
const failures: string[] = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < urls.length) {
    const url = urls[cursor++]!;
    try {
      // HEAD checks reachability without downloading videos or covers.
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) failures.push(`${response.status} ${url}`);
      if (response.url !== url) failures.push(`Unexpected redirect ${url} -> ${response.url}`);
    } catch (error) { failures.push(`${url}: ${String(error)}`); }
  }
}));
if (failures.length) throw new Error(`Live-link check failed (${failures.length}):\n${failures.sort().join('\n')}`);
console.log(`Live links passed: ${urls.length} canonical website/CDN URLs checked with HEAD; no media downloaded. Original X attribution is validated structurally and against the source catalog, not probed for availability.`);
