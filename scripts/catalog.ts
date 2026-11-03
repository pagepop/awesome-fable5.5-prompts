export const LOCALES = ['en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR'] as const;
export type Locale = typeof LOCALES[number];
export const PREFIXES: Record<Locale, string> = {
  'en-US': '', 'zh-CN': '/zh-cn', 'zh-TW': '/zh-tw', 'ja-JP': '/jp',
  'ko-KR': '/ko', 'es-ES': '/es', 'fr-FR': '/fr', 'de-DE': '/de', 'pt-BR': '/pt-br',
};
export const ORIGIN = 'https://www.pagepop.ai';
export const MODEL = { id: 'claude-fable-5-5', name: 'Claude Fable 5.5' } as const;
export type LocalizedCase = { title: string; description: string; detailUrl: string; topicUrl: string };
export type PublicCase = {
  slug: string; title: string; description: string; prompt: string; videoUrl: string; coverUrl: string;
  source: { url: string; authorName: string; authorUrl: string };
  locales: Record<Locale, LocalizedCase>;
};
export type PublicData = { schemaVersion: 1; model: typeof MODEL; cases: PublicCase[] };

type JsonObject = Record<string, unknown>;
function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`);
  return value as JsonObject;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected array`);
  return value;
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label}: required nonempty string`);
  return value;
}
function exactKeys(value: JsonObject, keys: readonly string[], label: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${label}: unexpected field ${key}`);
  for (const key of keys) if (!(key in value)) throw new Error(`${label}: missing ${key}`);
}
function https(value: unknown, label: string, hosts: readonly string[]): string {
  const text = string(value, label);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error(`${label}: invalid URL`); }
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) {
    throw new Error(`${label}: expected HTTPS on ${hosts.join(' or ')}`);
  }
  return text;
}
export function detailUrl(locale: Locale, slug: string): string { return `${ORIGIN}${PREFIXES[locale]}/use-cases/${slug}`; }
export function topicUrl(locale: Locale): string { return `${ORIGIN}${PREFIXES[locale]}/use-cases/models/${MODEL.id}`; }
export function categoryUrl(locale: Locale): string { return `${ORIGIN}${PREFIXES[locale]}/use-cases/categories/video`; }

export function validateData(value: unknown): PublicData {
  const data = object(value, 'data');
  exactKeys(data, ['schemaVersion', 'model', 'cases'], 'data');
  if (data.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  const model = object(data.model, 'model');
  exactKeys(model, ['id', 'name'], 'model');
  if (model.id !== MODEL.id || model.name !== MODEL.name) throw new Error('Unexpected model');
  const cases = array(data.cases, 'cases');
  if (cases.length !== 14) throw new Error(`Expected exactly 14 cases, received ${cases.length}`);
  const seen = new Set<string>();
  for (const [index, raw] of cases.entries()) {
    const entry = object(raw, `cases[${index}]`);
    exactKeys(entry, ['slug', 'title', 'description', 'prompt', 'videoUrl', 'coverUrl', 'source', 'locales'], `cases[${index}]`);
    const slug = string(entry.slug, 'slug');
    if (!/^fable55-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) throw new Error(`Invalid or duplicate slug: ${slug}`);
    seen.add(slug);
    for (const key of ['title', 'description', 'prompt']) string(entry[key], `${slug}.${key}`);
    https(entry.videoUrl, `${slug}.videoUrl`, ['agent-imagex.pagepop.cn']);
    https(entry.coverUrl, `${slug}.coverUrl`, ['agent-imagex.pagepop.cn']);
    if (!new URL(entry.videoUrl as string).pathname.endsWith('.mp4')) throw new Error(`${slug}.videoUrl must point to an mp4`);
    const source = object(entry.source, `${slug}.source`);
    exactKeys(source, ['url', 'authorName', 'authorUrl'], `${slug}.source`);
    string(source.authorName, `${slug}.source.authorName`);
    https(source.url, `${slug}.source.url`, ['x.com', 'twitter.com']);
    https(source.authorUrl, `${slug}.source.authorUrl`, ['x.com', 'twitter.com']);
    const sourcePath = new URL(source.url as string).pathname;
    const authorPath = new URL(source.authorUrl as string).pathname;
    if (!/^\/[A-Za-z0-9_]+\/status\/\d+$/.test(sourcePath) || sourcePath.split('/')[1]?.toLowerCase() !== authorPath.slice(1).toLowerCase()) {
      throw new Error(`${slug}.source: original post and author must match`);
    }
    const localized = object(entry.locales, `${slug}.locales`);
    exactKeys(localized, LOCALES, `${slug}.locales`);
    for (const locale of LOCALES) {
      const text = object(localized[locale], `${slug}.${locale}`);
      exactKeys(text, ['title', 'description', 'detailUrl', 'topicUrl'], `${slug}.${locale}`);
      string(text.title, `${slug}.${locale}.title`);
      string(text.description, `${slug}.${locale}.description`);
      if (text.detailUrl !== detailUrl(locale, slug)) throw new Error(`${slug}.${locale}.detailUrl: incorrect localized route`);
      if (text.topicUrl !== topicUrl(locale)) throw new Error(`${slug}.${locale}.topicUrl: incorrect localized route`);
    }
    const english = object(localized['en-US'], `${slug}.en-US`);
    if (english.title !== entry.title || english.description !== entry.description) throw new Error(`${slug}: English metadata mismatch`);
  }
  if (object(cases[0], 'first case').slug !== 'fable55-the-moss-keeper' || object(cases[1], 'second case').slug !== 'fable55-the-last-page') {
    throw new Error('Expected The Moss Keeper first and The Last Page second');
  }
  return data as unknown as PublicData;
}

export function importCatalog(sharedValue: unknown, catalogsValue: unknown): PublicData {
  const shared = object(sharedValue, 'shared catalog');
  const sharedCases = object(shared.cases, 'shared cases');
  const catalogs = object(catalogsValue, 'locale catalogs');
  const entries = Object.values(sharedCases).map(raw => object(raw, 'shared case')).filter(entry => {
    const discovery = object(entry.discovery, `${String(entry.slug)}.discovery`);
    return array(discovery.modelIds, `${String(entry.slug)}.modelIds`).includes(MODEL.id);
  });
  if (entries.length !== 14) throw new Error(`Expected exactly 14 ${MODEL.id} cases, received ${entries.length}`);
  const pins = new Set<number>();
  for (const entry of entries) {
    const pin = object(entry.discovery, `${String(entry.slug)}.discovery`).popularPinOrder;
    if (typeof pin !== 'number' || !Number.isSafeInteger(pin) || pin < 1 || pins.has(pin)) throw new Error(`${String(entry.slug)}.popularPinOrder: required unique positive integer`);
    pins.add(pin);
  }
  entries.sort((a, b) => (object(a.discovery, 'discovery').popularPinOrder as number) - (object(b.discovery, 'discovery').popularPinOrder as number));
  const localeEntries = new Map<Locale, Map<string, unknown>>();
  for (const locale of LOCALES) {
    const catalog = object(catalogs[locale], `${locale} catalog`);
    if (catalog.locale !== locale) throw new Error(`${locale}: catalog locale mismatch`);
    const bySlug = new Map<string, unknown>();
    for (const raw of array(catalog.cases, `${locale}.cases`)) {
      const slug = typeof raw === 'string' ? raw : String(object(raw, `${locale} case`).ref ?? object(raw, `${locale} case`).slug);
      if (bySlug.has(slug)) throw new Error(`${locale}: duplicate case ${slug}`);
      bySlug.set(slug, raw);
    }
    localeEntries.set(locale, bySlug);
  }
  const cases = entries.map(entry => {
    const slug = string(entry.slug, 'slug');
    if (entry.category !== 'video') throw new Error(`${slug}: expected video category`);
    const result = object(entry.result, `${slug}.result`);
    if (result.kind !== 'video') throw new Error(`${slug}: expected video result`);
    const assets = array(result.assets, `${slug}.assets`);
    const coverIndex = result.coverAssetIndex;
    if (typeof coverIndex !== 'number' || !Number.isSafeInteger(coverIndex)) throw new Error(`${slug}.coverAssetIndex: required integer`);
    const asset = object(assets[coverIndex], `${slug}.selected video asset`);
    if (asset.kind !== 'video') throw new Error(`${slug}: selected asset must be video`);
    const source = object(object(entry.discovery, `${slug}.discovery`).source, `${slug}.source`);
    if (source.modelId !== MODEL.id) throw new Error(`${slug}.source.modelId mismatch`);
    const locales = Object.fromEntries(LOCALES.map(locale => {
      const raw = localeEntries.get(locale)!.get(slug);
      if (raw === undefined) throw new Error(`${locale}: missing required case ${slug}`);
      const text = typeof raw === 'string' ? entry : object(raw, `${slug}.${locale}`);
      // A string reference explicitly uses shared metadata; an override must supply both fields.
      return [locale, {
        title: string(text.title, `${slug}.${locale}.title`),
        description: string(text.description, `${slug}.${locale}.description`),
        detailUrl: detailUrl(locale, slug), topicUrl: topicUrl(locale),
      }];
    })) as Record<Locale, LocalizedCase>;
    return {
      slug, title: locales['en-US'].title, description: locales['en-US'].description,
      prompt: string(entry.prompt, `${slug}.prompt`),
      videoUrl: string(asset.url, `${slug}.videoUrl`), coverUrl: string(asset.coverUrl, `${slug}.coverUrl`),
      source: { url: string(source.url, `${slug}.source.url`), authorName: string(source.authorName, `${slug}.source.authorName`), authorUrl: string(source.authorUrl, `${slug}.source.authorUrl`) },
      locales,
    };
  });
  return validateData({ schemaVersion: 1, model: MODEL, cases });
}
