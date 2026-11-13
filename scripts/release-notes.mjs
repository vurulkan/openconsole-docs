// Writes docs/release-notes.md from the code repository's GitHub releases.
// Runs before every build / start (npm prebuild / prestart). The file is
// generated, never edited by hand (it is in .gitignore).
// GITHUB_TOKEN (set in CI) raises the API rate limit; without it the public API is used.
import {writeFileSync} from 'node:fs';

const REPO = 'vurulkan/kubernetes-openconsole';
const OUT = new URL('../docs/release-notes.md', import.meta.url);

async function fetchReleases() {
  const headers = {Accept: 'application/vnd.github+json', 'User-Agent': 'openconsole-docs'};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const all = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, {headers});
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

// Release bodies use ## / ### headings; under the per-release ## they move down one level.
const demote = (body) =>
  body.replace(/\r\n/g, '\n').replace(/^(#{1,5}) /gm, (_, h) => `#${h} `);

const releases = (await fetchReleases()).filter((r) => !r.draft && !r.prerelease);
const parts = [
  '---',
  'title: Release notes',
  'slug: /release-notes',
  'description: What changed in each Kubernetes OpenConsole release.',
  'hide_table_of_contents: false',
  '---',
  '',
  '# Release notes',
  '',
  `Every release of [${REPO}](https://github.com/${REPO}/releases), newest first. ` +
    'The image of a release is `ghcr.io/vurulkan/kubernetes-openconsole:X.Y.Z`; ' +
    'read the notes of every version you skip before upgrading ([Upgrading](/installation/upgrading)).',
  '',
];
for (const r of releases) {
  const date = (r.published_at || r.created_at).slice(0, 10);
  parts.push(`## ${r.tag_name} {#${r.tag_name.replace(/\./g, '-')}}`, '');
  parts.push(`*${date}* · [on GitHub](${r.html_url})`, '');
  parts.push(demote(r.body || '').trim(), '');
}
writeFileSync(OUT, parts.join('\n'));
console.log(`release-notes: ${releases.length} releases → docs/release-notes.md`);
