# Screenshots

Every screenshot on the site is made by these scripts, in English and Turkish, light and dark
(`static/img/screens/<scene>.<locale>.<theme>.webp`). Pages show them with
`<Screenshot id="<scene>" alt="…" />` (`src/components/Screenshot.tsx`).

Two steps, so that the images are the same bytes on every run:

| Step | Needs | Does |
|---|---|---|
| **record** | docker, k3d, kubectl, git, Chrome | a throwaway k3d cluster with the release in `config.json`, the workloads of `seed/workloads.yaml`, users and activity from `seed.mjs`; then every scene of `scenes.mjs` is clicked through and its API answers (`fixtures/<scene>.har`) and WebSocket frames (`fixtures/<scene>.json`) are saved |
| **shoot** | docker, Chrome | the release image in a local container serves the UI; the API and WebSockets are answered from `fixtures/`, the clock is fixed to the recording time; every scene × locale × theme is written as WebP |

```bash
# when the UI changed (a new release): record again, then shoot
npm run screenshots:record          # cluster.sh up + seed.mjs + record.mjs (run ./screenshots/cluster.sh forward in another terminal first)
npm run screenshots                 # shoot.mjs; a review of the changed images is the PR diff
./screenshots/cluster.sh down       # delete the k3d cluster

# one scene only
node screenshots/record.mjs logs && node screenshots/shoot.mjs logs
```

- Bump `version` in `config.json` with the release; record and shoot pull that image.
- A scene's `run()` clicks in English; `shoot.mjs` switches the language at the end. Wait only for things that are in
  the recording.
- `shoot.mjs` warns about API requests without a recording: record that scene again.
- Same fixtures → same files. Each scene gets a fresh Chrome (text rendering depends on what the browser drew
  before), and an image is rewritten only when more than 0.5 % of its pixels changed: a few screens draw a handful
  of pixels differently from run to run (asynchronous UI timing). `MIN_CHANGE=0` rewrites everything; a scene whose
  background is unstable is clipped to its dialog (`clip` in `scenes.mjs`); terminal, log and chart scenes have a
  larger `tolerance`.
- Chrome: `CHROME_PATH` (default: the macOS app). It is started by the scripts with software rendering, which is what
  keeps the pixels identical between runs.
- The seed is fictitious (shop, payments, alice, bob); no hostnames, real users or real tokens end up in an image.
- `.work/` (kubeconfig, tokens, debug PNGs) is not committed.
