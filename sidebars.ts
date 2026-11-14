import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

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
        'administration/users',
        'administration/groups-roles',
        'administration/ldap',
        'administration/azure-ad',
        'administration/prometheus',
        'administration/sessions',
        'administration/recordings',
        'administration/admin-tools',
      ],
    },
    {type: 'category', label: 'API & agents', items: ['api/api-keys']},
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
        'reference/audit-events',
      ],
    },
    'release-notes',
  ],
};

export default sidebars;
