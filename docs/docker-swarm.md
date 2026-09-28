# VectorClient on Docker Swarm

Single-node Swarm stack for ArcadeDB, Redis, the API, and the dashboard. Use it to verify the topic filter before pointing clients at the agent URL.

The Node image Dockerfiles pin `linux/arm64`. That matches Apple Silicon. On an amd64 Swarm node, remove the `--platform=linux/arm64/v8` lines in `backend/Dockerfile` and `frontend/Dockerfile` before building.

## 1. Start the stack

From the repository root, with Docker running:

```bash
docker swarm init
docker compose -f docker-stack.yml build
set -a && source backend/.env && set +a
docker stack deploy -c docker-stack.yml vectorclient
```

`backend/.env` must define `OPENAI_API_KEY`. `AES_SECRET` must be at least 32 characters. ArcadeDB and Redis stay on the overlay network and are not published to the host.

```bash
docker stack services vectorclient
docker service logs -f vectorclient_backend
```

Wait until the backend log contains `Server running at http://localhost:3001`.

| URL | Role |
| --- | --- |
| http://localhost:3000 | Dashboard |
| http://localhost:3001/health | API health (`{"status":"ok"}`) |

Stop the stack:

```bash
docker stack rm vectorclient
```

Volumes `vectorclient_arcadedb_data` and `vectorclient_redis_data` survive `stack rm`.

## 2. How the topic filter decides

`POST /api/v1/agents/:endpoint_id/:user_id` runs a small classifier **before** the RAG tool loop, and only when **all** of these are true:

1. The endpoint topic filter is enabled (the default).
2. At least one **published** schema is linked to the endpoint (scrape collections count too).
3. The classifier call to OpenAI succeeds.

| Situation | `filtered` | What `reply` is |
| --- | --- | --- |
| Filter on, published schema linked, message is off-topic (poem, math, sports, general knowledge) | `true` | The endpoint off-topic reply. RAG does not run. |
| Filter on, published schema linked, message is about that knowledge | `false` | Answer from the agent tools |
| Filter turned off | `false` | Answer from the agent tools |
| Filter on, but no published schema (or scrape source) is linked | `false` | Answer from the agent tools. The gate is skipped. |
| Filter on, but the classifier request fails | `false` | Answer from the agent tools. The gate fails open. |

The default off-topic reply is:

> I can only help with questions about this organization and its programs. Please ask about schedules, offerings, enrollment, or contact information.

A message is not filtered just because it looks short or unfamiliar. With no published knowledge linked, an off-topic prompt still returns `"filtered": false`.

## 3. Test the filter

Register, publish a schema, link it, then send one off-topic and one on-topic message.

```bash
BASE=http://localhost:3001

TOKEN=$(curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"username":"filterdemo","password":"filterdemo1","email":"filterdemo@example.com","displayName":"Filter Demo"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

AUTH="Authorization: Bearer $TOKEN"

SCHEMA=$(curl -s -X POST "$BASE/api/schemas" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "name": "Youth programs",
    "content": "Robotics Youth Squad meets Saturdays at 10:00 at the main hall. Enrollment is open for ages 8 to 14.",
    "systemPrompt": "Answer only about this organization programs, schedules, enrollment, and contact details.",
    "isPublished": true
  }')
SCHEMA_ID=$(printf '%s' "$SCHEMA" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

APIKEY_JSON=$(curl -s -X POST "$BASE/api/tokens" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"tokenName":"filter-test"}')
API_KEY=$(printf '%s' "$APIKEY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
API_KEY_ID=$(printf '%s' "$APIKEY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tokenId"])')

ENDPOINT=$(curl -s -X POST "$BASE/api/endpoints" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{
    \"routeName\": \"Filter demo\",
    \"schemaIds\": [\"$SCHEMA_ID\"],
    \"apiTokenIds\": [\"$API_KEY_ID\"],
    \"topicFilter\": {\"enabled\": true}
  }")
ENDPOINT_ID=$(printf '%s' "$ENDPOINT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
USER_ID=$(printf '%s' "$ENDPOINT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["userId"])')
```

If register returns “already exists”, log in with `POST /auth/login` and reuse the existing username and password. Creating a token returns the raw `token` only once.

Off-topic (expect filtered):

```bash
curl -s -X POST "$BASE/api/v1/agents/$ENDPOINT_ID/$USER_ID" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{"message":"Write me a poem about cats"}'
```

Expected:

```json
{
  "reply": "I can only help with questions about this organization and its programs. Please ask about schedules, offerings, enrollment, or contact information.",
  "conversation_id": "<uuid>",
  "filtered": true
}
```

On-topic (expect RAG, not the canned reply):

```bash
curl -s -X POST "$BASE/api/v1/agents/$ENDPOINT_ID/$USER_ID" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{"message":"When does Robotics Youth Squad meet?"}'
```

Expected shape:

```json
{
  "reply": "<answer that mentions Saturday or 10:00, not the canned off-topic sentence>",
  "conversation_id": "<uuid>",
  "filtered": false
}
```

Turn the filter off and repeat the poem. Expected: `"filtered": false` and a normal agent reply.

```bash
curl -s -X PATCH "$BASE/api/endpoints/$ENDPOINT_ID" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"topicFilter":{"enabled":false}}'
```
