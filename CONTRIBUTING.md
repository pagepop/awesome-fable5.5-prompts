# Contributing

Share a useful community example by opening an issue or pull request. Include:

- The original public post and the original author's profile.
- The original prompt when available, including any follow-up instructions.
- A viewable result and a cover, with permission and rights information where applicable.
- A short description of what makes the example useful.

Preserve author credit and original prompt wording. Do not claim that PagePop or Anthropic produced or tested a community example. Do not upload video binaries, secrets, customer information, private source code, or internal paths. If you own a listed work and want a correction or removal, open an issue with its source link and the requested change.

## Maintain the collection

Use **Node.js 24** (native TypeScript) and npm. TypeScript and Node types are development dependencies; there are no runtime dependencies.

```sh
npm ci
npm run validate
```

`data/cases.json` is the only case-data input for generated documents. It contains public metadata, prompts, production CDN links, author/source attribution, and localized metadata. Locale website URLs are canonical in the data; generated website links add GitHub referral UTM parameters. To update public data directly, preserve its strict schema, then regenerate:

```sh
npm run generate
npm run validate
```

The collection is curated daily and can grow without a fixed case limit. Each case may specify `promptKind: "original"` or `promptKind: "pagepop-recreation"`; an omitted `promptKind` means `original`. Preserve original prompts exactly. PagePop recreation briefs use the heading “Recreate in PagePop” and must not be presented as the creator's original prompt. A publicly available original prompt is not required for inclusion. Do not hand-edit generated `README*.md` or `prompts/*.md` files.

## Import a catalog snapshot

The optional importer accepts a local catalog directory with `shared-cases.json` and `<locale>/catalog.json` for each of `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `es-ES`, `fr-FR`, `de-DE`, and `pt-BR`. Catalog snapshots are not included in this repository.

```sh
npm run import -- --catalog-root /path/to/catalog
npm run generate
npm run check:source -- --catalog-root /path/to/catalog
npm run validate
```

The importer selects all cases whose `discovery.modelIds` includes `claude-fable-5-5`, requires a nonempty collection, and orders it by `popularPinOrder`. It copies the shared English prompt text and optional `promptKind` unchanged, even when a locale has a translated prompt. Each locale must explicitly contain every case. String references use shared metadata; object entries supply their localized title and description. Missing required fields, duplicate ordering, missing locales, invalid provenance, invalid attribution, or non-production CDN URLs cause explicit errors. Only whitelisted public fields leave the importer. The original published prompts have byte-integrity regression checks.

## Checks

```sh
npm run typecheck     # strict TypeScript checks
npm test             # import, validation, provenance and rendering regression tests
npm run check        # schema, generated-file drift, local links and media exclusion
npm run check:links  # optional live website/CDN HEAD checks; no media downloads
```

The PR/push workflow runs `npm run validate`. It never imports private catalogs, publishes content, enables GitHub Pages, or schedules external writes. Live-link checks run on demand so an external service outage does not rewrite the collection or obscure a source-data error.

Repository-authored scripts use the MIT license. A contribution must respect the original rights of any third-party prompt or media; see [RIGHTS.md](RIGHTS.md).
