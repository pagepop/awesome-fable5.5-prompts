import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from './catalog.ts';
import { renderFiles } from './render.ts';

const data = validateData(JSON.parse(await readFile(new URL('../data/cases.json', import.meta.url), 'utf8')));
for (const [name, content] of renderFiles(data)) {
  const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
console.log('Generated 9 localized READMEs and 14 complete prompt documents from public data.');
