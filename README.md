# Kubernetes OpenConsole documentation

Source of the documentation site for [Kubernetes OpenConsole](https://github.com/vurulkan/kubernetes-openconsole),
published at **https://vurulkan.com/openconsole-docs/**. Built with [Docusaurus 3](https://docusaurus.io/).

```bash
npm ci
npm start          # http://localhost:3000/openconsole-docs/, live reload (English only)
npm run build      # what CI runs: fails on a broken link or anchor
npm run serve      # serve the build (both locales, search works here)
```

- Pages live in `docs/`, the sidebar in `sidebars.ts`, the home page in `src/pages/index.tsx`.
- `docs/release-notes.md` is generated from the code repo's GitHub releases before every build
  (`scripts/release-notes.mjs`); don't edit or commit it.
- Every pull request is built in CI (the site is attached as the `site-preview` artifact). A merge to `main`
  publishes the site. After a release of the code repo, refresh the release notes:
  `gh workflow run docs.yml -R vurulkan/openconsole-docs`.
- The docs describe the latest release (`:latest` image). Write about a new feature when its release ships.
