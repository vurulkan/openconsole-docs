// openapi/openapi.yaml is the code repo's file as is (servers: "/", right for
// an agent reading it from its own OpenConsole). The site shows absolute
// example URLs instead, so the endpoint pages are generated from a copy whose
// server is the address the other pages use as OC_URL, and whose descriptions
// say what the x-openconsole-* fields say (permission, admin, web only).
import {readFileSync, writeFileSync} from 'node:fs';
import yaml from 'js-yaml';

const root = new URL('..', import.meta.url);
const spec = yaml.load(readFileSync(new URL('openapi/openapi.yaml', root), 'utf8'));
for (const item of Object.values(spec.paths)) {
  for (const op of Object.values(item)) {
    if (!op || typeof op !== 'object' || !op.summary) continue;
    const notes = [];
    const perm = op['x-openconsole-permission'];
    if (perm?.length) {
      const list = perm.map((p) => `\`${p}\``).join(' and ');
      notes.push(`**Permission:** ${list} in the namespace of the path ([permissions](/reference/permissions)).`);
    }
    if (op['x-openconsole-admin']) notes.push('**Admin only**; with an API key, only an admin\'s key with the Admin API scope.');
    if (op['x-openconsole-api-key'] === false) notes.push('**Web session only:** an API key gets 403 `api_key_not_allowed`.');
    if (notes.length) op.description = [notes.join(' '), op.description].filter(Boolean).join('\n\n');
  }
}
spec.servers = [{url: 'https://openconsole.example.com', description: 'Your OpenConsole address (OC_URL)'}];
writeFileSync(new URL('openapi/openapi.site.yaml', root), yaml.dump(spec, {lineWidth: -1}));
