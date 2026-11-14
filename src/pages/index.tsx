import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ThemedImage from '@theme/ThemedImage';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

type Feature = {title: string; text: string; to: string; icon: ReactNode};

// Lucide-style icons (stroke, 24 px grid), as in the app.
const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const FEATURES: Feature[] = [
  {
    title: 'Access granted in the app',
    text: 'Users, groups and roles grant actions per cluster and namespace. People never get Kubernetes credentials; the console reads each cluster with one ServiceAccount. Local, LDAP and Azure AD accounts.',
    to: '/administration/access-model',
    icon: icon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  },
  {
    title: 'Every action audited',
    text: 'Reads and writes, sign-ins, denied calls: one structured event each, in the app and on stdout (ECS for Elastic). Pod shells are recorded and can be replayed.',
    to: '/reference/audit-events',
    icon: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></>),
  },
  {
    title: 'Why a pod is failing',
    text: 'Pod status as kubectl prints it, the last exit code explained, the log before the restart, CPU and memory against limits, restart history, an overview and a node screen for admins.',
    to: '/user-guide/pod-health',
    icon: icon(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  },
  {
    title: 'An API for scripts and agents',
    text: 'Scoped API keys that never exceed their owner, an OpenAPI 3.1 description, logs and one command over plain REST. Claude Code or Cursor work with the same rules as people.',
    to: '/api/api-keys',
    icon: icon(<><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>),
  },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="Kubernetes OpenConsole"
      description="A web console for several Kubernetes clusters, with access granted in the app and every action audited.">
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.title}>Kubernetes OpenConsole</Heading>
          <p className={styles.tagline}>
            A web console for several Kubernetes clusters. People see and operate the workloads their
            roles allow; every action is audited.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/getting-started/quick-start">
              Quick start
            </Link>
            <Link className="button button--secondary button--outline button--lg"
              href="https://github.com/vurulkan/kubernetes-openconsole">
              GitHub
            </Link>
          </div>
          <ThemedImage
            className={styles.shot}
            alt="The OpenConsole Dashboard: the Pods tab with crash-looping and healthy pods, their status, containers and restarts"
            sources={{
              light: useBaseUrl('/img/screenshot-light.png'),
              dark: useBaseUrl('/img/screenshot-dark.png'),
            }}
          />
        </div>
      </header>
      <main className="container">
        <section className={styles.features} aria-label="Highlights">
          {FEATURES.map((f) => (
            <Link key={f.title} to={f.to} className={styles.card}>
              <span className={styles.icon}>{f.icon}</span>
              <Heading as="h2" className={styles.cardTitle}>{f.title}</Heading>
              <p>{f.text}</p>
            </Link>
          ))}
        </section>
      </main>
    </Layout>
  );
}
