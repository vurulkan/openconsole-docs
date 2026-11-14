import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
// Generated from openapi/openapi.yaml by `npm run api-docs` (not committed).
import endpoints from './docs/api/endpoints/sidebar';

// The information architecture of M17: M18–M22 fill these sections.
const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    'features',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: [
        'getting-started/quick-start',
        'getting-started/try-on-k3d',
        'getting-started/first-login',
      ],
    },
    {
      type: 'category',
      label: 'Installation',
      collapsed: false,
      items: [
        'installation/kubernetes',
        'installation/verify-image',
        'installation/connect-cluster',
        'installation/upgrading',
        'installation/backup-restore',
        'installation/uninstall',
        'installation/build-from-source',
      ],
    },
    {
      type: 'category',
      label: 'User guide',
      items: [
        'user-guide/signing-in',
        'user-guide/cluster-and-namespace',
        'user-guide/dashboard',
        'user-guide/pod-health',
        'user-guide/detail-drawers',
        'user-guide/logs',
        'user-guide/pod-shell',
        'user-guide/yaml',
        'user-guide/restart-scale',
        'user-guide/secrets',
        'user-guide/views-and-events',
        'user-guide/keyboard-shortcuts',
        'user-guide/api-keys',
      ],
    },
    {
      type: 'category',
      label: 'Administration',
      items: [
        'administration/access-model',
        'administration/recipes',
        'administration/roles',
        'administration/users',
        'administration/ldap',
        'administration/azure-ad',
        'administration/clusters',
        'administration/prometheus',
        'administration/overview-and-nodes',
        'administration/sessions',
        'administration/recordings',
        'administration/api-access-policy',
        'administration/audit-log',
        'administration/customization-and-flags',
      ],
    },
    {
      type: 'category',
      label: 'API & agents',
      items: [
        'api/overview',
        'api/quick-start',
        'api/agent-recipes',
        'api/limits',
        {
          type: 'category',
          label: 'Endpoint reference',
          link: {type: 'doc', id: 'api/endpoints/openconsole-api'},
          // The first item is the API overview page, used as the category link.
          items: (endpoints as Extract<SidebarsConfig[string], unknown[]>).slice(1),
        },
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'operations/logging',
        'operations/tracing',
        'operations/metrics',
        'operations/security',
        'operations/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/environment-variables',
        'reference/permissions',
        'reference/kubernetes-permissions',
        'reference/audit-events',
        'reference/metrics',
        'reference/keyboard-shortcuts',
      ],
    },
    'release-notes',
  ],
};

export default sidebars;
