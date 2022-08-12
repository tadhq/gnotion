import dynamic from 'next/dynamic';
import Head from 'next/head';
import { getPageTitle } from 'notion-utils';
import { NotionRenderer } from 'react-notion-x';
import notion from '../utils/notion';

/**
 * @param {{ recordMap: import('notion-types').ExtendedRecordMap }} props
 */
export default function Page({ recordMap }) {
  if (!recordMap) return null;

  const title = getPageTitle(recordMap);

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <NotionRenderer
        recordMap={recordMap}
        disableHeader={true}
        fullPage={true}
        components={{ Code }}
      />
    </>
  );
}

/**
 * @param {import('next').NextPageContext} context
 */
export async function getStaticProps(context) {
  /** @type String  */
  const pageId = context.params.pageId;
  const recordMap = await notion.getPage(pageId);

  return {
    props: {
      recordMap,
    },
  };
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: true,
  };
}

/**
 * Optional Components
 */

const Code = dynamic(() =>
  import('react-notion-x/build/third-party/code').then((m) => m.Code),
);
