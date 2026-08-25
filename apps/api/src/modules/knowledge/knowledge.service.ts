import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { KnowledgeChunk, KnowledgeChunkDocument } from './schemas/knowledge-chunk.schema';

interface SearchResult {
  content: string;
  courseId: string;
  score: number;
  metadata?: {
    pageNumber?: number;
    section?: string;
    tokenCount?: number;
  };
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly embeddingModel = 'text-embedding-3-small';
  private openai?: OpenAI;

  constructor(
    @InjectModel(KnowledgeChunk.name) private knowledgeChunkModel: Model<KnowledgeChunkDocument>,
    private readonly configService: ConfigService
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI no está configurado para crear embeddings');
    }

    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new Error('No se puede crear un embedding de un texto vacío');
    }

    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: normalizedText,
    });

    return response.data[0].embedding;
  }

  async indexCourseContent(
    courseId: string,
    content: string,
    sourceFile: string
  ): Promise<{ chunksCreated: number }> {
    const chunks = this.splitIntoChunks(content).filter((chunk) => chunk.length > 0);

    if (chunks.length === 0) {
      return { chunksCreated: 0 };
    }

    // Reemplazamos la indexacion previa del mismo archivo para mantener un
    // conjunto de chunks coherente cuando se reindexa un curso.
    await this.knowledgeChunkModel.deleteMany({
      courseId: new Types.ObjectId(courseId),
      sourceFile,
    });

    const docs = await Promise.all(
      chunks.map(async (chunk, index) => ({
        courseId: new Types.ObjectId(courseId),
        content: chunk,
        embedding: await this.createEmbedding(chunk),
        sourceFile,
        chunkIndex: index,
        metadata: {
          tokenCount: chunk.split(/\s+/).length,
        },
      }))
    );

    await this.knowledgeChunkModel.create(docs);
    this.logger.log(`Indexados ${docs.length} chunks para el curso ${courseId}`);

    return { chunksCreated: docs.length };
  }

  async searchSimilar(
    query: string,
    options?: {
      courseId?: string;
      limit?: number;
      minScore?: number;
    }
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.createEmbedding(query);
    const limit = options?.limit ?? 5;
    const minScore = options?.minScore ?? 0;

    const filters = options?.courseId
      ? { courseId: new Types.ObjectId(options.courseId) }
      : {};

    const chunks = await this.knowledgeChunkModel.find(filters).lean();

    return chunks
      .map((chunk) => ({
        content: chunk.content,
        courseId: chunk.courseId.toString(),
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
        metadata: chunk.metadata,
      }))
      .filter((chunk) => chunk.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  splitIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async getStats(): Promise<{
    totalChunks: number;
    coursesCovered: number;
  }> {
    const totalChunks = await this.knowledgeChunkModel.countDocuments();
    const coursesCovered = await this.knowledgeChunkModel.distinct('courseId');

    return {
      totalChunks,
      coursesCovered: coursesCovered.length,
    };
  }

  async deleteCourseChunks(courseId: string): Promise<{ deletedCount: number }> {
    const result = await this.knowledgeChunkModel.deleteMany({
      courseId: new Types.ObjectId(courseId),
    });
    return { deletedCount: result.deletedCount };
  }
}
