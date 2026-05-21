import { ExtendedRecordMap } from 'notion-types';
import { getBlockIcon, isUrl } from 'notion-utils';
import { getPageBlockFromRecordMap } from './sanitizeRecordMap';

export function getPageIcon(
  recordMap: ExtendedRecordMap,
  defaultIcon?: string,
  pageId?: string
) {
  const pageBlock = getPageBlockFromRecordMap(recordMap, pageId);
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

  if (icon.startsWith('attachment:') && recordMap.signed_urls?.[pageBlock.id]) {
    return encodeURIComponent(recordMap.signed_urls[pageBlock.id]);
  }

  return defaultIcon;
}
