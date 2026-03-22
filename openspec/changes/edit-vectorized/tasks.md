## 1. WeaviateService

- [x] 1.1 Add `listObjectsForClass` (or equivalent): single fetch, limit **500**, return objects + `truncated` when more than 500 exist
- [x] 1.2 Add `getObjectCount` for a class name
- [x] 1.3 Add `searchObjects`: **POST**-backed handler support for `mode` **bm25** | **vector** (`nearText` only), limit **10**, validate query max length (e.g. 4096)
- [x] 1.4 Add `createObject`, `updateObject` (body whitelist **`content` only), `deleteObject` for chunk class
- [x] 1.5 Add unit tests with mocked Weaviate client where feasible (`resolveClassName` + existing sync tests)

## 2. Backend routes (schemas + Weaviate)

- [x] 2.1 Implement `GET /schemas/:id/weaviate/objects` with ownership + published + collection checks
- [x] 2.2 Implement `GET /schemas/:id/weaviate/count`
- [x] 2.3 Implement `POST /schemas/:id/weaviate/search` with Zod body `{ query, mode }` and query length cap
- [x] 2.4 Implement `POST /schemas/:id/weaviate/objects`, `PATCH .../objects/:objectId` (content only), `DELETE .../objects/:objectId`
- [x] 2.5 Register routes in Fastify alongside existing `schemaRoutes`; reuse JWT auth pattern
- [x] 2.6 Optional: `POST /schemas/weaviate/counts` batch for N+1 mitigation on schema list

## 3. OpenAPI

- [x] 3.1 Document new Weaviate sub-routes and payloads in `docs/openapi.yaml`

## 4. Frontend API client

- [x] 4.1 Add typed functions for list, count, search (POST), create, patch content, delete

## 5. Explorer UI (View / Edit)

- [x] 5.1 Add View flow from schemas page: open explorer read-only when published; table up to 500 rows, scroll; show `truncated` warning when true
- [x] 5.2 Add BM25 | Vector toggle (default BM25); wire to `POST` search with limit 10
- [x] 5.3 Add Edit flow: same explorer with CRUD; confirmation modal before each create/update/delete; chunk `content` via object API; `systemPrompt` via existing schema PATCH when exposed in UI
- [x] 5.4 Distinguish existing “View/Edit” for Postgres document vs new Weaviate explorer entry points (labels/routes as designed)

## 6. Schema cards and publish loading

- [x] 6.1 Show `systemPrompt` on cards when present; fetch and show Weaviate **count** when published
- [x] 6.2 Add spinner and/or row overlay during publish/unpublish (`togglingId` path)

## 7. Tests and verification

- [x] 7.1 Add or extend frontend tests for confirmation flow and loading UI if project pattern supports it — **N/A**: frontend has no Vitest/Jest; UI covered manually
- [x] 7.2 Manual smoke: list, search both modes, patch content, delete with confirm, card count, publish overlay
