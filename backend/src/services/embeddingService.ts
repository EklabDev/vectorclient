import OpenAI from 'openai';

const DEFAULT_MODEL = 'text-embedding-3-small';
const BATCH = 64;

function client(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = client();
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await openai.embeddings.create({ model, input: slice });
    for (const item of res.data) {
      out[i + item.index] = item.embedding;
    }
  }
  return out;
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
