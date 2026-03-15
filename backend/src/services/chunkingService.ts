import OpenAI from 'openai';
import { config } from 'dotenv';

config();

const CATEGORY_MAX_LENGTH = 50;

function truncateOptional(value: string | undefined | null, maxLen: number): string | undefined {
  if (value == null || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen);
}

export interface Chunk {
  content: string;
  originalReference: string;
  chunkIndex: number;
  category?: string;
  subcategory?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHUNKING_PROMPT = `You are a factual chunking assistant. Given a document, break it into small, self-contained factual chunks suitable for vector search.

Rules:
1. Each chunk should contain ONE discrete fact, definition, or instruction.
2. Each chunk must be self-contained (understandable without context).
3. For each chunk, return the EXACT sentence or span from the original document that the chunk was derived from. Do not paraphrase the original reference — copy it verbatim.
4. PRESERVE concrete detail verbatim: URLs, email addresses, phone numbers, and similar identifiers MUST appear exactly as in the source in both "content" and "originalReference". Do not summarize or drop them.
5. If a sentence contains multiple facts, split them into separate chunks.
6. Preserve technical terms, names, and values exactly.
7. For each chunk, provide "category" and "subcategory" (short semantic labels, each at most 50 characters) to describe the type of information (e.g. "Contact", "Pricing", "Support").

Respond with a JSON object containing a "chunks" key, which is an array of chunk objects.
Each chunk object must have:
- "content": the factual chunk text (concise, self-contained; preserve URLs, emails, phones verbatim)
- "originalReference": the exact sentence or span from the source document (verbatim, including URLs/emails/phones)
- "category": short label (max 50 chars), e.g. "Contact", "API", "Pricing"
- "subcategory": short label (max 50 chars), e.g. "Email", "Rate limits"

Example response:
{
  "chunks": [
    {
      "content": "Support email is support@example.com for API questions.",
      "originalReference": "For API questions contact support@example.com.",
      "category": "Contact",
      "subcategory": "Email"
    },
    {
      "content": "The API rate limit is 100 requests per minute per user.",
      "originalReference": "Rate limiting is set to 100 requests per minute for each authenticated user.",
      "category": "API",
      "subcategory": "Rate limits"
    }
  ]
}

Return ONLY the JSON object.`;

export class ChunkingService {
  /**
   * Break schema content into small factual chunks using OpenAI.
   * Returns an array of Chunk objects with content, originalReference, and chunkIndex.
   */
  static async chunkContent(content: string): Promise<Chunk[]> {
    if (!content || content.trim().length === 0) {
      return [];
    }

    // Very short content: return as a single chunk
    const trimmed = content.trim();
    if (trimmed.length < 50) {
      return [
        {
          content: trimmed,
          originalReference: trimmed,
          chunkIndex: 0,
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CHUNKING_PROMPT },
        { role: 'user', content: trimmed },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('OpenAI returned empty response during chunking');
    }

    const parsed = JSON.parse(raw);

    // Handle both { chunks: [...] } and direct array formats
    const rawChunks: Array<{
      content: string;
      originalReference?: string;
      category?: string;
      subcategory?: string;
    }> = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.chunks)
        ? parsed.chunks
        : [];

    if (rawChunks.length === 0) {
      // Fallback: treat entire content as single chunk
      return [
        {
          content: trimmed,
          originalReference: trimmed,
          chunkIndex: 0,
        },
      ];
    }

    return rawChunks.map((chunk, index) => {
      const category = truncateOptional(chunk.category, CATEGORY_MAX_LENGTH);
      const subcategory = truncateOptional(chunk.subcategory, CATEGORY_MAX_LENGTH);
      return {
        content: chunk.content,
        originalReference: chunk.originalReference || chunk.content,
        chunkIndex: index,
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
      };
    });
  }
}
