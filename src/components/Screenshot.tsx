import type {ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import ThemedImage from '@theme/ThemedImage';
import sizes from '@site/static/img/screens/screens.json';

type Props = {
  /** scene id from screenshots/scenes.mjs */
  id: string;
  /** what the image shows, for screen readers */
  alt: string;
  caption?: ReactNode;
};

// Picks the screenshot for the page's language and the reader's theme. Images are
// made by `npm run screenshots` (screenshots/shoot.mjs) in en / tr × light / dark.
export default function Screenshot({id, alt, caption}: Props): ReactNode {
  const {i18n} = useDocusaurusContext();
  const locale = i18n.currentLocale === 'tr' ? 'tr' : 'en';
  const size = (sizes as Record<string, {width: number; height: number}>)[id];
  if (!size) throw new Error(`Screenshot "${id}" is missing: add it to screenshots/scenes.mjs and run npm run screenshots`);
  const src = (theme: string) => useBaseUrl(`/img/screens/${id}.${locale}.${theme}.webp`);
  return (
    <figure className="oc-screenshot">
      <ThemedImage alt={alt} width={size.width} height={size.height} loading="lazy"
        sources={{light: src('light'), dark: src('dark')}} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
