// The endpoint reference must have one page per operation of the OpenAPI
// description (M21 acceptance): two operations with the same summary would
// share one page, and a page would silently go missing. Run after
// `npm run build` (it counts the generated pages and the built ones).
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import yaml from 'js-yaml';

const root = new URL('..', import.meta.url);
const spec = yaml.load(readFileSync(new URL('openapi/openapi.yaml', root), 'utf8'));
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const ops = Object.values(spec.paths).reduce((n, item) => n + methods.filter((m) => m in item).length, 0);
const generated = readdirSync(new URL('docs/api/endpoints/', root)).filter((f) => f.endsWith('.api.mdx'));
const ids = generated.map((f) => f.replace(/\.api\.mdx$/, ''));
const built = ids.filter((id) => existsSync(new URL(`build/api/endpoints/${id}.html`, root)) || existsSync(new URL(`build/api/endpoints/${id}/index.html`, root)));
console.log(`operations in openapi.yaml: ${ops}; endpoint pages generated: ${generated.length}; built: ${built.length}`);
if (generated.length !== ops || built.length !== ops) {
  console.error('The endpoint reference does not have one page per operation (duplicate summary?).');
  process.exit(1);
}
