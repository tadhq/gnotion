import { ExtendedRecordMap } from 'notion-types';
import { getBlockIcon, isUrl } from 'notion-utils';

function getPageBlock(recordMap: ExtendedRecordMap) {
  const blocks = Object.values(recordMap.block);
  return (
    blocks.find((b) => b?.value?.type === 'page')?.value ??
    blocks.find((b) => b?.value?.type === 'collection_view_page')?.value ??
    recordMap.block[Object.keys(recordMap.block)[0]]?.value
  );
}

export function getPageIcon(recordMap: ExtendedRecordMap, defaultIcon?: string) {
  const pageBlock = getPageBlock(recordMap);
  if (!pageBlock) {
    return defaultIcon;
  }

  const icon = getBlockIcon(pageBlock, recordMap)?.trim();
  if (!icon) {
    return defaultIcon;
  }

  if (isUrl(icon)) {
    return encodeURIComponent(icon);
  }

  if (icon.startsWith('/icons/')) {
    return encodeURIComponent(`https://www.notion.so${icon}?mode=light`);
  }

  // Emoji and other non-URL icons cannot be used in OG images
  return defaultIcon;
}
