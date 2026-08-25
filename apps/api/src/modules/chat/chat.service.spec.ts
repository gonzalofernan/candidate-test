import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ChatMessage } from './schemas/chat-message.schema';
import { Conversation } from './schemas/conversation.schema';

describe('ChatService', () => {
  let service: ChatService;

  const mockChatMessageModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockConversationModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockAiService = {
    generateResponseWithRAG: jest.fn(),
  };

  const mockKnowledgeService = {
    searchSimilar: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(ChatMessage.name),
          useValue: mockChatMessageModel,
        },
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: KnowledgeService,
          useValue: mockKnowledgeService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should create user message and get AI response with RAG metadata', async () => {
      const conversationId = '507f1f77bcf86cd799439012';
      mockConversationModel.findById.mockResolvedValue({
        _id: { toString: () => conversationId },
        courseId: { toString: () => '507f1f77bcf86cd799439099' },
        title: 'Nueva conversación',
        messageCount: 0,
      });
      mockChatMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      mockChatMessageModel.create
        .mockResolvedValueOnce({
          _id: 'user-1',
          conversationId,
          role: 'user',
          content: 'Hola',
        })
        .mockResolvedValueOnce({
          _id: 'assistant-1',
          conversationId,
          role: 'assistant',
          content: 'Respuesta',
          metadata: {},
        });
      mockKnowledgeService.searchSimilar.mockResolvedValue([{ content: 'chunk 1' }]);
      mockAiService.generateResponseWithRAG.mockResolvedValue({
        content: 'Respuesta',
        tokensUsed: 123,
        model: 'gpt-5-mini',
      });

      const result = await service.sendMessage({
        studentId: '507f1f77bcf86cd799439011',
        message: 'Hola',
        conversationId,
      });

      expect(mockKnowledgeService.searchSimilar).toHaveBeenCalledWith('Hola', {
        courseId: '507f1f77bcf86cd799439099',
        limit: 4,
        minScore: 0.2,
      });
      expect(mockAiService.generateResponseWithRAG).toHaveBeenCalled();
      expect(result.relevantChunksCount).toBe(1);
    });
  });

  describe('startNewConversation', () => {
    it('should create a new conversation and keep histories isolated', async () => {
      const previousId = '507f1f77bcf86cd799439031';
      const nextId = '507f1f77bcf86cd799439032';

      (service as any).conversationCache.set(previousId, [
        { role: 'user', content: 'anterior' },
      ]);

      mockConversationModel.create.mockResolvedValue({
        _id: { toString: () => nextId },
      });
      mockConversationModel.updateMany.mockResolvedValue({});

      await service.startNewConversation(
        '507f1f77bcf86cd799439011',
        'Contexto inicial',
        undefined
      );

      const previousHistory = (service as any).conversationCache.get(previousId);
      const newHistory = (service as any).conversationCache.get(nextId);

      expect(previousHistory).toEqual([{ role: 'user', content: 'anterior' }]);
      expect(newHistory).toEqual([
        { role: 'system', content: 'Contexto inicial' },
      ]);
    });
  });

  describe('getHistory', () => {
    it('should return paginated chat history for a conversation', async () => {
      const conversationId = '507f1f77bcf86cd799439012';
      const sort = jest.fn().mockReturnThis();
      const skip = jest.fn().mockReturnThis();
      const limit = jest.fn().mockReturnThis();
      const lean = jest.fn().mockResolvedValue([
        {
          _id: { toString: () => 'msg-2' },
          conversationId: { toString: () => conversationId },
          role: 'assistant',
          content: 'Respuesta',
          metadata: undefined,
          createdAt: new Date('2026-08-24T10:01:00.000Z'),
        },
        {
          _id: { toString: () => 'msg-1' },
          conversationId: { toString: () => conversationId },
          role: 'user',
          content: 'Hola',
          metadata: undefined,
          createdAt: new Date('2026-08-24T10:00:00.000Z'),
        },
      ]);

      mockConversationModel.findOne.mockResolvedValue({
        _id: { toString: () => conversationId },
        studentId: { toString: () => '507f1f77bcf86cd799439011' },
        title: 'Chat',
        isActive: true,
        lastMessageAt: new Date(),
        messageCount: 2,
      });
      mockChatMessageModel.countDocuments.mockResolvedValue(2);
      mockChatMessageModel.find.mockReturnValue({
        sort,
        skip,
        limit,
        lean,
      });

      const result = await service.getHistory('507f1f77bcf86cd799439011', {
        conversationId,
        page: 1,
        limit: 10,
      });

      expect(result.conversation?.id).toBe(conversationId);
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[1].id).toBe('msg-2');
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('deleteHistory', () => {
    it('should delete all messages and clear cache', async () => {
      const conversationId = '507f1f77bcf86cd799439012';
      mockConversationModel.findOne.mockResolvedValue({
        _id: { toString: () => conversationId },
      });
      (service as any).conversationCache.set(conversationId, [
        { role: 'user', content: 'hola' },
      ]);

      await service.deleteHistory('507f1f77bcf86cd799439011', conversationId);

      expect(mockChatMessageModel.deleteMany).toHaveBeenCalled();
      expect(mockConversationModel.findByIdAndDelete).toHaveBeenCalled();
      expect((service as any).conversationCache.has(conversationId)).toBe(false);
    });

    it('should throw error if conversation not found', async () => {
      mockConversationModel.findOne.mockResolvedValue(null);

      await expect(
        service.deleteHistory('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
