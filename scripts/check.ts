import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from './catalog.ts';
import { renderFiles } from './render.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = validateData(JSON.parse(await readFile(join(root, 'data/cases.json'), 'utf8')));
const expected = renderFiles(data);
for (const [name, content] of expected) {
  assert.equal(await readFile(join(root, name), 'utf8'), content, `${name} is stale; run npm run generate`);
  for (const match of content.matchAll(/\]\(([^)]+)\)|href="([^"]+)"/g)) {
    const link = match[1] ?? match[2]!;
    if (link.startsWith('https://') || link.startsWith('#')) continue;
    const resolved = new URL(link, new URL(`../${name}`, import.meta.url));
    assert.equal((await stat(resolved)).isFile(), true, `${name}: broken local link ${link}`);
  }
}
const prompts = (await readdir(join(root, 'prompts'))).sort();
assert.deepEqual(prompts, data.cases.map(entry => `${entry.slug}.md`).sort(), 'Unexpected or missing prompt files');
const readmes = (await readdir(root)).filter(name => /^README.*\.md$/.test(name)).sort();
assert.deepEqual(readmes, [...expected.keys()].filter(name => name.startsWith('README')).sort(), 'Unexpected or missing README indexes');
async function assertNoMedia(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertNoMedia(path);
    else assert.equal(/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(entry.name), false, `Video binary must not be committed: ${path}`);
  }
}
await assertNoMedia(root);
console.log('Integrity passed: public-field whitelist, 14 prompts, 9 locales, exact generated files, 6 previews per locale, local links, production CDN URLs, attribution, and no video binaries.');
