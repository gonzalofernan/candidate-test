import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeChunk } from './schemas/knowledge-chunk.schema';

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  const mockKnowledgeChunkModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        {
          provide: getModelToken(KnowledgeChunk.name),
          useValue: mockKnowledgeChunkModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(service.cosineSimilarity(vec, vec)).toBeCloseTo(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(service.cosineSimilarity(vecA, vecB)).toBeCloseTo(0);
    });

    it('should throw error for vectors of different length', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      expect(() => service.cosineSimilarity(vecA, vecB)).toThrow();
    });
  });

  describe('splitIntoChunks', () => {
    it('should split text into chunks', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = service.splitIntoChunks(text, 30);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should not split short text', () => {
      const text = 'Short text.';
      const chunks = service.splitIntoChunks(text, 1000);
      expect(chunks.length).toBe(1);
    });
  });

  it('should index course content into chunks', async () => {
    jest.spyOn(service, 'createEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);

    const result = await service.indexCourseContent(
      '507f1f77bcf86cd799439011',
      'Primera frase. Segunda frase. Tercera frase.',
      'test.pdf'
    );

    expect(mockKnowledgeChunkModel.deleteMany).toHaveBeenCalled();
    expect(mockKnowledgeChunkModel.create).toHaveBeenCalled();
    expect(result.chunksCreated).toBeGreaterThan(0);
  });

  it('should search for similar content and sort by similarity', async () => {
    jest.spyOn(service, 'createEmbedding').mockResolvedValue([1, 0]);
    mockKnowledgeChunkModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          content: 'match',
          courseId: { toString: () => 'course-1' },
          embedding: [1, 0],
          metadata: {},
        },
        {
          content: 'worse',
          courseId: { toString: () => 'course-2' },
          embedding: [0, 1],
          metadata: {},
        },
      ]),
    });

    const result = await service.searchSimilar('query', { limit: 2 });

    expect(result[0].content).toBe('match');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('should filter search results by courseId', async () => {
    jest.spyOn(service, 'createEmbedding').mockResolvedValue([1, 0]);
    const lean = jest.fn().mockResolvedValue([]);
    mockKnowledgeChunkModel.find.mockReturnValue({ lean });

    await service.searchSimilar('query', {
      courseId: '507f1f77bcf86cd799439011',
      limit: 1,
    });

    expect(mockKnowledgeChunkModel.find).toHaveBeenCalledWith({
      courseId: expect.anything(),
    });
  });
});
