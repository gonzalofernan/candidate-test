import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

export type MessageRole = 'user' | 'assistant' | 'system';

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role: MessageRole;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Object })
  metadata?: {
    tokensUsed?: number;
    model?: string;
    responseTime?: number;
    relevantChunksCount?: number;
    retrievedCourseId?: string;
  };
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
