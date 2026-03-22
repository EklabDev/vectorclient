## Why

Vectorclient already lets users publish and unpublish schema knowledge to Weaviate, but they cannot inspect what was stored, correct mistakes, or manage individual chunk objects without leaving the app. Operators need in-app visibility and control over the vector store for a given schema, aligned with how dedicated tools like [weviateview](https://github.com/EklabDev/weviateview) expose collections (tables, search, CRUD). Separately, schema cards only preview body content, so `system_prompt` and whether data is actually present in Weaviate are easy to miss; publish/unpublish can take a long time and the UI should make in-progress work obvious.

## What Changes

- **View (schema page)**: For each schema, **View** opens a flow to browse the Weaviate collection tied to that schema (when published): list objects/chunks in a table-oriented UI with patterns similar to weviateview (pagination, readable properties such as content, originalReference, category, subcategory, chunk metadata).
- **Edit (schema page)**: **Edit** opens a Weaviate-focused experience where users can **create**, **read**, **update**, and **delete** objects in that schema’s collection (within app auth and safety rules). After any **edit** (create/update/delete), the system **prompts the user to confirm** before the change is applied (or shows a confirmation step appropriate to the action—e.g. confirm before submit).
- **Publish/Unpublish feedback**: Add or strengthen a **loading indicator** during publish and unpublish (e.g. spinner or overlay in addition to disabled button text) so long-running operations are visibly in progress.
- **Schema card preview**: Cards show **system_prompt** (when set) and, when the schema is **published**, the **number of records** (objects) in the associated Weaviate collection; continue showing content preview as today.

## Capabilities

### New Capabilities

- **weaviate-schema-explorer**: In-app exploration of a schema’s Weaviate collection when published: View lists objects in a weviateview-like table/explorer; Edit enables CRUD on those objects. User must confirm edits (create/update/delete) via an explicit confirmation prompt before changes are committed.
- **schema-card-vector-metadata**: Schema list cards display `system_prompt` when present and, when published, the Weaviate object count for that schema’s collection.
- **schema-publish-loading-indicator**: Publish and Unpublish actions show a clear loading state (e.g. spinner/busy overlay) for the duration of the operation, not only a disabled button label.

### Modified Capabilities

- (None listed in `openspec/specs/` for this repo—treat as new capabilities unless main specs are added later.)

## Impact

- **Frontend**: Schemas page (View/Edit entry points, new explorer/CRUD views or modals, card layout), API client for new endpoints, loading UI for publish/unpublish.
- **Backend**: New authenticated routes to resolve collection name per schema, fetch object counts, list objects (paginated), and create/update/delete objects in Weaviate; reuse/extend `WeaviateService` (GraphQL/REST as appropriate). Must respect environment (dev/uat/prod) and existing auth.
- **Weaviate**: Same collections as today; no required schema change unless listing/filtering needs new fields exposed.
- **Reference UX**: [EklabDev/weviateview](https://github.com/EklabDev/weviateview)—desktop Electron app; vectorclient should echo similar information architecture (collections → objects table → CRUD) within the web app, not embed the Electron app.
