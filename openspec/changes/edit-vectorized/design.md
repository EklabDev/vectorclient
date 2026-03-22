## Context

- **Current state**: Schemas live in Postgres (`schemas` table) with `weaviateCollectionId`, `isPublished`, `systemPrompt`, `content`, etc. Publish/unpublish flows call `WeaviateService` to sync or delete the Weaviate class. Class naming is deterministic: `Schema_{schemaId}` with hyphens → underscores (`weaviateService.ts` `getClassName`). The frontend schemas page has View/Edit for the **Postgres** knowledge document; Publish/Unpublish uses `togglingId` and button text (“Publishing…”) but no overlay/spinner. List API returns full schema rows including `systemPrompt` but cards may not surface it or Weaviate counts.
- **Stakeholders**: Authenticated schema owners (same JWT model as existing `/schemas` routes).
- **Constraints**: Reuse existing Fastify + Drizzle + `WeaviateService` patterns; no new external services; respect dev/uat/prod via env (`WEAVIATE_URL`, etc.). Weaviate client is already `weaviate-ts-client` v2. Target **latest Weaviate**. For semantic search from a text query, use **`nearText` only** (no `nearVector` in v1).

## Goals / Non-Goals

**Goals:**

- Backend APIs scoped by `schemaId` that verify the schema belongs to the user, is published, and has a collection before listing/counting or mutating Weaviate objects.
- Frontend: **View** = read-only explorer (**table, no pagination**—single load up to **500** objects; scroll in UI) plus **search**: **BM25** and **vector** modes with a **toggle**, **default BM25**; vector mode uses **`nearText`** only. **Edit** = same data with CRUD + **explicit confirmation** before each create/update/delete is sent.
- Cards: show truncated `system_prompt` and **object count** when published (count from Weaviate or cached field—see decisions).
- Publish/Unpublish: visible **loading indicator** (e.g. spinner on button or row overlay) for the whole operation duration.

**Non-Goals:**

- Embedding or shipping the [weviateview](https://github.com/EklabDev/weviateview) Electron app; only borrow UX patterns (table, search, CRUD flows)—**not** pagination.
- Changing Weaviate class schema or chunking pipeline.
- Public/unauthenticated access to Weaviate data.
- Bulk import/export or **hybrid** (BM25 + vector combined) search in v1 — optional follow-up; v1 uses **either** BM25 **or** vector per toggle, not hybrid in the same query unless we add it later.

## Decisions

1. **API surface (backend)**  
   - **Choice**: Add authenticated routes under the existing schemas plugin, e.g. `GET /schemas/:id/weaviate/objects` (**no pagination**—up to **500** objects; see **Decision 3**), **`POST /schemas/:id/weaviate/search`** with JSON body `{ "query": string, "mode": "bm25" | "vector" }` (up to **10** hits; see **Decision 9**—**POST** avoids long queries in the URL and URL-length limits), `GET /schemas/:id/weaviate/count`, `POST/PATCH/DELETE /schemas/:id/weaviate/objects/:objectId` (or RESTful body for create without objectId). `PATCH` body for objects is whitelisted per **Decision 10**. Handlers load schema by `id` + `userId`, require `isPublished === true` and non-null `weaviateCollectionId`, then delegate to `WeaviateService` methods.  
   - **Rationale**: Keeps authorization in one place; collection name resolved from stored `weaviateCollectionId` or derived class name consistent with `getClassName(schemaId)` (verify both match to avoid drift).  
   - **Alternative**: Separate `/weaviate` router with collection name in URL — rejected (easier to forge another user’s class name).

2. **Resolving collection / class name**  
   - **Choice**: Use `weaviateCollectionId` from DB when present; if missing but published, treat as error or optional fallback to `getClassName(schemaId)` only after verifying expected naming convention.  
   - **Rationale**: Matches how publish stores the collection id today.

3. **List shape (no pagination)**  
   - **Choice**: **No pagination.** `GET .../weaviate/objects` fetches objects in **one** Weaviate query with a **server-enforced maximum of 500** objects. Response is `{ objects: [...] }` and **`truncated: true`** when the collection has more than 500 objects. UI uses a scrollable table.  
   - **Rationale**: Product choice to avoid cursor/offset UX and API surface.  
   - **Trade-off**: Collections with more than 500 objects are partially shown; true total still available via count endpoint.

4. **Object count for cards**  
   - **Choice A (preferred for accuracy)**: `GET /schemas/:id/weaviate/count` (or include in list response when `?includeCount=1`) called when rendering cards for published schemas — may N+1 on list page; mitigate with optional batch endpoint `POST /schemas/weaviate/counts` with body `{ ids: string[] }` returning `{ id: count }`.  
   - **Choice B**: Store `weaviateObjectCount` on `schemas` row updated on publish/sync/CRUD — fewer Weaviate calls but risk of drift.  
   - **Recommendation for v1**: Batch count endpoint or single count per card fetch with client-side caching to avoid blocking list; document drift risk if not using B.

5. **Confirmation UX**  
   - **Choice**: For **Edit** mode only: before submitting create/update/delete, show a modal summarizing the action (e.g. “Delete object …”, “Update fields: …”). User confirms → then HTTP request. View mode has no mutations.  
   - **Rationale**: Matches proposal; avoids accidental deletes.

6. **View vs Edit UI**  
   - **Choice**: Same route or modal shell with `mode=view|edit` query param, or two buttons opening the same component with `readOnly` prop. View hides create/update/delete controls.  
   - **Rationale**: Less duplication than two unrelated UIs.

7. **Publish/Unpublish loading**  
   - **Choice**: When `togglingId === schema.id`, show a small spinner next to the button and/or semi-transparent overlay on the schema card row.  
   - **Rationale**: Clearer than text-only for long OpenAI+Weaviate operations.

8. **OpenAPI**  
   - **Choice**: If the repo keeps `docs/openapi.yaml`, add the new paths and response shapes there (file-only, consistent with prior changes).

9. **View: BM25 vs vector search**  
   - **Choice**: On the **View** explorer, provide a **toggle**: **BM25** | **Vector**. Default **BM25**. Search is **`POST /schemas/:id/weaviate/search`** with body **`{ query, mode }`** (`mode`: `bm25` | `vector`) so long queries are not sent as URL query strings. Validate **`query`** with a **reasonable max length** (e.g. 2–8K characters—pick at implementation) to avoid abuse and oversized payloads. **BM25** uses Weaviate GraphQL **`bm25`**. **Vector** mode uses **`nearText` only**. **Fixed limit of 10** results per search. **List** remains **500** max.  
   - **Rationale**: POST avoids browser/proxy URL limits; body max length caps pathological requests.  
   - **Alternative**: `nearVector` — rejected for v1.

10. **PATCH: allowed editable fields**  
   - **Choice**: Strictly limit what clients may change:  
     - **`PATCH .../schemas/:id/weaviate/objects/:objectId`** (Weaviate chunk update): body **only** **`content`**. Reject **`schemaName`** and all other keys (`originalReference`, `chunkIndex`, `schemaId`, `version`, `category`, `subcategory`, etc.) in v1.  
     - **`system_prompt`**: Not on Weaviate objects; it lives on the **schema** row in Postgres. Updates use **`PATCH /schemas/:id`** with **`systemPrompt`** when the user edits the prompt—**not** the Weaviate object PATCH. Edit UI may change chunk `content` and schema `systemPrompt` via **two API calls** (object PATCH + schema PATCH).  
   - **Rationale**: Chunk `schemaName` stays publish-time data; no in-explorer rename of that property.

## Risks / Trade-offs

- **[Risk] Weaviate list performance on large collections** → Mitigation: **500**-object list cap; **`truncated`** flag; search capped at **10**.  
- **[Risk] Count/batch count load on Weaviate** → Mitigation: batch endpoint, debounce, or cache short TTL in UI.  
- **[Risk] Manual CRUD desyncs vectors** → Editing text properties may require re-vectorization depending on Weaviate config; document that changing `content` may not update vectors until re-publish or a future “re-vectorize” feature.  
- **[Risk] Drift between DB `isPublished` and Weaviate** → Existing; explorer returns 404/403-style errors if collection missing.

## Migration Plan

1. Extend `WeaviateService`: `listObjects` with **limit 500** (no cursor), `getObjectCount(className)`, `searchObjects` with **`limit` 10** and `mode: 'bm25' | 'vector'` (vector = **nearText** only), `createObject`, `updateObject` (whitelist **`content`** only), `deleteObject`.  
2. Add Fastify routes + Zod validation; wire to schema ownership checks.  
3. Frontend: API client, explorer component, integrate View/Edit entry points from schemas page; card layout + count fetch; loading overlay for publish.  
4. Tests: service unit tests with mocked client where feasible; route tests optional if pattern exists.  
5. Rollback: feature-flag or revert routes/UI; no DB migration required unless choosing stored count (Decision 4B).

## Open Questions

- None.
