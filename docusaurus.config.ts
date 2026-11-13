import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Where the site is served. Moving it (custom domain, another repo) changes
// only these two lines, plus static/CNAME for a custom domain.
const SITE_URL = 'https://vurulkan.com';
const BASE_URL = '/openconsole-docs/';

const CODE_REPO = 'https://github.com/vurulkan/kubernetes-openconsole';

const config: Config = {
  title: 'Kubernetes OpenConsole',
  tagline:
    'A web console for several Kubernetes clusters, with access granted in the app and every action audited.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: SITE_URL,
  baseUrl: BASE_URL,
  trailingSlash: false,

  organizationName: 'vurulkan',
  projectName: 'openconsole-docs',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onDuplicateRoutes: 'throw',

  markdown: {
    // .md is plain CommonMark (release notes and README text may hold `<` and `{`);
    // .mdx for pages that use components.
    format: 'detect',
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    // tr is filled in M23; until then it has no dropdown entry.
    locales: ['en', 'tr'],
    localeConfigs: {
      en: {label: 'English', htmlLang: 'en'},
      tr: {label: 'Türkçe', htmlLang: 'tr'},
    },
  },

  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap',
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en', 'tr'],
        indexBlog: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/vurulkan/openconsole-docs/edit/main/',
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/screenshot-dark.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'OpenConsole',
      logo: {
        alt: 'Kubernetes OpenConsole',
        src: 'img/logo.svg',
      },
      items: [
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
        {to: '/release-notes', label: 'Release notes', position: 'left'},
        {href: CODE_REPO, label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Quick start', to: '/getting-started/quick-start'},
            {label: 'Install on Kubernetes', to: '/installation/kubernetes'},
            {label: 'API and agents', to: '/api/api-keys'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'Source code', href: CODE_REPO},
            {label: 'Releases', href: `${CODE_REPO}/releases`},
            {label: 'Issues', href: `${CODE_REPO}/issues`},
          ],
        },
      ],
      copyright: `Kubernetes OpenConsole. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'sql', 'ruby'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
