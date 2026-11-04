import { LOCALES, categoryUrl, topicUrl, validateData, type Locale, type PublicCase, type PublicData } from './catalog.ts';
import { COPY, LANGUAGES } from './copy.ts';

export function readmeName(locale: Locale): string { return locale === 'en-US' ? 'README.md' : `README_${locale}.md`; }
export function trackedUrl(canonical: string, locale: Locale, placement: string): string {
  const url = new URL(canonical);
  url.searchParams.set('utm_source', 'github');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'awesome-fable55-prompts');
  url.searchParams.set('utm_content', `${placement}-${locale}`);
  return url.href;
}
function html(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
function md(text: string): string { return text.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]').replaceAll('\n', ' '); }
function card(entry: PublicCase, locale: Locale): string {
  const text = entry.locales[locale];
  const copy = COPY[locale];
  return `<td width="50%" valign="top">\n<a href="${html(trackedUrl(text.detailUrl, locale, 'cover'))}"><img src="${html(entry.coverUrl)}" alt="${html(text.title)}" width="440"></a>\n<p><strong><a href="${html(trackedUrl(text.detailUrl, locale, 'title'))}">${html(text.title)}</a></strong></p>\n<p>${html(text.description)}</p>\n<p><a href="prompts/${entry.slug}.md">${html(copy.prompt)}</a> · <a href="${html(entry.source.authorUrl)}">${html(entry.source.authorName)}</a> · <a href="${html(entry.source.url)}">${html(copy.source)}</a></p>\n</td>`;
}
function readme(data: PublicData, locale: Locale): string {
  const copy = COPY[locale];
  const languages = LOCALES.map(key => key === locale ? `**${LANGUAGES[key]}**` : `[${LANGUAGES[key]}](${readmeName(key)})`).join(' · ');
  const top = data.cases.slice(0, 6);
  const rows = Array.from({ length: 3 }, (_, row) => `<tr>\n${card(top[row * 2]!, locale)}\n${card(top[row * 2 + 1]!, locale)}\n</tr>`).join('\n');
  const index = data.cases.map((entry, index) => {
    const text = entry.locales[locale];
    return `| ${index + 1} | [${md(text.title)}](prompts/${entry.slug}.md) | [${copy.preview}](${trackedUrl(text.detailUrl, locale, 'index')}) | [${md(entry.source.authorName)}](${entry.source.authorUrl}) · [${copy.source}](${entry.source.url}) |`;
  }).join('\n');
  return `<!-- Generated from data/cases.json. Run npm run generate after editing the public data. -->\n\n# ${copy.title}\n\n${languages}\n\n${copy.intro}\n\n**[${copy.browse}](${trackedUrl(topicUrl(locale), locale, 'topic')})** · [${copy.videos}](${trackedUrl(categoryUrl(locale), locale, 'category')})\n\n${copy.credit}\n\n## ${copy.highlights}\n\n${copy.click}\n\n<table>\n${rows}\n</table>\n\n## ${copy.index}\n\n| # | ${copy.example} | ${copy.preview} | ${copy.author} / ${copy.source} |\n| --- | --- | --- | --- |\n${index}\n\n## ${copy.use}\n\n${copy.steps}\n\n## ${copy.contribute}\n\n${copy.submit}\n\n[${copy.more}](https://github.com/pagepop/awesome-ai-prompts-and-use-cases)\n\n${copy.rights}\n\n${copy.node}\n`;
}
function promptDocument(entry: PublicCase): string {
  const longestBackticks = Math.max(0, ...Array.from(entry.prompt.matchAll(/`+/g), match => match[0].length));
  const fence = '`'.repeat(Math.max(3, longestBackticks + 1));
  const links = LOCALES.map(locale => `- [${LANGUAGES[locale]}](${trackedUrl(entry.locales[locale].detailUrl, locale, 'prompt')})`).join('\n');
  return `<!-- Generated from data/cases.json. -->\n\n# ${entry.title}\n\n${entry.description}\n\n[![${md(entry.title)}](${entry.coverUrl})](${trackedUrl(entry.locales['en-US'].detailUrl, 'en-US', 'prompt-cover')})\n\n[Watch](${trackedUrl(entry.locales['en-US'].detailUrl, 'en-US', 'prompt-preview')})\n\nOriginal author: [${md(entry.source.authorName)}](${entry.source.authorUrl}) · [Original X post](${entry.source.url})\n\n## Original English prompt\n\nThe source prompt below is preserved verbatim, including any follow-up instructions.\n\n${fence}text\n${entry.prompt}\n${fence}\n\n## Languages\n\n${links}\n\n[All examples](../README.md) · [Rights and attribution](../RIGHTS.md)\n\nThis is a community example credited to its original author. Third-party prompts and media retain their original rights.\n`;
}
export function renderFiles(input: PublicData): Map<string, string> {
  const data = validateData(input);
  const files = new Map<string, string>();
  for (const locale of LOCALES) files.set(readmeName(locale), readme(data, locale));
  for (const entry of data.cases) files.set(`prompts/${entry.slug}.md`, promptDocument(entry));
  return files;
}
