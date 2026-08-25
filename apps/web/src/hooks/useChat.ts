import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { normalizeText } from '../utils/text';
import type { ChatMessageMetadata, ChatStreamEvent } from '@candidate-test/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

interface UseChatOptions {
  studentId: string;
  onError?: (error: Error) => void;
}

export function useChat({ studentId, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      let targetConversationId = conversationId;

      if (!targetConversationId) {
        const conversation = await api.startNewConversation(studentId);
        targetConversationId = conversation._id;
        setConversationId(targetConversationId);
      }

      return api.sendChatMessage({
        studentId,
        message,
        conversationId: targetConversationId || undefined,
      });
    },
    onSuccess: (data) => {
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        id: data.assistantMessage._id,
        role: 'assistant',
        content: normalizeText(data.assistantMessage.content),
        timestamp: new Date(data.assistantMessage.createdAt || Date.now()),
        metadata: data.assistantMessage.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      void queryClient.invalidateQueries({ queryKey: ['conversations', studentId] });
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const sendWithStreaming = useCallback(
    async (message: string) => {
      setIsStreaming(true);

      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      let streamAssistantId: string | null = null;

      try {
        const handleEvent = (event: ChatStreamEvent) => {
          if (event.type === 'start') {
            const nextAssistantId = `stream-${event.conversationId}`;
            streamAssistantId = nextAssistantId;

            setConversationId(event.conversationId);
            setMessages((prev) => [
              ...prev,
              {
                id: nextAssistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                metadata: {
                  relevantChunksCount: event.relevantChunksCount,
                },
              },
            ]);
            return;
          }

          if (event.type === 'delta') {
            if (!streamAssistantId) {
              return;
            }

            setMessages((prev) =>
              prev.map((current) =>
                current.id === streamAssistantId
                  ? { ...current, content: current.content + event.content }
                  : current
              )
            );
            return;
          }

          if (event.type === 'done') {
            setConversationId(event.conversationId);
            setMessages((prev) =>
              prev.map((current) =>
                current.id === streamAssistantId
                  ? {
                      id: event.assistantMessage.id,
                      role: 'assistant',
                      content: normalizeText(event.assistantMessage.content),
                      timestamp: event.assistantMessage.createdAt
                        ? new Date(event.assistantMessage.createdAt)
                        : new Date(),
                      metadata: event.assistantMessage.metadata,
                    }
                  : current
              )
            );
            return;
          }

          throw new Error(event.message);
        };

        await api.sendChatMessageStream(
          {
            studentId,
            message,
            conversationId: conversationId || undefined,
          },
          { onEvent: handleEvent }
        );

        void queryClient.invalidateQueries({ queryKey: ['conversations', studentId] });
      } catch (error) {
        setMessages((prev) => prev.filter((current) => current.id !== streamAssistantId));

        try {
          await sendMutation.mutateAsync(message);
        } catch (fallbackError) {
          onError?.(fallbackError as Error);
          throw fallbackError;
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId, onError, queryClient, sendMutation, studentId]
  );

  const startNewConversation = useCallback(async () => {
    try {
      const result = await api.startNewConversation(studentId);
      setConversationId(result._id);
      setMessages([]);
      return result;
    } catch (error) {
      onError?.(error as Error);
    }
  }, [studentId, onError]);

  const loadHistory = useCallback(async () => {
    if (!conversationId) return;

    try {
      const history = await api.getChatHistory(studentId, conversationId);
      setMessages(
        history.messages.map(
          (message: {
            id: string;
            role: 'user' | 'assistant';
            content: string;
            metadata?: ChatMessageMetadata;
            createdAt?: string;
          }) => ({
            id: message.id,
            role: message.role,
            content: normalizeText(message.content),
            metadata: message.metadata,
            timestamp: new Date(message.createdAt || Date.now()),
          })
        )
      );
    } catch (error) {
      onError?.(error as Error);
    }
  }, [studentId, conversationId, onError]);

  return {
    messages,
    conversationId,
    isLoading: sendMutation.isPending,
    isStreaming,
    error: sendMutation.error,
    sendMessage: sendMutation.mutate,
    sendWithStreaming,
    startNewConversation,
    loadHistory,
    clearMessages: () => setMessages([]),
  };
}
