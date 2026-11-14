import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

// The endpoint pages' parameter and schema lists render <ul> with <div> items
// (docusaurus-theme-openapi-docs), which screen readers don't read as a list.
// Give those items the listitem role whenever they appear (they render late).
const ITEMS = 'ul > div.openapi-params__list-item, ul > div.openapi-schema__list-item';

function fix(): void {
  document.querySelectorAll(ITEMS).forEach((item) => {
    if (item.getAttribute('role') !== 'listitem') item.setAttribute('role', 'listitem');
  });
}

if (ExecutionEnvironment.canUseDOM) {
  new MutationObserver(fix).observe(document.documentElement, {childList: true, subtree: true});
}

export function onRouteDidUpdate(): void {
  fix();
}
