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

/**
 * Prompt tuned for RAG / chatbot retrieval: chunks should match how users ask questions
 * (programs, schedules, pricing, enrollment, audience, contact) — not maximally atomized facts.
 */
const CHUNKING_PROMPT = `You are a chunking assistant for a customer-facing chatbot. The knowledge base will be retrieved by semantic search. Your job is to split the document into chunks that match likely user questions and support a natural flow: understanding the organization → who it is for → specific program details → how to enroll → how to get human help.

## What makes a good chunk here
1. **Conversational retrieval units** — Prefer one chunk per *kind of question* a user might ask, not one chunk per tiny fact. Group related lines that belong together in a single answer (e.g. schedule block: duration, frequency, dates, day, time together; pricing block: fees, discounts, currency together).
2. **Self-contained** — Every chunk must make sense if retrieved alone. If a fact is about a specific program, **repeat the program name and/or Program ID** in the chunk text when helpful so the answer is not orphaned.
3. **Programs and offerings** — When the document lists programs (names, IDs, URLs, levels, ages):
   - Keep **identity + discovery** together when reasonable: program name, ID, category, level, target age/audience, and **program page URL** in one chunk if they appear contiguously in the source.
   - **Schedule**, **location/venue**, **pricing**, **enrollment policy**, and **program description / highlights** may be separate chunks *per program* when the source structure supports it — each still naming the program.
4. **Enrollment and next steps** — Put registration/enrollment instructions (e.g. Sign Up, form, follow-up contact, payment) in dedicated chunks users can find when they ask "how do I sign up" or "how to register".
5. **Contact and escalation** — Contact page URL, email, phone, WhatsApp, etc. should appear in focused chunk(s) so "talk to a human" queries hit complete actionable info. Preserve every character of URLs and phone numbers.
6. **Organization / philosophy / audience** — Overview sections ("what is X", "who is it for", learning philosophy) can be chunked by subsection or heading so broad questions retrieve coherent paragraphs.
7. **Use headings and structure** — Respect numbered sections, "PROGRAM N", markdown headings, and FAQ Q/A pairs as natural boundaries when they exist.

## Hard rules (must follow)
- **originalReference**: the EXACT contiguous span copied verbatim from the source (no paraphrase). It may span multiple lines/sentences if the chunk bundles them.
- **content**: Clear, self-contained text for the chatbot to use (may lightly add the program name for clarity if the source span is ambiguous — but never invent facts, dates, prices, or URLs).
- **Verbatim identifiers**: URLs, emails, phone numbers, Program IDs, prices, dates, addresses must match the source exactly anywhere they appear in "content" or "originalReference".
- **category** / **subcategory**: Short labels (max 50 chars each) that help filter and browse the index. Use consistent vocabulary when possible, e.g. category "Program", "Enrollment", "Contact", "Organization", "FAQ"; subcategory = specific program name truncated, or "Schedule", "Pricing", "Location", "Philosophy", "Audience", etc.

## Avoid
- Splitting every bullet into its own chunk when bullets answer one user question together.
- Chunks so small that a user asking "when is Robotics Youth Squad?" gets only "Saturday" without program name and dates.
- Dropping or shortening URLs, emails, or phone numbers.

Respond with a JSON object containing a "chunks" key: an array of chunk objects.
Each chunk object must have:
- "content": retrieval-ready text (self-contained; verbatim identifiers)
- "originalReference": exact source span (verbatim)
- "category": short label (max 50 chars)
- "subcategory": short label (max 50 chars)

Example (shape only):
{
  "chunks": [
    {
      "content": "Robotics Youth Squad (SA-009) is a beginner robotics program for ages 8–14. Program page: https://example.com/programs/sa-009",
      "originalReference": "Program Name: Robotics Youth Squad. Program ID: SA-009. Program Website URL: https://example.com/programs/sa-009",
      "category": "Program",
      "subcategory": "Robotics Youth Squad"
    },
    {
      "content": "To register, use Sign Up on the program page; a team member will contact you for payment and enrollment confirmation.",
      "originalReference": "You can register by clicking the Sign Up button on the program page. After submitting the form, a team member will contact you.",
      "category": "Enrollment",
      "subcategory": "Registration"
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
