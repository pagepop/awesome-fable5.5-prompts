import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCatalog, LOCALES } from './catalog.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const rootIndex = args.indexOf('--catalog-root');
if (rootIndex === -1 || !args[rootIndex + 1] || args[rootIndex + 1]!.startsWith('--') || args.length !== (check ? 3 : 2)) {
  throw new Error('Usage: node scripts/import.ts --catalog-root <directory> [--check]');
}
const catalogRoot = resolve(args[rootIndex + 1]!);
async function json(path: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
  catch (error) { throw new Error(`Required catalog could not be read: ${path}`, { cause: error }); }
}
const shared = await json(join(catalogRoot, 'shared-cases.json'));
const catalogs = Object.fromEntries(await Promise.all(LOCALES.map(async locale => [locale, await json(join(catalogRoot, locale, 'catalog.json'))])));
const data = importCatalog(shared, catalogs);
const output = `${JSON.stringify(data, null, 2)}\n`;
const destination = fileURLToPath(new URL('../data/cases.json', import.meta.url));
if (check) {
  if (await readFile(destination, 'utf8') !== output) throw new Error('Public export differs from source; re-import and review changes');
  console.log(`Source integrity passed: ${data.cases.length} exact prompt texts and provenance, ${LOCALES.length} locales, attribution and CDN URLs match.`);
} else {
  await mkdir(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true });
  await writeFile(destination, output);
  console.log(`Exported ${data.cases.length} cases and ${LOCALES.length} locales to data/cases.json.`);
}
