import { ExtendedRecordMap } from 'notion-types';

function filterContentIds(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  return content.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function sanitizeBlockMap<T extends { id?: string; content?: unknown }>(
  map: Record<string, { value?: T } | undefined> | undefined
) {
  if (!map) {
    return;
  }

  for (const [key, entry] of Object.entries(map)) {
    const value = entry?.value;
    if (!value) {
      continue;
    }

    if (!value.id) {
      value.id = key;
    }

    const filtered = filterContentIds(value.content);
    if (filtered) {
      value.content = filtered as T['content'];
    }
  }
}

/** Ensures block ids exist and content arrays omit empty ids (Notion API edge cases). */
export function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  sanitizeBlockMap(recordMap.block);
  sanitizeBlockMap(recordMap.collection);
  sanitizeBlockMap(recordMap.collection_view);

  return recordMap;
}
