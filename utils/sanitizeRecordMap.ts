import { Block, ExtendedRecordMap } from 'notion-types';

type BlockEntry = { value?: Block; role?: string; id?: string };

/** Unwrap Notion API records nested as { value, role, id } inside .value. */
export function unwrapBlockValue(value: unknown): Block | undefined {
  let current = value as BlockEntry | Block | undefined;

  while (
    current &&
    typeof current === 'object' &&
    'value' in current &&
    'role' in current &&
    !('type' in current)
  ) {
    current = (current as BlockEntry).value as Block | BlockEntry | undefined;
  }

  return current && typeof current === 'object' && 'type' in current
    ? (current as Block)
    : undefined;
}

function filterContentIds(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  return content.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function normalizeBlockMap(map: Record<string, BlockEntry | Block | undefined> | undefined) {
  if (!map) {
    return;
  }

  for (const [key, entry] of Object.entries(map)) {
    if (!entry) {
      continue;
    }

    const raw = 'value' in entry ? entry.value : entry;
    const unwrapped = unwrapBlockValue(raw);
    if (!unwrapped) {
      continue;
    }

    if (!unwrapped.id) {
      unwrapped.id = key;
    }

    const filtered = filterContentIds(unwrapped.content);
    if (filtered) {
      unwrapped.content = filtered;
    }

    map[key] = {
      value: unwrapped,
      role: 'role' in entry && entry.role ? entry.role : 'reader',
      id: key,
    };
  }
}

function normalizeRecordMapEntries<T extends { id?: string }>(
  map: Record<string, { value?: T; role?: string; id?: string } | undefined> | undefined
) {
  if (!map) {
    return;
  }

  for (const [key, entry] of Object.entries(map)) {
    if (!entry?.value) {
      continue;
    }

    if (!entry.value.id) {
      entry.value.id = key;
    }

    entry.id = key;
  }
}

/** Normalizes record map shape so react-notion-x receives blocks with valid `type` and `id`. */
export function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  normalizeBlockMap(recordMap.block);
  normalizeRecordMapEntries(recordMap.collection);
  normalizeRecordMapEntries(recordMap.collection_view);

  return recordMap;
}

export function getPageBlockFromRecordMap(recordMap: ExtendedRecordMap, pageId?: string) {
  if (pageId) {
    const byId = recordMap.block[pageId]?.value;
    if (byId?.type === 'page' || byId?.type === 'collection_view_page') {
      return byId;
    }
  }

  for (const entry of Object.values(recordMap.block)) {
    const block = entry?.value;
    if (block?.type === 'page' || block?.type === 'collection_view_page') {
      return block;
    }
  }

  return undefined;
}
