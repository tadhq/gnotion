import { Block, ExtendedRecordMap } from 'notion-types';
import { getPageContentBlockIds, parsePageId } from 'notion-utils';
import notion from './notion';
import { sanitizeRecordMap } from './sanitizeRecordMap';

const CHUNK_LIMIT = 250;
const MAX_FETCH_ROUNDS = 25;
const BLOCK_BATCH_SIZE = 50;

function collectIdsFromRichText(value: unknown, ids: Set<string>) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const segment of value) {
    if (!Array.isArray(segment)) {
      continue;
    }

    if (segment[0] === '‣' && Array.isArray(segment[1])) {
      const pointer = segment[1][0];
      if (Array.isArray(pointer) && pointer[0] === 'p' && typeof pointer[1] === 'string') {
        ids.add(pointer[1]);
      }
    }

    for (const nested of segment) {
      if (Array.isArray(nested)) {
        collectIdsFromRichText(nested, ids);
      }
    }
  }
}

function collectReferencedBlockIds(recordMap: ExtendedRecordMap): Set<string> {
  const ids = new Set<string>(getPageContentBlockIds(recordMap));

  for (const entry of Object.values(recordMap.block)) {
    const block = entry?.value;
    if (!block) {
      continue;
    }

    if (Array.isArray(block.content)) {
      for (const id of block.content) {
        if (typeof id === 'string' && id.length > 0) {
          ids.add(id);
        }
      }
    }

    if (block.properties) {
      for (const prop of Object.values(block.properties)) {
        collectIdsFromRichText(prop, ids);
      }
    }

    const transclusionId = block.format?.transclusion_reference_pointer?.id;
    if (transclusionId) {
      ids.add(transclusionId);
    }

    const aliasId = block.format?.alias_pointer?.id;
    if (aliasId) {
      ids.add(aliasId);
    }
  }

  return ids;
}

function extractRelationPageIds(block: Block, recordMap: ExtendedRecordMap): string[] {
  if (block.parent_table !== 'collection' || !block.parent_id) {
    return [];
  }

  const collection = recordMap.collection[block.parent_id]?.value;
  if (!collection?.schema || !block.properties) {
    return [];
  }

  const pageIds: string[] = [];

  for (const propertyId of Object.keys(block.properties)) {
    if (collection.schema[propertyId]?.type !== 'relation') {
      continue;
    }

    const decorations = block.properties[propertyId];
    if (!Array.isArray(decorations)) {
      continue;
    }

    const ids = new Set<string>();
    collectIdsFromRichText(decorations, ids);
    pageIds.push(...Array.from(ids));
  }

  return pageIds;
}

async function fetchMissingBlocks(recordMap: ExtendedRecordMap, blockIds: string[]) {
  for (let i = 0; i < blockIds.length; i += BLOCK_BATCH_SIZE) {
    const batch = blockIds.slice(i, i + BLOCK_BATCH_SIZE);
    try {
      const response = await notion.getBlocks(batch);
      if (response?.recordMap?.block) {
        recordMap.block = { ...recordMap.block, ...response.recordMap.block };
      }
    } catch (err) {
      console.warn('getBlocks error', batch, err);
    }
  }
}

async function syncRecords(
  recordMap: ExtendedRecordMap,
  requests: Array<{ id: string; table: 'block' | 'collection' | 'collection_view' }>
) {
  if (!requests.length) {
    return;
  }

  try {
    const response: { recordMap?: ExtendedRecordMap } = await notion.fetch({
      endpoint: 'syncRecordValues',
      body: {
        requests: requests.map(({ id, table }) => ({ table, id, version: -1 })),
      },
    });

    if (response?.recordMap?.block) {
      recordMap.block = { ...recordMap.block, ...response.recordMap.block };
    }
    if (response?.recordMap?.collection) {
      recordMap.collection = { ...recordMap.collection, ...response.recordMap.collection };
    }
    if (response?.recordMap?.collection_view) {
      recordMap.collection_view = {
        ...recordMap.collection_view,
        ...response.recordMap.collection_view,
      };
    }
  } catch (err) {
    console.warn('syncRecordValues error', err);
  }
}

async function ensureParentCollection(recordMap: ExtendedRecordMap, pageId: string) {
  const pageBlock = recordMap.block[pageId]?.value;
  if (pageBlock?.parent_table !== 'collection' || !pageBlock.parent_id) {
    return;
  }

  const collectionId = pageBlock.parent_id;
  if (!recordMap.collection[collectionId]?.value) {
    await syncRecords(recordMap, [{ id: collectionId, table: 'collection' }]);
  }
}

export async function getNotionPage(pageParam: string): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageParam, {
    chunkLimit: CHUNK_LIMIT,
    concurrency: 8,
    fetchMissingBlocks: true,
    fetchCollections: true,
    signFileUrls: true,
  });

  recordMap = sanitizeRecordMap(recordMap);

  const pageId = parsePageId(pageParam);
  if (pageId) {
    await ensureParentCollection(recordMap, pageId);

    const pageBlock = recordMap.block[pageId]?.value;
    if (pageBlock) {
      const relationIds = extractRelationPageIds(pageBlock, recordMap).filter(
        (id) => !recordMap.block[id]
      );
      if (relationIds.length) {
        await fetchMissingBlocks(recordMap, relationIds);
        recordMap = sanitizeRecordMap(recordMap);
      }
    }
  }

  for (let round = 0; round < MAX_FETCH_ROUNDS; round++) {
    const referenced = collectReferencedBlockIds(recordMap);
    const missing = Array.from(referenced).filter((id) => !recordMap.block[id]);

    if (!missing.length) {
      break;
    }

    await fetchMissingBlocks(recordMap, missing);
    recordMap = sanitizeRecordMap(recordMap);
  }

  try {
    await notion.addSignedUrls({ recordMap });
  } catch (err) {
    console.warn('addSignedUrls error', err);
  }

  return sanitizeRecordMap(recordMap);
}
