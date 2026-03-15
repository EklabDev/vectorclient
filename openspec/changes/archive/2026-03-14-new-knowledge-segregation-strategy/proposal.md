## Why

When a schema is published from the frontend, the backend uses an LLM (e.g. ChatGPT) to segregate the content into chunks and store them in Weaviate. That segregation often loses important detail—especially URLs, email addresses, and phone numbers—because the chunking is tuned for high-level understanding rather than preserving concrete, actionable information. At the same time, clients and AI agents that query Weaviate for "related" information find it hard to narrow results when they only have chunk content and originalReference; adding semantic labels (category and subcategory) to each chunk would make it easier to query and retrieve related information.

## What Changes

- **Chunking strategy**: Change the segregation/chunking process so that it preserves fine-grained detail (URLs, emails, phone numbers, and similar concrete data) in chunk content and in originalReference, instead of summarizing or dropping them. Chunks should still be factual and self-contained but retain most detail from the source.
- **Weaviate schema**: Add two new properties to the Weaviate chunk objects—**category** and **subcategory** (e.g. text or string). These are populated when chunks are created (e.g. by the chunking step or a dedicated classification step) so that queries can filter or group by category/subcategory for related-information retrieval.
- **Publish flow**: The existing publish flow (frontend trigger → backend chunking → Weaviate write) continues; the chunking step and Weaviate write are updated to produce and store the richer chunks plus category and subcategory. No change to the API contract for triggering publish.

## Capabilities

### New Capabilities

- **chunking-detail-preservation**: The chunking process (e.g. LLM-based segregation) preserves URLs, email addresses, phone numbers, and other concrete detail in both the chunk content and the originalReference. Chunks remain factual and self-contained but are no longer lossy for these detail types.
- **weaviate-chunk-category**: Each Weaviate chunk object includes optional **category** and **subcategory** properties (e.g. text). These are set at chunk creation time and are available for filtering and for querying related information alongside content and originalReference.

### Modified Capabilities

- (None — no existing specs in `openspec/specs/` for this repo.)

## Impact

- **Chunking service**: Prompt and/or response handling updated to enforce detail preservation and to produce category and subcategory per chunk (if done in the same step). Tests may need to assert preservation of URLs/emails/phones and presence of category/subcategory.
- **Weaviate**: Collection schema for schema chunks gains `category` and `subcategory` (e.g. text); sync/update write path must set them. Existing collections may need a migration or re-publish to add the new properties.
- **Consumers**: Downstream callers (e.g. AI agents, n8n) that query Weaviate can use category and subcategory for filtering or related-information retrieval; they can rely on chunk content and originalReference retaining URLs, emails, and phone numbers where present in the source.
