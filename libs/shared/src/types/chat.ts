export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: ChatMessageMetadata;
  createdAt?: Date;
}

export interface ChatMessageMetadata {
  tokensUsed?: number;
  model?: string;
  responseTime?: number;
  relevantChunksCount?: number;
  retrievedCourseId?: string;
}

export interface Conversation {
  id: string;
  studentId: string;
  courseId?: string;
  title: string;
  isActive: boolean;
  lastMessageAt?: Date;
  messageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationSummary {
  id: string;
  title: string;
  studentId: string;
  courseId?: string;
  isActive: boolean;
  lastMessageAt?: Date;
  messageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SendMessageRequest {
  studentId: string;
  message: string;
  conversationId?: string;
}

export interface SendMessageResponse {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  relevantChunksCount?: number;
}

export interface ChatStreamStartEvent {
  type: 'start';
  conversationId: string;
  userMessage: ChatMessage;
  relevantChunksCount?: number;
}

export interface ChatStreamDeltaEvent {
  type: 'delta';
  content: string;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  conversationId: string;
  assistantMessage: ChatMessage;
  relevantChunksCount?: number;
}

export interface ChatStreamErrorEvent {
  type: 'error';
  message: string;
}

export type ChatStreamEvent =
  | ChatStreamStartEvent
  | ChatStreamDeltaEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent;

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  conversation: Conversation;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}
