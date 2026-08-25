import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'Student', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: false })
  courseId?: Types.ObjectId;

  @Prop({ default: 'Nueva conversación' })
  title: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastMessageAt?: Date;

  @Prop({ default: 0 })
  messageCount: number;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
