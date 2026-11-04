import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from './catalog.ts';
import { COPY } from './copy.ts';
import { renderFiles, trackedUrl } from './render.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = validateData(JSON.parse(await readFile(join(root, 'data/cases.json'), 'utf8')));
const expected = renderFiles(data);
for (const [name, content] of expected) {
  assert.equal(await readFile(join(root, name), 'utf8'), content, `${name} is stale; run npm run generate`);
  // Original prompt code blocks are reference content, not navigation controls.
  const navigation = content.replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '');
  assert(!/<(?:video|source)\b/i.test(navigation), `${name}: embedded video bypasses the case page`);
  assert(!navigation.includes('Direct video') && !navigation.includes('Watch on PagePop'), `${name}: viewing links must use a short label`);
  for (const match of navigation.matchAll(/\]\(([^)]+)\)|href="([^"]+)"/g)) {
    const link = match[1] ?? match[2]!;
    if (link.startsWith('https://')) {
      const target = new URL(link.replaceAll('&amp;', '&'));
      if (['x.com', 'twitter.com'].includes(target.hostname)) {
        assert(/^\/[A-Za-z0-9_]+\/status\/\d+$/.test(target.pathname), `${name}: attribution must link only to the original post, not a profile`);
      }
      assert(!/\.(?:mp4|mov|webm|m4v|mkv|avi)$/i.test(target.pathname), `${name}: direct media navigation must point to the case page`);
      if (match[2]) assert.notEqual(target.hostname, 'agent-imagex.pagepop.cn', `${name}: CDN links are for image sources, not navigation`);
      continue;
    }
    if (link.startsWith('#')) continue;
    const resolved = new URL(link, new URL(`../${name}`, import.meta.url));
    assert.equal((await stat(resolved)).isFile(), true, `${name}: broken local link ${link}`);
  }
}
assert.equal(COPY['en-US'].preview, 'Watch');
for (const copy of Object.values(COPY)) assert(!copy.preview.includes('PagePop'), 'Localized watch labels must omit the platform name');
for (const entry of data.cases) {
  const document = expected.get(`prompts/${entry.slug}.md`)!;
  assert(document.includes(`[Watch](${trackedUrl(entry.locales['en-US'].detailUrl, 'en-US', 'prompt-preview')})`), `${entry.slug}: Watch must open its own case page`);
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
console.log(`Integrity passed: public-field whitelist, ${data.cases.length} prompts with provenance, localized generated files, local links, production CDN URLs, attribution, and no video binaries.`);
