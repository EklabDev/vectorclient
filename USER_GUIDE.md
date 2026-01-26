# VectorClient API Gateway - User Guide

This guide provides documentation for three types of users: Web Developers, n8n Developers, and Account Owners.

---

## Table of Contents

1. [Web Developer Guide](#web-developer-guide)
2. [n8n Developer Guide](#n8n-developer-guide)
3. [Account Owner Guide](#account-owner-guide)

---

## Web Developer Guide

### Overview
As a web developer, you'll be calling the VectorClient API Gateway's dynamic routes to forward requests to configured endpoints. The gateway handles authentication, validation, and request forwarding.

### Base URL
```
https://your-api-gateway-domain.com/api/v1/endpoints
```

### Endpoint Structure
```
POST /api/v1/endpoints/:endpoint_id/:user_id
```

### Authentication
All requests must include an API token in the `x-api-key` header:
```
x-api-key: sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Request Format

#### Headers
- **Required:**
  - `Content-Type: application/json`
  - `x-api-key: <your-api-token>`
  
- **Optional:**
  - `Authorization: Bearer <token>` (will be forwarded to target endpoint)
  - `User-Agent: <your-user-agent>` (will be forwarded to target endpoint)

#### Request Body
The request body must be **JSON only**. Multipart/form-data is **NOT supported**.

**Important:** If you need to upload files:
1. Upload files to S3 (or your preferred storage)
2. Include the S3 URL or file reference in your JSON request body
3. Ask the n8n developer to configure the webhook to retrieve files from S3

#### Request Body Structure
You can include any JSON fields in your request body. The gateway will automatically add the following base schema fields:

```json
{
  "user_id": "<user_id>",
  "endpoint_id": "<endpoint_id>",
  "schema_id": "<schema_id>",  // Only if endpoint has associated schemas
  // ... your custom fields here
}
```

**Example Request:**
```json
{
  "customer_id": "12345",
  "order_amount": 99.99,
  "payment_method": "credit_card",
  "file_url": "https://s3.amazonaws.com/bucket/file.pdf"
}
```

**What Gets Forwarded:**
The gateway will forward a combined body that includes:
1. Base schema fields (user_id, endpoint_id, schema_id)
2. All your custom fields from the request body

**Example Forwarded Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "endpoint_id": "660e8400-e29b-41d4-a716-446655440001",
  "schema_id": "770e8400-e29b-41d4-a716-446655440002",
  "customer_id": "12345",
  "order_amount": 99.99,
  "payment_method": "credit_card",
  "file_url": "https://s3.amazonaws.com/bucket/file.pdf"
}
```

### Complete Example

```javascript
// JavaScript/TypeScript Example
const endpointId = '660e8400-e29b-41d4-a716-446655440001';
const userId = '550e8400-e29b-41d4-a716-446655440000';
const apiToken = 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const response = await fetch(
  `https://your-api-gateway-domain.com/api/v1/endpoints/${endpointId}/${userId}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiToken,
    },
    body: JSON.stringify({
      customer_id: '12345',
      order_amount: 99.99,
      payment_method: 'credit_card',
      file_url: 'https://s3.amazonaws.com/bucket/file.pdf'
    })
  }
);

const data = await response.json();
console.log(data);
```

```bash
# cURL Example
curl -X POST \
  https://your-api-gateway-domain.com/api/v1/endpoints/660e8400-e29b-41d4-a716-446655440001/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "customer_id": "12345",
    "order_amount": 99.99,
    "payment_method": "credit_card",
    "file_url": "https://s3.amazonaws.com/bucket/file.pdf"
  }'
```

### Response Codes

- **200 OK**: Request forwarded successfully
- **400 Bad Request**: Invalid request (e.g., route must be a full URL)
- **403 Forbidden**: 
  - Invalid API token
  - API token expired
  - API token not authorized for this endpoint
  - API token required (when endpoint has associated tokens)
- **404 Not Found**: Endpoint not found or inactive
- **500 Internal Server Error**: Server error

### Error Response Format
```json
{
  "message": "Error description"
}
```

### Important Notes

1. **No Multipart/Form-Data**: The API only accepts `application/json`. For file uploads, use S3 and include the URL in your JSON body.

2. **Base Schema Fields**: The gateway automatically adds `user_id`, `endpoint_id`, and `schema_id` to your request. You don't need to include these in your request body.

3. **Custom Fields**: Any additional fields you include will be merged with the base schema fields and forwarded to the target endpoint.

4. **API Token**: Your API token must be associated with the endpoint you're calling. Contact the account owner to get your API token and ensure it's linked to the correct endpoint.

---

## n8n Developer Guide

### Overview
As an n8n developer, you'll configure webhooks in n8n to receive requests from the VectorClient API Gateway. The gateway forwards requests with base schema information that you can use to retrieve context from Weaviate.

### Webhook Configuration

#### Method
**Must be POST**

#### Content Type
**Must be application/json**

#### Webhook URL
The webhook URL is the `route` field configured in the endpoint. This must be a full URL starting with `http://` or `https://`.

**Example:**
```
https://your-n8n-instance.com/webhook/payment-processing
```

### Request Body Structure

The gateway will forward requests with the following structure:

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "endpoint_id": "660e8400-e29b-41d4-a716-446655440001",
  "schema_id": "770e8400-e29b-41d4-a716-446655440002",
  // ... additional fields from the original request
}
```

### Using Schema ID to Retrieve Context from Weaviate

The `schema_id` field in the request body corresponds to a schema stored in Weaviate. Use this ID to retrieve relevant context/knowledge for processing the request.

#### Step 1: Get Schema Information
1. The `schema_id` is the UUID of the schema associated with the endpoint
2. Each schema has a `weaviateCollectionId` that maps to a Weaviate collection

#### Step 2: Query Weaviate
Use the `schema_id` to:
1. Look up the schema's `weaviateCollectionId` from the VectorClient API
2. Query the corresponding Weaviate collection using the collection ID
3. Retrieve relevant context/knowledge based on the request data

#### Example n8n Workflow

1. **Webhook Node** (Trigger)
   - Method: POST
   - Content-Type: application/json
   - Path: `/webhook/payment-processing`

2. **HTTP Request Node** (Get Schema Info)
   ```
   GET https://api-gateway-domain.com/api/schemas/{schema_id}
   Headers:
     Authorization: Bearer <your-jwt-token>
   ```

3. **Weaviate Query Node**
   - Use the `weaviateCollectionId` from the schema
   - Query Weaviate with relevant search terms from the request body
   - Retrieve context/knowledge

4. **Process Request Node**
   - Use the retrieved context to process the request
   - Combine original request data with Weaviate context

5. **Response Node**
   - Return processed response

### Headers Forwarded

The gateway forwards the following headers (if present in the original request):
- `Authorization`: Bearer token (if provided)
- `User-Agent`: User agent string (if provided)

### File Handling

If the request includes file URLs (e.g., S3 URLs), configure your n8n workflow to:
1. Extract the file URL from the request body
2. Download the file from S3 (or other storage)
3. Process the file as needed

**Example:**
```json
{
  "user_id": "...",
  "endpoint_id": "...",
  "schema_id": "...",
  "file_url": "https://s3.amazonaws.com/bucket/document.pdf"
}
```

### Response Format

Your n8n webhook should return a JSON response. The gateway will forward this response back to the original caller.

**Example Response:**
```json
{
  "status": "success",
  "processed_data": {
    "customer_id": "12345",
    "order_amount": 99.99,
    "context_from_weaviate": "..."
  }
}
```

### Error Handling

If your webhook returns an error status code (4xx or 5xx), the gateway will:
1. Forward the error response to the caller
2. Log the error in the call logs
3. Include error details in the response

### Testing Your Webhook

1. Use the VectorClient dashboard to view call logs
2. Check the request/response bodies in the logs
3. Verify that `user_id`, `endpoint_id`, and `schema_id` are present
4. Test Weaviate queries using the `schema_id`

---

## Account Owner Guide

### Overview
As an account owner, you'll manage your account, create endpoints, generate API tokens, and configure the system through the VectorClient dashboard.

### Getting Started

#### 1. Register an Account

**Endpoint:** `POST /auth/register`

**Request:**
```json
{
  "username": "your_username",
  "password": "your_password_min_8_chars",
  "email": "your.email@example.com",
  "displayName": "Your Display Name"
}
```

**Response:**
```json
{
  "message": "User registered successfully"
}
```

#### 2. Login

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "your_username",
    "email": "your.email@example.com",
    "displayName": "Your Display Name"
  }
}
```

Save the `token` for authenticated API requests.

### Creating Endpoints

#### Endpoint Configuration

**Endpoint:** `POST /api/endpoints`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request:**
```json
{
  "routeName": "Payment Webhook",
  "route": "https://your-n8n-instance.com/webhook/payment-processing",
  "rateLimit": 100,
  "rateLimitWindowMs": 60000,
  "allowedOrigins": ["https://yourdomain.com"],
  "description": "Webhook for processing payment requests",
  "isActive": true,
  "apiTokenIds": ["token-uuid-1", "token-uuid-2"],
  "schemaIds": ["schema-uuid-1"]
}
```

**Fields:**
- `routeName` (required): Display name for the endpoint
- `route` (required): Full URL where requests will be forwarded (must start with http:// or https://)
- `rateLimit` (optional, default: 100): Maximum requests per window
- `rateLimitWindowMs` (optional, default: 60000): Time window in milliseconds
- `allowedOrigins` (optional, default: []): CORS allowed origins
- `description` (optional): Description of the endpoint
- `isActive` (optional, default: true): Whether the endpoint is active
- `apiTokenIds` (optional): Array of API token UUIDs to associate with this endpoint
- `schemaIds` (optional): Array of schema UUIDs to associate with this endpoint

**Important:** The `route` must be a **full URL** (starting with http:// or https://). This is where the gateway will forward POST requests.

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "routeName": "Payment Webhook",
  "route": "https://your-n8n-instance.com/webhook/payment-processing",
  "rateLimit": 100,
  "rateLimitWindowMs": 60000,
  "allowedOrigins": ["https://yourdomain.com"],
  "description": "Webhook for processing payment requests",
  "isActive": true,
  "createdAt": "2026-01-25T22:00:00Z",
  "updatedAt": "2026-01-25T22:00:00Z"
}
```

**Save the `id` and `userId`** - these are needed for the dynamic route URL:
```
POST /api/v1/endpoints/{id}/{userId}
```

### Generating API Tokens

#### Create API Token

**Endpoint:** `POST /api/tokens`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request:**
```json
{
  "tokenName": "Production API Key",
  "expiresIn": 90
}
```

**Fields:**
- `tokenName` (required): Name for the token (for identification)
- `expiresIn` (optional): Number of days until expiration (leave empty for no expiration)

**Response:**
```json
{
  "token": "sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "tokenId": "token-uuid-here",
  "prefix": "sk_xxxxxxxx"
}
```

**⚠️ IMPORTANT:** Copy the `token` value immediately. You won't be able to see it again! The token format is:
```
sk_<prefix>_<secret>
```

**Example Token:**
```
sk_a1b2c3d4_5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3
```

#### Associate Token with Endpoint

After creating a token, associate it with your endpoint(s):

**Option 1: During Endpoint Creation**
Include the `tokenId` in the `apiTokenIds` array when creating the endpoint.

**Option 2: After Endpoint Creation**
**Endpoint:** `POST /api/endpoints/:endpointId/tokens`

**Request:**
```json
{
  "tokenIds": ["token-uuid-1", "token-uuid-2"]
}
```

### Revoking API Tokens

**Endpoint:** `DELETE /api/tokens/:tokenId`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "message": "Token revoked"
}
```

Once revoked, the token can no longer be used to access endpoints.

### Viewing Token Usage

**Endpoint:** `GET /api/tokens/:tokenId/logs`

View the usage history for a specific token, including:
- Request timestamps
- Endpoints called
- Response status codes
- Response times
- IP addresses

### Creating Schemas (Knowledge Base)

Schemas are used to store context/knowledge in Weaviate that can be retrieved by n8n workflows.

**Endpoint:** `POST /api/schemas`

**Request:**
```json
{
  "name": "Payment Processing Knowledge",
  "description": "Knowledge base for payment processing workflows",
  "content": "# Payment Processing\n\nThis schema contains information about...",
  "isPublished": true
}
```

**Fields:**
- `name` (required): Name of the schema
- `description` (optional): Description
- `content` (required): Markdown content for the knowledge base
- `isPublished` (optional, default: false): Whether the schema is published

**Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Payment Processing Knowledge",
  "description": "Knowledge base for payment processing workflows",
  "content": "# Payment Processing\n\n...",
  "version": 1,
  "isPublished": true,
  "weaviateCollectionId": "PaymentProcessing_12345",
  "createdAt": "2026-01-25T22:00:00Z",
  "updatedAt": "2026-01-25T22:00:00Z"
}
```

**Save the `id`** - use this when associating schemas with endpoints.

### Associating Schemas with Endpoints

**Option 1: During Endpoint Creation**
Include the `schemaId` in the `schemaIds` array when creating the endpoint.

**Option 2: After Endpoint Creation**
**Endpoint:** `POST /api/endpoints/:endpointId/schemas`

**Request:**
```json
{
  "schemaIds": ["schema-uuid-1", "schema-uuid-2"]
}
```

**Note:** The first schema (by order) will be used as the `schema_id` in forwarded requests.

### Viewing Call Logs

**Endpoint:** `GET /api/endpoints/:endpointId/logs`

View call history for a specific endpoint, including:
- Request/response bodies
- Status codes
- Response times
- Error messages
- API tokens used

**Query Parameters:**
- `page` (default: 1): Page number
- `limit` (default: 50, max: 500): Results per page
- `status`: Filter by status code
- `method`: Filter by HTTP method
- `startDate`: Filter from date (ISO string)
- `endDate`: Filter to date (ISO string)
- `sortBy`: Sort by `createdAt`, `responseTime`, or `status`
- `sortOrder`: `asc` or `desc` (default: `desc`)

### Complete Setup Workflow

1. **Register and Login**
   - Register your account
   - Login and save your JWT token

2. **Create Schemas** (if needed)
   - Create knowledge base schemas
   - Save schema IDs

3. **Generate API Tokens**
   - Create API tokens for your applications
   - Save token values securely
   - Save token IDs

4. **Create Endpoints**
   - Set route to your n8n webhook URL (full URL required)
   - Associate API tokens
   - Associate schemas
   - Save endpoint ID and user ID

5. **Share Information with Developers**
   - Provide web developers with:
     - Endpoint ID
     - User ID
     - API token
     - Base URL: `https://your-api-gateway-domain.com/api/v1/endpoints`
   - Provide n8n developers with:
     - Webhook URL (the `route` field)
     - Information about schema IDs and Weaviate collections

6. **Monitor Usage**
   - View call logs in the dashboard
   - Check token usage
   - Monitor request statistics

### Dashboard Overview

The dashboard shows:
- **Total Endpoints**: Number of endpoints you've created
- **Active Tokens**: Number of active, non-expired API tokens
- **Requests (24h)**: Total requests across all endpoints in the last 24 hours

### Best Practices

1. **Token Security**
   - Never share tokens in code repositories
   - Use environment variables
   - Rotate tokens regularly
   - Revoke unused tokens

2. **Endpoint Configuration**
   - Always use full URLs for routes (https://)
   - Set appropriate rate limits
   - Configure CORS origins properly
   - Test endpoints before going live

3. **Schema Management**
   - Keep schema content up to date
   - Use descriptive names
   - Publish schemas when ready for use

4. **Monitoring**
   - Regularly check call logs
   - Monitor error rates
   - Review token usage
   - Set up alerts for unusual activity

---

## Support

For issues or questions:
1. Check the call logs for error details
2. Verify API tokens are active and associated with endpoints
3. Ensure endpoint routes are full URLs
4. Contact support with endpoint IDs and error messages

---

## API Base URLs

- **Development:** `http://localhost:3001`
- **Production:** `https://your-api-gateway-domain.com`

All endpoints are prefixed with the base URL above.
