import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { db } from '../config/database';
import { endpoints, callLogs, endpointApiTokens, apiTokens, endpointSchemas } from '../database/schema';
import { eq, and, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from '../utils/encryption';

export async function dynamicRoutes(app: FastifyInstance) {
    // Dynamic routes might not require JWT auth if they are public APIs protected by API Tokens
    // We should apply rate limiting here
    // app.addHook('onRequest', rateLimitMiddleware); // Commented out until fully implemented as rateLimitMiddleware needs fixing/testing
    
    // POST /api/v1/endpoints/:endpoint_id/:user_id
    app.post('/:endpoint_id/:user_id', async (request: FastifyRequest, reply: FastifyReply) => {
        const startTime = Date.now();
        let endpointId: string | undefined;
        let userId: string | undefined;
        let statusCode = 500;
        let errorMessage: string | null = null;

        try {
            const params = request.params as { endpoint_id: string; user_id: string };
            endpointId = params.endpoint_id;
            userId = params.user_id;

            // Look up the endpoint by endpoint_id and user_id
            const [endpoint] = await db
                .select()
                .from(endpoints)
                .where(
                    and(
                        eq(endpoints.id, endpointId),
                        eq(endpoints.userId, userId),
                        eq(endpoints.isActive, true)
                    )
                )
                .limit(1);

            if (!endpoint) {
                statusCode = 404;
                errorMessage = 'Endpoint not found or inactive';
                const responseTime = Date.now() - startTime;
                
                // Send response first
                reply.code(404).send({ message: 'Endpoint not found or inactive' });
                
                // Try to log the failed request (endpoint not found, so we can't log with endpointId)
                // We skip logging in this case since we don't have a valid endpoint
                return;
            }

            // Validate API token from x-api-key header
            const apiKey = request.headers['x-api-key'] as string | undefined;
            let apiTokenId: string | null = null;
            console.log(apiKey);

            if (apiKey) {
                const apiTokenParts = apiKey.split('_');
                const hashedToken = EncryptionService.hash(apiKey);
                // Validate the token
                const [token] = await db
                    .select()
                    .from(apiTokens)
                    .where(
                        and(
                            eq(apiTokens.tokenValue, hashedToken),
                            eq(apiTokens.isActive, true)
                        )
                    )
                    .limit(1);

                console.log(token);

                if (!token) {
                    statusCode = 403;
                    errorMessage = 'Invalid API token';
                    const responseTime = Date.now() - startTime;
                    reply.code(403).send({ message: 'Invalid API token' });
                    
                    // Log the 403 error
                    try {
                        const requestBody = request.body ? JSON.stringify(request.body) : null;
                        const requestBodyText = requestBody && requestBody.length > 10240 
                            ? requestBody.substring(0, 10240) 
                            : requestBody;
                        const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || null;
                        const userAgent = request.headers['user-agent'] || null;
                        const method = request.method;
                        const path = request.url.split('?')[0];

                        await db.insert(callLogs).values({
                            id: uuidv4(),
                            endpointId: endpoint.id,
                            apiTokenId: null,
                            method,
                            path,
                            status: statusCode,
                            requestBody: requestBodyText,
                            responseBody: null,
                            responseTime,
                            ipAddress,
                            userAgent,
                            errorMessage: errorMessage,
                        });
                    } catch (logError) {
                        console.error('Failed to log 403 error to call_logs:', logError);
                    }
                    return;
                }

                // Check expiration
                if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
                    statusCode = 403;
                    errorMessage = 'API token has expired';
                    const responseTime = Date.now() - startTime;
                    reply.code(403).send({ message: 'API token has expired' });
                    
                    // Log the 403 error
                    try {
                        const requestBody = request.body ? JSON.stringify(request.body) : null;
                        const requestBodyText = requestBody && requestBody.length > 10240 
                            ? requestBody.substring(0, 10240) 
                            : requestBody;
                        const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || null;
                        const userAgent = request.headers['user-agent'] || null;
                        const method = request.method;
                        const path = request.url.split('?')[0];

                        await db.insert(callLogs).values({
                            id: uuidv4(),
                            endpointId: endpoint.id,
                            apiTokenId: token.id,
                            method,
                            path,
                            status: statusCode,
                            requestBody: requestBodyText,
                            responseBody: null,
                            responseTime,
                            ipAddress,
                            userAgent,
                            errorMessage: errorMessage,
                        });
                    } catch (logError) {
                        console.error('Failed to log 403 error to call_logs:', logError);
                    }
                    return;
                }

                // Check if token is associated with this endpoint
                const [association] = await db
                    .select()
                    .from(endpointApiTokens)
                    .where(
                        and(
                            eq(endpointApiTokens.endpointId, endpointId),
                            eq(endpointApiTokens.apiTokenId, token.id)
                        )
                    )
                    .limit(1);

                if (!association) {
                    statusCode = 403;
                    errorMessage = 'API token is not authorized for this endpoint';
                    const responseTime = Date.now() - startTime;
                    reply.code(403).send({ message: 'API token is not authorized for this endpoint' });
                    
                    // Log the 403 error
                    try {
                        const requestBody = request.body ? JSON.stringify(request.body) : null;
                        const requestBodyText = requestBody && requestBody.length > 10240 
                            ? requestBody.substring(0, 10240) 
                            : requestBody;
                        const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || null;
                        const userAgent = request.headers['user-agent'] || null;
                        const method = request.method;
                        const path = request.url.split('?')[0];

                        await db.insert(callLogs).values({
                            id: uuidv4(),
                            endpointId: endpoint.id,
                            apiTokenId: token.id,
                            method,
                            path,
                            status: statusCode,
                            requestBody: requestBodyText,
                            responseBody: null,
                            responseTime,
                            ipAddress,
                            userAgent,
                            errorMessage: errorMessage,
                        });
                    } catch (logError) {
                        console.error('Failed to log 403 error to call_logs:', logError);
                    }
                    return;
                }

                apiTokenId = token.id;

                // Update last used timestamp
                await db
                    .update(apiTokens)
                    .set({ lastUsedAt: new Date() })
                    .where(eq(apiTokens.id, token.id));
            } else {
                // Check if endpoint requires a token (has any associated tokens)
                const associatedTokens = await db
                    .select()
                    .from(endpointApiTokens)
                    .where(eq(endpointApiTokens.endpointId, endpointId))
                    .limit(1);

                if (associatedTokens.length > 0) {
                    statusCode = 403;
                    errorMessage = 'API token required';
                    const responseTime = Date.now() - startTime;
                    reply.code(403).send({ message: 'API token required' });
                    
                    // Log the 403 error
                    try {
                        const requestBody = request.body ? JSON.stringify(request.body) : null;
                        const requestBodyText = requestBody && requestBody.length > 10240 
                            ? requestBody.substring(0, 10240) 
                            : requestBody;
                        const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || null;
                        const userAgent = request.headers['user-agent'] || null;
                        const method = request.method;
                        const path = request.url.split('?')[0];

                        await db.insert(callLogs).values({
                            id: uuidv4(),
                            endpointId: endpoint.id,
                            apiTokenId: null,
                            method,
                            path,
                            status: statusCode,
                            requestBody: requestBodyText,
                            responseBody: null,
                            responseTime,
                            ipAddress,
                            userAgent,
                            errorMessage: errorMessage,
                        });
                    } catch (logError) {
                        console.error('Failed to log 403 error to call_logs:', logError);
                    }
                    return;
                }
            }

            // Get the first associated schema for this endpoint (ordered by order field)
            const associatedSchemas = await db
                .select({ schemaId: endpointSchemas.schemaId })
                .from(endpointSchemas)
                .where(eq(endpointSchemas.endpointId, endpointId))
                .orderBy(asc(endpointSchemas.order))
                .limit(1);

            const schemaId = associatedSchemas.length > 0 ? associatedSchemas[0].schemaId : null;

            // Get request body and parse it
            const originalRequestBody = request.body as any;
            let requestBodyObj: any = {};

            // If original body is an object, use it; otherwise try to parse it
            if (originalRequestBody && typeof originalRequestBody === 'object') {
                requestBodyObj = { ...originalRequestBody };
            } else if (originalRequestBody) {
                try {
                    requestBodyObj = typeof originalRequestBody === 'string' 
                        ? JSON.parse(originalRequestBody) 
                        : originalRequestBody;
                } catch {
                    requestBodyObj = {};
                }
            }

            // Build the forwarding body with base schema fields
            const forwardingBody = {
                user_id: userId,
                endpoint_id: endpointId,
                ...(schemaId && { schema_id: schemaId }),
                // Merge any additional fields from the original request body
                ...Object.keys(requestBodyObj).reduce((acc, key) => {
                    // Skip base schema fields if they were in the original body
                    if (key !== 'user_id' && key !== 'endpoint_id' && key !== 'schema_id') {
                        acc[key] = requestBodyObj[key];
                    }
                    return acc;
                }, {} as any),
            };

            const forwardingRequestBody = JSON.stringify(forwardingBody);
            
            // For logging, use the original request body (before transformation)
            const originalRequestBodyForLog = originalRequestBody 
                ? (typeof originalRequestBody === 'string' ? originalRequestBody : JSON.stringify(originalRequestBody))
                : null;
            const requestBodyText = originalRequestBodyForLog && originalRequestBodyForLog.length > 10240 
                ? originalRequestBodyForLog.substring(0, 10240) 
                : originalRequestBodyForLog;

            // Get request metadata
            const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || null;
            const userAgent = request.headers['user-agent'] || null;
            const method = request.method;
            const path = request.url.split('?')[0];

            // Forward the POST request to the route specified in the endpoints table
            // The route field might be a relative path or absolute URL
            let targetUrl = endpoint.route;
            
            // If route doesn't start with http:// or https://, treat it as a relative path
            // For now, we'll assume it's an absolute URL or needs to be constructed
            // If it's relative, we might need a base URL from config
            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                // If it's a relative path, we might want to prepend a base URL
                // For now, we'll return an error or handle it based on your requirements
                // You might want to add a baseUrl to your endpoint config or env
                statusCode = 400;
                errorMessage = 'Route must be a full URL (starting with http:// or https://)';
                reply.code(400).send({ message: errorMessage });
                return;
            }

            // Make the POST request to the target route
            const forwardResponse = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(request.headers['authorization'] && { 'Authorization': request.headers['authorization'] as string }),
                    ...(request.headers['user-agent'] && { 'User-Agent': request.headers['user-agent'] as string }),
                },
                body: forwardingRequestBody,
            });

            statusCode = forwardResponse.status;
            const responseText = await forwardResponse.text();
            
            // Try to parse as JSON, if it fails, use the text
            let parsedResponse: any;
            try {
                parsedResponse = JSON.parse(responseText);
            } catch {
                parsedResponse = responseText;
            }

            // Limit response body to 10KB for logging
            const responseBodyText = responseText.length > 10240 
                ? responseText.substring(0, 10240) 
                : responseText;

            const responseTime = Date.now() - startTime;

            // Return the response first
            reply.code(statusCode).send(parsedResponse);

            // Log the call to call_logs (don't await to avoid blocking response)
            // Wrap in try-catch so logging errors don't affect the response
            try {
                await db.insert(callLogs).values({
                    id: uuidv4(),
                    endpointId: endpoint.id,
                    apiTokenId: apiTokenId,
                    method,
                    path,
                    status: statusCode,
                    requestBody: requestBodyText,
                    responseBody: responseBodyText,
                    responseTime,
                    ipAddress,
                    userAgent,
                    errorMessage: null,
                });
            } catch (logError) {
                console.error('Failed to log call to call_logs:', logError);
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            statusCode = 500;
            errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Send response first
            reply.code(500).send({ message: errorMessage || 'Internal server error' });
            
            // Log the error to call_logs if we have endpoint info (don't block response)
            if (endpointId && userId) {
                try {
                    const [endpoint] = await db
                        .select()
                        .from(endpoints)
                        .where(
                            and(
                                eq(endpoints.id, endpointId),
                                eq(endpoints.userId, userId)
                            )
                        )
                        .limit(1);

                    if (endpoint) {
                        // Try to get token ID if API key was provided
                        let errorApiTokenId: string | null = null;
                        const apiKey = request.headers['x-api-key'] as string | undefined;
                        if (apiKey) {
                            try {
                                const hashedToken = EncryptionService.hash(apiKey);
                                const [token] = await db
                                    .select()
                                    .from(apiTokens)
                                    .where(eq(apiTokens.tokenValue, hashedToken))
                                    .limit(1);
                                if (token) {
                                    errorApiTokenId = token.id;
                                }
                            } catch {
                                // Ignore token lookup errors in error logging
                            }
                        }

                        const requestBody = request.body ? JSON.stringify(request.body) : null;
                        const requestBodyText = requestBody && requestBody.length > 10240 
                            ? requestBody.substring(0, 10240) 
                            : requestBody;
                        const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || null;
                        const userAgent = request.headers['user-agent'] || null;
                        const method = request.method;
                        const path = request.url.split('?')[0];

                        await db.insert(callLogs).values({
                            id: uuidv4(),
                            endpointId: endpoint.id,
                            apiTokenId: errorApiTokenId,
                            method,
                            path,
                            status: statusCode,
                            requestBody: requestBodyText,
                            responseBody: null,
                            responseTime,
                            ipAddress,
                            userAgent,
                            errorMessage: errorMessage,
                        });
                    }
                } catch (logError) {
                    console.error('Failed to log error to call_logs:', logError);
                }
            }
        }
    });
}
