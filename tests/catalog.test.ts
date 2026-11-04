import assert from 'node:assert/strict';
import test from 'node:test';
import { importCatalog, validateData } from '../scripts/catalog.ts';
import { renderFiles } from '../scripts/render.ts';

const locales = ['en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR'];
const slugs = ['fable55-the-moss-keeper', 'fable55-the-last-page', ...Array.from({ length: 12 }, (_, n) => `fable55-example-${n + 3}`)];

function fixture() {
  const cases = Object.fromEntries(slugs.toReversed().map((slug) => [slug, {
    slug, category: 'video', title: `Title ${slug}`, description: `Description ${slug}`,
    prompt: '  Original prompt.\n\nSecond line.  ', privateField: 'DO NOT EXPORT',
    discovery: { modelIds: ['claude-fable-5-5'], popularPinOrder: slugs.indexOf(slug) + 1,
      source: { modelId: 'claude-fable-5-5', url: 'https://x.com/example/status/123', authorName: 'Original Author', authorUrl: 'https://x.com/example' } },
    result: { kind: 'video', coverAssetIndex: 0, assets: [{ kind: 'video', url: 'https://agent-imagex.pagepop.cn/example.mp4', coverUrl: 'https://agent-imagex.pagepop.cn/example.jpg' }] },
  }]));
  const catalogs = Object.fromEntries(locales.map(locale => [locale, {
    locale, cases: slugs.map(ref => locale === 'en-US' ? ref : { ref, title: `${locale} title`, description: `${locale} description`, prompt: 'Translated prompt must not replace original' }),
  }]));
  return { shared: { schemaVersion: 1, cases }, catalogs };
}

test('exports all fourteen in pin order with exact original prompts and public-only fields', () => {
  const { shared, catalogs } = fixture();
  const data = importCatalog(shared, catalogs);
  const first = data.cases[0]!;
  assert.equal(data.cases.length, 14);
  assert.deepEqual(data.cases.map((entry: any) => entry.slug), slugs);
  assert.equal(first.prompt, shared.cases[slugs[0]!]!.prompt);
  assert.equal(first.locales['zh-CN'].title, 'zh-CN title');
  assert.equal(first.locales['en-US'].title, shared.cases[slugs[0]!]!.title);
  assert.equal(first.locales['ja-JP'].detailUrl, `https://www.pagepop.ai/jp/use-cases/${slugs[0]}`);
  assert.equal(first.locales['pt-BR'].topicUrl, 'https://www.pagepop.ai/pt-br/use-cases/models/claude-fable-5-5');
  assert.equal(JSON.stringify(data).includes('DO NOT EXPORT'), false);
  validateData(data);
});

test('fails explicitly when a required locale, localized field, prompt or attribution is missing', () => {
  const { shared, catalogs } = fixture();
  delete (catalogs as Record<string, unknown>)['ja-JP'];
  assert.throws(() => importCatalog(shared, catalogs), /ja-JP/);
  const next = fixture();
  (next.catalogs['zh-CN']!.cases[0] as Record<string, unknown>).title = '';
  assert.throws(() => importCatalog(next.shared, next.catalogs), /title/);
  next.shared.cases[slugs[0]!]!.prompt = '';
  assert.throws(() => importCatalog(next.shared, fixture().catalogs), /prompt/);
  const noAuthor = fixture();
  noAuthor.shared.cases[slugs[0]!]!.discovery.source.authorUrl = '';
  assert.throws(() => importCatalog(noAuthor.shared, noAuthor.catalogs), /authorUrl/);
});

test('rejects missing cases, duplicate ordering and a non-production CDN before export', () => {
  const missing = fixture();
  delete missing.shared.cases[slugs[0]!];
  assert.throws(() => importCatalog(missing.shared, missing.catalogs), /14/);
  const duplicate = fixture();
  duplicate.shared.cases[slugs[1]!]!.discovery.popularPinOrder = 1;
  assert.throws(() => importCatalog(duplicate.shared, duplicate.catalogs), /popularPinOrder/);
  const badCdn = fixture();
  badCdn.shared.cases[slugs[0]!]!.result.assets[0]!.url = 'https://staging.example/video.mp4';
  assert.throws(() => importCatalog(badCdn.shared, badCdn.catalogs), /agent-imagex.pagepop.cn/);
});

test('public validator rejects private fields, extra locales and incorrect localized routes', () => {
  const { shared, catalogs } = fixture();
  const data = importCatalog(shared, catalogs);
  const badField = structuredClone(data);
  Object.assign(badField.cases[0]!, { privatePath: '/private/source' });
  assert.throws(() => validateData(badField), /privatePath/);
  const badLocale = structuredClone(data);
  Object.assign(badLocale.cases[0]!.locales, { 'it-IT': badLocale.cases[0]!.locales['en-US'] });
  assert.throws(() => validateData(badLocale), /it-IT/);
  const badRoute = structuredClone(data);
  badRoute.cases[0]!.locales['ja-JP'].detailUrl = `https://www.pagepop.ai/ja/use-cases/${slugs[0]}`;
  assert.throws(() => validateData(badRoute), /detailUrl/);
});

test('renders nine localized indexes, six linked previews and fourteen complete original prompts', () => {
  const { shared, catalogs } = fixture();
  shared.cases[slugs[0]!]!.prompt = '  Exact original\n```sample```\nwith trailing whitespace.  ';
  const data = importCatalog(shared, catalogs);
  const files = renderFiles(data);
  assert.equal(files.size, 23);
  const english = files.get('README.md')!;
  assert.ok(english.includes('# Awesome Claude Fable 5.5 Prompts & Video Examples'));
  assert.equal((english.match(/<img /g) ?? []).length, 6);
  assert.equal((english.match(/^\| \d+ /gm) ?? []).length, 14);
  assert.ok(english.includes('utm_source=github'));
  const japanese = files.get('README_ja-JP.md')!;
  assert.ok(japanese.includes(`/jp/use-cases/${slugs[0]}?`));
  assert.equal(japanese.includes('/ja/use-cases/'), false);
  for (const entry of data.cases) {
    const prompt = files.get(`prompts/${entry.slug}.md`)!;
    assert.ok(prompt.includes(entry.prompt));
    assert.ok(prompt.includes(entry.source.url));
    assert.ok(prompt.includes(entry.source.authorName));
    assert.ok(prompt.includes(entry.coverUrl));
    for (const locale of locales) assert.ok(prompt.includes(entry.locales[locale as keyof typeof entry.locales].detailUrl));
  }
  assert.ok(files.get(`prompts/${slugs[0]}.md`)!.includes('````text\n' + data.cases[0]!.prompt + '\n````'));
});
