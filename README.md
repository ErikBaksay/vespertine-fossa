# Prompt Queue

A calm, local-first staging area for prompts you want to use later. Built with Angular 22, standalone components, strict TypeScript, SCSS, Angular CDK drag/drop, and Dexie. It is not an AI client.

## Develop

Use Node.js 24 LTS and npm.

```sh
npm install
npm start
```

Open http://localhost:4200. Icons and fonts are bundled locally; installation requires npm access, but app features do not call external services.

```sh
npm run build   # dist/prompt-queue/browser
npm test        # focused persistence and backup tests
```

## Use

- Create/edit prompts with multiline bodies, tags, and original attachments. Drag a card by its handle, or focus the handle and use Up/Down, to reorder it.
- Copy buttons copy the full text, including whitespace. Attachments are used separately: open an image and right-click **Copy image**, or download the original file. Clipboard APIs require HTTPS or localhost and browser permission.
- Add files with the picker, drag/drop, or paste images into the editor. Supported raster images display at their original resolution through Blob URLs; thumbnails never replace original bytes. Text files have safe plain-text previews. Other formats (including SVG and HTML) are downloaded rather than executed or embedded.
- Manage quick prompts and snippets in their own views. Search matches titles, full bodies, and tags across the queue and both libraries; searching from Archive includes archived prompts instead of active prompts.
- Archive prompts, restore them, or confirm permanent deletion. Deleting a prompt also deletes its attachments.
- Settings offers density, actual browser usage/quota estimates, and a request for persistent storage. The light theme is defined with CSS tokens for future extension.

## Storage and privacy

All prompt text, records, and original attachment Blobs live in the origin's IndexedDB database, `prompt-queue`. Dexie schema version 1 is declared explicitly; add subsequent `.version(n).stores(...).upgrade(...)` migrations without changing previously shipped versions. A transactional metadata marker seeds editable examples once, even after you delete all samples. Only the density preference is in localStorage. Dexie live queries update open views when records change.

There are no accounts, backend, AI APIs, analytics, telemetry, remote fonts, or runtime third-party requests. GitHub serves static application files and receives ordinary hosting requests; it does not receive your workspace data. Data is scoped to a browser profile and origin, not synchronized or encrypted by this app. Sites sharing an origin share its storage security boundary. Clearing browser/site data removes the workspace. Persistence grants reduce automatic eviction but do not prevent manual deletion. This version does not install an offline service worker.

## Backup and restore

**Export / Import** exports a versioned ZIP with `metadata.json` and unmodified binary files in `attachments/`. Backups include active/archived prompts, ordering, libraries, tags, and preferences. Files are neither uploaded nor encrypted.

Imports validate structure, record IDs, parent relationships, dates, sizes, archive paths, and expansion limits before writing. **Merge** keeps existing records/settings and adds copies with new IDs and appended ordering. **Replace** requires an explicit acknowledgement and restores records/settings in one database transaction; a failed write rolls back. Importing the same backup repeatedly in Merge mode creates duplicates by design.

ZIP processing currently uses memory: limits are 512 MiB compressed, 1 GiB expanded, 256 MiB per file, 10 MiB metadata, and 4,999 attachments. Export fails explicitly if a workspace exceeds those limits; it never silently leaves files out. Keep regular backups outside browser storage.

## GitHub Pages

Push to `main`, then select **Settings → Pages → Source → GitHub Actions** in the repository. `.github/workflows/deploy.yml` installs locked dependencies, runs tests, builds production, and deploys the static artifact. `actions/configure-pages` supplies the base path to `ng build --base-href`; no repository name is hard-coded. Project sites, root user sites, and configured custom domains use their reported Pages path. Navigation uses URL fragments, so refreshing `REPOSITORY/#snippets` works on static hosting.

The workflow is configured here; deployment requires your GitHub repository and Pages to be enabled. Do not publish personal ZIP backups in the repository.

## Structure

- `src/app/core`: typed models, versioned database, reactive store, clipboard, Blob/download helpers, settings/storage, backup validation.
- `src/app/features`: prompt editor/cards, reusable libraries, backup and settings screens.
- `src/app/shared`: icons, native accessible dialogs, attachment thumbnails and original-file viewer.
- `src/app/app.component.*`: workspace shell, hash navigation, search, and screen coordination.
