## ADDED Requirements

### Requirement: Authenticated Weaviate object list for a published schema

The system SHALL expose an API to list objects in the Weaviate collection for a schema when the schema belongs to the authenticated user, `isPublished` is true, and `weaviateCollectionId` is set. The response MUST include at most **500** objects in a single response and MUST include **`truncated: true`** when the collection contains more than 500 objects.

#### Scenario: List objects for owned published schema

- **WHEN** an authenticated user requests objects for their schema that is published and has a Weaviate collection
- **THEN** the system returns up to 500 objects with chunk properties needed for display (e.g. content, originalReference, category, subcategory, chunkIndex, schemaId, schemaName, version) and `truncated` as specified

#### Scenario: Unpublished or foreign schema denied

- **WHEN** the schema is not published, has no collection, or does not belong to the user
- **THEN** the system denies the request with an appropriate error and does not list Weaviate data

### Requirement: Search with BM25 or nearText via POST

The system SHALL expose **`POST /schemas/:id/weaviate/search`** (or equivalent path under schema scope) accepting JSON **`{ "query": string, "mode": "bm25" | "vector" }`**. The system MUST reject queries exceeding a configured maximum length (e.g. 4096 characters). **BM25** mode SHALL use Weaviate BM25 search; **vector** mode SHALL use **`nearText` only** (not `nearVector`). The system MUST return at most **10** results per request.

#### Scenario: BM25 search

- **WHEN** the user sends a valid POST body with `mode: "bm25"` and a non-empty `query` under the length limit
- **THEN** the system returns up to 10 matching objects (or empty array if none)

#### Scenario: Vector search via nearText

- **WHEN** the user sends a valid POST body with `mode: "vector"` and a non-empty `query`
- **THEN** the system returns up to 10 results from nearText semantic search

#### Scenario: Overlong query rejected

- **WHEN** `query` exceeds the configured maximum length
- **THEN** the system responds with a client error and does not call Weaviate with the full string

### Requirement: Weaviate object create, update, delete with confirmation in UI

The system SHALL allow authenticated users to create, update, and delete objects in their schema’s Weaviate collection only when the schema is published and owned. The **Edit** UI MUST show an explicit confirmation step before each create, update, or delete is sent to the backend.

#### Scenario: Update chunk content only

- **WHEN** the user PATCHes a Weaviate object with body containing only **`content`**
- **THEN** the system applies the update and rejects bodies that include other property keys (e.g. schemaName, chunkIndex)

#### Scenario: System prompt not on object PATCH

- **WHEN** the user edits **`systemPrompt`** for the knowledge base
- **THEN** that change uses the existing schema update API (`PATCH /schemas/:id`), not the Weaviate object PATCH

#### Scenario: Confirmation before mutation

- **WHEN** the user initiates create, update, or delete in Edit mode
- **THEN** the UI presents a confirmation prompt; only after confirmation does the client send the mutation request
