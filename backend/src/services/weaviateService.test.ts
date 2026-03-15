import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Chunk } from './chunkingService';

vi.mock('./chunkingService', () => ({
  ChunkingService: {
    chunkContent: vi.fn(),
  },
  Chunk: {},
}));

const mockDataCreator = vi.fn();
const mockClassGetter = vi.fn();

vi.mock('weaviate-ts-client', () => ({
  ApiKey: class {},
  default: {
    client: () => ({
      schema: {
        classCreator: () => ({ withClass: () => ({ do: () => Promise.resolve() }) }),
        classGetter: () => ({ withClassName: () => ({ do: mockClassGetter }) }),
        classDeleter: () => ({ withClassName: () => ({ do: () => Promise.resolve() }) }),
      },
      data: {
        creator: () => ({
          withClassName: () => ({
            withProperties: (props: Record<string, unknown>) => ({
              do: () => {
                mockDataCreator(props);
                return Promise.resolve();
              },
            }),
          }),
        }),
      },
      graphql: {
        get: () => ({
          withClassName: () => ({
            withFields: () => ({
              withLimit: () => ({ do: () => Promise.resolve({ data: { Get: {} } }) }),
            }),
          }),
        }),
      },
    }),
  },
}));

async function getWeaviateService() {
  const { WeaviateService } = await import('./weaviateService');
  return WeaviateService;
}

describe('WeaviateService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { ChunkingService } = await import('./chunkingService');
    (ChunkingService.chunkContent as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockClassGetter.mockRejectedValue(new Error('not found'));
  });

  it('writes category and subcategory when chunks have them', async () => {
    const chunks: Chunk[] = [
      {
        content: 'Support email is support@example.com.',
        originalReference: 'Contact support@example.com',
        chunkIndex: 0,
        category: 'Contact',
        subcategory: 'Email',
      },
    ];
    const { ChunkingService } = await import('./chunkingService');
    (ChunkingService.chunkContent as ReturnType<typeof vi.fn>).mockResolvedValue(chunks);

    const WeaviateService = await getWeaviateService();
    await WeaviateService.syncSchemaToWeaviate('schema-1', 'MySchema', 'dummy content');

    expect(mockDataCreator).toHaveBeenCalled();
    const props = mockDataCreator.mock.calls[0][0];
    expect(props.category).toBe('Contact');
    expect(props.subcategory).toBe('Email');
  });

  it('truncates category and subcategory to 50 characters when writing', async () => {
    const longCategory = 'x'.repeat(60);
    const longSubcategory = 'y'.repeat(55);
    const chunks: Chunk[] = [
      {
        content: 'Some content',
        originalReference: 'Some ref',
        chunkIndex: 0,
        category: longCategory,
        subcategory: longSubcategory,
      },
    ];
    const { ChunkingService } = await import('./chunkingService');
    (ChunkingService.chunkContent as ReturnType<typeof vi.fn>).mockResolvedValue(chunks);

    const WeaviateService = await getWeaviateService();
    await WeaviateService.syncSchemaToWeaviate('schema-2', 'Schema2', 'dummy content');

    const props = mockDataCreator.mock.calls[0][0];
    expect(props.category).toHaveLength(50);
    expect(props.category).toBe(longCategory.slice(0, 50));
    expect(props.subcategory).toHaveLength(50);
    expect(props.subcategory).toBe(longSubcategory.slice(0, 50));
  });

  it('omits category and subcategory when chunk has none', async () => {
    const chunks: Chunk[] = [
      { content: 'Content', originalReference: 'Ref', chunkIndex: 0 },
    ];
    const { ChunkingService } = await import('./chunkingService');
    (ChunkingService.chunkContent as ReturnType<typeof vi.fn>).mockResolvedValue(chunks);

    const WeaviateService = await getWeaviateService();
    await WeaviateService.syncSchemaToWeaviate('schema-3', 'Schema3', 'dummy content');

    const props = mockDataCreator.mock.calls[0][0];
    expect(props).not.toHaveProperty('category');
    expect(props).not.toHaveProperty('subcategory');
  });
});
