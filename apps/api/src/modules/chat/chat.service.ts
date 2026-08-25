import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { AiService } from '../ai/ai.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SendMessageDto } from './dto/send-message.dto';

interface MessageHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type ChatStreamEvent =
  | {
      type: 'start';
      conversationId: string;
      userMessage: {
        id: string;
        conversationId: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        createdAt?: Date;
      };
      relevantChunksCount?: number;
    }
  | {
      type: 'delta';
      content: string;
    }
  | {
      type: 'done';
      conversationId: string;
      assistantMessage: {
        id: string;
        conversationId: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        metadata?: Record<string, unknown>;
        createdAt?: Date;
      };
      relevantChunksCount?: number;
    }
  | {
      type: 'error';
      message: string;
    };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly defaultConversationTitle = 'Nueva conversación';

  private conversationCache: Map<string, MessageHistory[]> = new Map();

  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private readonly aiService: AiService,
    private readonly knowledgeService: KnowledgeService
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const { studentId, message, conversationId } = dto;

    let conversation = conversationId
      ? await this.conversationModel.findById(conversationId)
      : await this.createConversation(studentId);

    if (!conversation) {
      conversation = await this.createConversation(studentId);
    }

    const history = await this.getConversationHistory(conversation._id.toString());

    const userMessage = await this.chatMessageModel.create({
      conversationId: conversation._id,
      role: 'user',
      content: message,
    });

    if (conversation.messageCount === 0 || conversation.title.toLowerCase().startsWith('nueva')) {
      const nextTitle = this.buildConversationTitle(message);
      conversation.title = nextTitle;
      await this.conversationModel.findByIdAndUpdate(conversation._id, {
        title: nextTitle,
      });
    }

    history.push({
      role: 'user',
      content: message,
    });

    const relevantChunks = await this.knowledgeService.searchSimilar(message, {
      courseId: conversation.courseId?.toString(),
      limit: 4,
      minScore: 0.2,
    });

    // El historial mantiene continuidad conversacional y los chunks aportan
    // el contexto factual recuperado desde el material del curso.
    const aiResponse = await this.aiService.generateResponseWithRAG(
      message,
      history,
      relevantChunks.map((chunk) => chunk.content)
    );

    const assistantMessage = await this.chatMessageModel.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: aiResponse.content,
      metadata: {
        tokensUsed: aiResponse.tokensUsed,
        model: aiResponse.model,
        relevantChunksCount: relevantChunks.length,
        retrievedCourseId: conversation.courseId?.toString(),
      },
    });

    history.push({
      role: 'assistant',
      content: aiResponse.content,
    });

    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 2 },
    });

    return {
      conversationId: conversation._id,
      userMessage,
      assistantMessage,
      relevantChunksCount: relevantChunks.length,
    };
  }

  async startNewConversation(
    studentId: string,
    initialContext?: string,
    courseId?: string
  ) {
    const conversation = await this.createConversation(studentId, courseId);
    const conversationIdStr = conversation._id.toString();
    const history: MessageHistory[] = [];

    if (initialContext) {
      history.push({
        role: 'system',
        content: initialContext,
      });
    }

    this.conversationCache.set(conversationIdStr, history);

    await this.conversationModel.updateMany(
      { studentId: new Types.ObjectId(studentId), _id: { $ne: conversation._id } },
      { isActive: false }
    );

    this.logger.log(`Nueva conversación iniciada: ${conversationIdStr}`);

    return conversation;
  }

  async listConversations(studentId: string) {
    const conversations = await this.conversationModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    return {
      conversations: conversations.map((conversation) => ({
        id: conversation._id.toString(),
        title: conversation.title,
        studentId: conversation.studentId.toString(),
        courseId: conversation.courseId?.toString(),
        isActive: conversation.isActive,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messageCount,
        createdAt: (conversation as any).createdAt,
        updatedAt: (conversation as any).updatedAt,
      })),
    };
  }

  async getHistory(
    studentId: string,
    options?: {
      conversationId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const studentObjectId = new Types.ObjectId(studentId);

    let conversation = options?.conversationId
      ? await this.conversationModel.findOne({
          _id: new Types.ObjectId(options.conversationId),
          studentId: studentObjectId,
        })
      : await this.conversationModel
          .findOne({ studentId: studentObjectId })
          .sort({ isActive: -1, lastMessageAt: -1, createdAt: -1 });

    if (!conversation) {
      return {
        messages: [],
        conversation: null,
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      };
    }

    const total = await this.chatMessageModel.countDocuments({
      conversationId: conversation._id,
    });

    const rawMessages = await this.chatMessageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const orderedMessages = rawMessages.reverse();

    return {
      messages: orderedMessages.map((message) => ({
        id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        role: message.role,
        content: message.content,
        metadata: message.metadata,
        createdAt: (message as any).createdAt,
      })),
      conversation: {
        id: conversation._id.toString(),
        studentId: conversation.studentId.toString(),
        courseId: conversation.courseId?.toString(),
        title: conversation.title,
        isActive: conversation.isActive,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messageCount,
        createdAt: (conversation as any).createdAt,
        updatedAt: (conversation as any).updatedAt,
      },
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  async deleteHistory(studentId: string, conversationId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      studentId: new Types.ObjectId(studentId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    await this.chatMessageModel.deleteMany({
      conversationId: conversation._id,
    });

    await this.conversationModel.findByIdAndDelete(conversation._id);
    this.conversationCache.delete(conversationId);
  }

  async streamResponse(
    dto: SendMessageDto,
    emit: (event: ChatStreamEvent) => void
  ) {
    const { studentId, message, conversationId } = dto;

    let conversation = conversationId
      ? await this.conversationModel.findById(conversationId)
      : await this.createConversation(studentId);

    if (!conversation) {
      conversation = await this.createConversation(studentId);
    }

    const history = await this.getConversationHistory(conversation._id.toString());

    const userMessage = await this.chatMessageModel.create({
      conversationId: conversation._id,
      role: 'user',
      content: message,
    });

    if (conversation.messageCount === 0 || conversation.title.toLowerCase().startsWith('nueva')) {
      const nextTitle = this.buildConversationTitle(message);
      conversation.title = nextTitle;
      await this.conversationModel.findByIdAndUpdate(conversation._id, {
        title: nextTitle,
      });
    }

    history.push({
      role: 'user',
      content: message,
    });

    const relevantChunks = await this.knowledgeService.searchSimilar(message, {
      courseId: conversation.courseId?.toString(),
      limit: 4,
      minScore: 0.2,
    });

    emit({
      type: 'start',
      conversationId: conversation._id.toString(),
      userMessage: {
        id: userMessage._id.toString(),
        conversationId: conversation._id.toString(),
        role: userMessage.role,
        content: userMessage.content,
        createdAt: (userMessage as any).createdAt,
      },
      relevantChunksCount: relevantChunks.length,
    });

    const aiStream = await this.aiService.generateResponseWithRAGStream(
      message,
      history,
      relevantChunks.map((chunk) => chunk.content)
    );

    let assistantContent = '';

    for await (const chunk of aiStream.stream) {
      assistantContent += chunk;
      emit({
        type: 'delta',
        content: chunk,
      });
    }

    const assistantMessage = await this.chatMessageModel.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: assistantContent,
      metadata: {
        tokensUsed: aiStream.tokensUsed,
        model: aiStream.model,
        relevantChunksCount: relevantChunks.length,
        retrievedCourseId: conversation.courseId?.toString(),
      },
    });

    history.push({
      role: 'assistant',
      content: assistantContent,
    });

    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 2 },
    });

    emit({
      type: 'done',
      conversationId: conversation._id.toString(),
      assistantMessage: {
        id: assistantMessage._id.toString(),
        conversationId: conversation._id.toString(),
        role: assistantMessage.role,
        content: assistantMessage.content,
        metadata: assistantMessage.metadata,
        createdAt: (assistantMessage as any).createdAt,
      },
      relevantChunksCount: relevantChunks.length,
    });
  }

  private buildConversationTitle(message: string): string {
    const trimmed = message.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return this.defaultConversationTitle;
    }

    return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
  }

  private async createConversation(studentId: string, courseId?: string) {
    return this.conversationModel.create({
      studentId: new Types.ObjectId(studentId),
      courseId: courseId ? new Types.ObjectId(courseId) : undefined,
      title: 'Nueva conversación',
      isActive: true,
      lastMessageAt: new Date(),
    });
  }

  private async getConversationHistory(conversationId: string): Promise<MessageHistory[]> {
    if (this.conversationCache.has(conversationId)) {
      return this.conversationCache.get(conversationId)!;
    }

    const messages = await this.chatMessageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    const history: MessageHistory[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    this.conversationCache.set(conversationId, history);

    return history;
  }
}
