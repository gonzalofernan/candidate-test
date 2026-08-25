import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { Bot, Hand, Lightbulb, BookOpen, Trash2 } from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { api } from '../services/api';
import { normalizeText } from '../utils/text';
import type {
  ChatHistoryResponse,
  ChatMessage as SharedChatMessage,
  ChatMessageMetadata,
  ChatStreamEvent,
  ConversationSummary,
} from '@candidate-test/shared';

interface ChatProps {
  studentId: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

const HISTORY_PAGE_SIZE = 20;

export function Chat({ studentId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const shouldHydrateConversationRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);
  const shouldUseSmoothScrollRef = useRef(true);
  const pendingScrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null
  );

  const { data: courses = [] } = useQuery({
    queryKey: ['courses', studentId],
    queryFn: () => api.getCourses(studentId),
  });

  const { data: conversationData, refetch: refetchConversations } = useQuery({
    queryKey: ['conversations', studentId],
    queryFn: () => api.getConversations(studentId),
  });

  const conversations: ConversationSummary[] = conversationData?.conversations || [];

  const courseNameById = useMemo(
    () =>
      new Map<string, string>(
        courses.map((course: { _id?: string; id?: string; title: string }) => [
          course._id || course.id || '',
          course.title,
        ])
      ),
    [courses]
  );

  const mapHistoryMessages = (history: ChatHistoryResponse) =>
    history.messages.map(
      (message: SharedChatMessage) => ({
        id: message.id,
        role: message.role === 'system' ? 'assistant' : message.role,
        content: normalizeText(message.content),
        metadata: message.metadata,
        timestamp: message.createdAt ? new Date(message.createdAt) : new Date(),
      })
    );

  useEffect(() => {
    if (!conversationId || !shouldHydrateConversationRef.current) {
      return;
    }

    let cancelled = false;

    setIsLoadingHistory(true);

    api
      .getChatHistory(studentId, conversationId, 1, HISTORY_PAGE_SIZE)
      .then((history) => {
        if (cancelled || !history?.conversation) {
          return;
        }

        shouldHydrateConversationRef.current = false;
        shouldAutoScrollRef.current = true;
        shouldUseSmoothScrollRef.current = false;
        setMessages(mapHistoryMessages(history));
        setHistoryPage(history.pagination.page);
        setHasMoreHistory(history.pagination.hasMore);
        setActiveCourseId(history.conversation.courseId || null);
        setIsLoadingHistory(false);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setErrorMessage(error.message || 'No se pudo cargar la conversación');
          setIsLoadingHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, conversationId]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    if (pendingScrollRestoreRef.current) {
      const previousMetrics = pendingScrollRestoreRef.current;
      container.scrollTop =
        container.scrollHeight - previousMetrics.scrollHeight + previousMetrics.scrollTop;
      pendingScrollRestoreRef.current = null;
      return;
    }

    if (shouldAutoScrollRef.current || isTyping) {
      messagesEndRef.current?.scrollIntoView({
        behavior: shouldUseSmoothScrollRef.current ? 'smooth' : 'auto',
      });
      shouldAutoScrollRef.current = false;
      shouldUseSmoothScrollRef.current = true;
    }
  }, [messages, isTyping]);

  const deleteConversationMutation = useMutation({
    mutationFn: async (targetConversationId: string) =>
      api.deleteChatHistory(studentId, targetConversationId),
    onSuccess: (_, deletedConversationId) => {
      if (conversationId === deletedConversationId) {
        setConversationId(null);
        setMessages([]);
        setStreamingMessageId(null);
        setHistoryPage(1);
        setHasMoreHistory(false);
      }
      void refetchConversations();
    },
  });

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setActiveCourseId(null);
    setErrorMessage(null);
    setStreamingMessageId(null);
    setHistoryPage(1);
    setHasMoreHistory(false);
    setIsLoadingHistory(false);
    streamingMessageIdRef.current = null;
    shouldHydrateConversationRef.current = false;
  };

  const handleOpenConversation = (conversation: ConversationSummary) => {
    setMessages([]);
    setErrorMessage(null);
    setStreamingMessageId(null);
    setHistoryPage(1);
    setHasMoreHistory(false);
    streamingMessageIdRef.current = null;
    shouldHydrateConversationRef.current = true;
    setConversationId(conversation.id);
    setActiveCourseId(conversation.courseId || null);
  };

  const handleDeleteConversation = async (targetConversationId: string) => {
    const confirmed = window.confirm(
      '¿Seguro que quieres borrar esta conversación? Esta acción no se puede deshacer.'
    );

    if (!confirmed) {
      return;
    }

    await deleteConversationMutation.mutateAsync(targetConversationId);
  };

  const loadOlderMessages = async () => {
    if (!conversationId || !hasMoreHistory || isLoadingHistory) {
      return;
    }

    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    setIsLoadingHistory(true);
    const previousMetrics = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    };

    try {
      const history = await api.getChatHistory(
        studentId,
        conversationId,
        historyPage + 1,
        HISTORY_PAGE_SIZE
      );
      const olderMessages = mapHistoryMessages(history);

      pendingScrollRestoreRef.current = previousMetrics;
      setMessages((currentMessages) => {
        const existingIds = new Set(currentMessages.map((message) => message.id));
        return [
          ...olderMessages.filter((message) => !existingIds.has(message.id)),
          ...currentMessages,
        ];
      });
      setHistoryPage(history.pagination.page);
      setHasMoreHistory(history.pagination.hasMore);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar la conversación');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;

    if (!container || container.scrollTop > 20) {
      return;
    }

    void loadOlderMessages();
  };

  const handleStreamEvent = (event: ChatStreamEvent) => {
    if (event.type === 'start') {
      const nextStreamingId = `stream-${event.conversationId}`;

      shouldAutoScrollRef.current = true;
      setConversationId(event.conversationId);
      setStreamingMessageId(nextStreamingId);
      streamingMessageIdRef.current = nextStreamingId;
      setMessages((prev) => [
        ...prev,
        {
          id: nextStreamingId,
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
      const activeStreamingId = streamingMessageIdRef.current;

      shouldAutoScrollRef.current = true;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === activeStreamingId
            ? {
                ...message,
                content: message.content + event.content,
              }
            : message
        )
      );
      return;
    }

    if (event.type === 'done') {
      const activeStreamingId = streamingMessageIdRef.current;

      shouldAutoScrollRef.current = true;
      setConversationId(event.conversationId);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === activeStreamingId
            ? {
                id: event.assistantMessage.id,
                role: 'assistant',
                content: normalizeText(event.assistantMessage.content),
                timestamp: event.assistantMessage.createdAt
                  ? new Date(event.assistantMessage.createdAt)
                  : new Date(),
                metadata: event.assistantMessage.metadata,
              }
            : message
        )
      );
      setStreamingMessageId(null);
      streamingMessageIdRef.current = null;
    }
  };

  const handleSendMessage = async (message: string) => {
    setErrorMessage(null);
    shouldHydrateConversationRef.current = false;
    shouldAutoScrollRef.current = true;
    shouldUseSmoothScrollRef.current = true;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    let streamStarted = false;
    let temporaryStreamId: string | null = null;

    try {
      await api.sendChatMessageStream(
        {
          studentId,
          message,
          conversationId: conversationId || undefined,
        },
        {
          onEvent: (event) => {
            if (event.type === 'start') {
              streamStarted = true;
              temporaryStreamId = `stream-${event.conversationId}`;
            }

            if (event.type === 'error') {
              throw new Error(event.message);
            }

            handleStreamEvent(event);
          },
        }
      );

      void refetchConversations();
      return;
    } catch (error) {
      console.error('Error sending streaming message:', error);

      if (!streamStarted) {
        try {
          let targetConversationId = conversationId;

          if (!targetConversationId) {
            const conversation = await api.startNewConversation(
              studentId,
              undefined,
              activeCourseId || undefined
            );
            targetConversationId = conversation._id;
            setConversationId(targetConversationId);
            void refetchConversations();
          }

          const data = await api.sendChatMessage({
            studentId,
            message,
            conversationId: targetConversationId || undefined,
          });

          if (!conversationId && data.conversationId) {
            setConversationId(data.conversationId);
          }

          const assistantMessage: Message = {
            id: data.assistantMessage._id,
            role: 'assistant',
            content: normalizeText(data.assistantMessage.content),
            timestamp: new Date(data.assistantMessage.createdAt),
            metadata: data.assistantMessage.metadata,
          };

          shouldAutoScrollRef.current = true;
          setMessages((prev) => [...prev, assistantMessage]);
          void refetchConversations();
          return;
        } catch (fallbackError) {
          console.error('Fallback message send failed:', fallbackError);
        }
      }

      setMessages((prev) =>
        prev.filter(
          (current) =>
            current.id !== temporaryStreamId && current.id !== streamingMessageIdRef.current
        )
      );
      setStreamingMessageId(null);
      streamingMessageIdRef.current = null;
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo enviar el mensaje');
    } finally {
      setIsTyping(false);
    }
  };

  const activeScopeLabel = activeCourseId
    ? `Curso: ${courseNameById.get(activeCourseId) || 'Curso seleccionado'}`
    : 'Modo libre';

  return (
    <Container>
      <ConversationRail>
        <RailHeader>Historial</RailHeader>
        <ConversationList aria-label="Historial de conversaciones">
          {conversations.map((conversation) => (
            <ConversationItem key={conversation.id}>
              <ConversationButton
                type="button"
                $active={conversation.id === conversationId}
                onClick={() => handleOpenConversation(conversation)}
              >
                <ConversationTitle>{normalizeText(conversation.title)}</ConversationTitle>
                <ConversationMeta>
                  {conversation.courseId
                    ? courseNameById.get(conversation.courseId) || 'Curso'
                    : 'Modo libre'}
                </ConversationMeta>
              </ConversationButton>
              <DeleteButton
                type="button"
                aria-label="Borrar conversación"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDeleteConversation(conversation.id);
                }}
              >
                <Trash2 size={14} />
              </DeleteButton>
            </ConversationItem>
          ))}
        </ConversationList>
      </ConversationRail>

      <MainPanel>
        <ChatHeader>
          <HeaderTitle>
            <HeaderIcon>
              <Bot size={32} />
            </HeaderIcon>
            <div>
              <h2>Asistente de Estudios</h2>
              <HeaderSubtitle>Pregúntame sobre tus cursos</HeaderSubtitle>
            </div>
          </HeaderTitle>

          <NewChatButton type="button" onClick={handleNewConversation}>
            + Nueva conversación
          </NewChatButton>
        </ChatHeader>

        <ScopeBar>
          <ScopeLabel>Alcance del chat</ScopeLabel>
          <ScopeSelect
            aria-label="Seleccionar curso para el chat"
            value={activeCourseId || 'free'}
            disabled={messages.length > 0 || isTyping}
            onChange={(event) =>
              setActiveCourseId(event.target.value === 'free' ? null : event.target.value)
            }
          >
            <option value="free">Modo libre (todos los cursos)</option>
            {courses.map((course: { _id?: string; id?: string; title: string }) => {
              const courseId = course._id || course.id;
              if (!courseId) return null;

              return (
                <option key={courseId} value={courseId}>
                  {course.title}
                </option>
              );
            })}
          </ScopeSelect>
          <ScopeHint>{activeScopeLabel}</ScopeHint>
        </ScopeBar>

        <MessagesContainer
          ref={messagesContainerRef}
          aria-live="polite"
          aria-label="Mensajes del chat"
          onScroll={handleMessagesScroll}
        >
          {isLoadingHistory && messages.length > 0 && (
            <HistoryLoading>Cargando mensajes anteriores...</HistoryLoading>
          )}

          {errorMessage && <ErrorBanner role="alert">{errorMessage}</ErrorBanner>}

          {messages.length === 0 && (
            <WelcomeMessage>
              <WelcomeIcon>
                <Hand size={48} />
              </WelcomeIcon>
              <WelcomeTitle>¡Hola! Soy tu asistente de estudios</WelcomeTitle>
              <WelcomeText>
                Puedo ayudarte con:
                <ul>
                  <li>Dudas sobre el contenido de tus cursos</li>
                  <li>Técnicas de estudio y organización</li>
                  <li>Motivación y consejos</li>
                </ul>
              </WelcomeText>
              <SuggestionButtons>
                <SuggestionButton
                  type="button"
                  onClick={() =>
                    void handleSendMessage('¿Cómo puedo mejorar mi técnica de estudio?')
                  }
                >
                  <Lightbulb size={14} /> Técnicas de estudio
                </SuggestionButton>
                <SuggestionButton
                  type="button"
                  onClick={() => void handleSendMessage('¿Qué curso me recomiendas empezar?')}
                >
                  <BookOpen size={14} /> Recomendaciones
                </SuggestionButton>
              </SuggestionButtons>
            </WelcomeMessage>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}

          {isTyping && !streamingMessageId && <ChatMessage role="assistant" content="" isLoading />}

          <div ref={messagesEndRef} />
        </MessagesContainer>

        <ChatInput
          onSend={(message) => void handleSendMessage(message)}
          disabled={isTyping}
          placeholder="Escribe tu pregunta..."
        />
      </MainPanel>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  height: calc(100vh - 48px);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const ConversationRail = styled.aside`
  width: 280px;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
`;

const RailHeader = styled.div`
  padding: var(--spacing-md);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
`;

const ConversationList = styled.div`
  overflow-y: auto;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
`;

const ConversationItem = styled.div`
  position: relative;

  &:hover button[data-delete='true'] {
    opacity: 1;
    pointer-events: auto;
  }
`;

const ConversationButton = styled.button<{ $active: boolean }>`
  width: 100%;
  text-align: left;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
  background: ${(props) =>
    props.$active ? 'color-mix(in srgb, var(--color-primary) 10%, white)' : 'transparent'};
  color: var(--color-text-primary);

  &:hover {
    border-color: var(--color-primary);
  }
`;

const ConversationTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
`;

const ConversationMeta = styled.div`
  font-size: 12px;
  margin-top: 4px;
  color: var(--color-text-secondary);
`;

const DeleteButton = styled.button.attrs({ 'data-delete': 'true' })`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;

  &:hover {
    color: #b91c1c;
    border-color: #ef4444;
    background: #fef2f2;
  }
`;

const MainPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ChatHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);

  h2 {
    font-size: 16px;
    font-weight: 600;
  }
`;

const HeaderIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
`;

const HeaderSubtitle = styled.p`
  font-size: 13px;
  color: var(--color-text-secondary);
`;

const NewChatButton = styled.button`
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 13px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`;

const ScopeBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: color-mix(in srgb, var(--color-surface) 72%, white);
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
`;

const ScopeLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
`;

const ScopeSelect = styled.select`
  min-width: 220px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text-primary);
  font: inherit;

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const ScopeHint = styled.span`
  font-size: 13px;
  color: var(--color-text-secondary);
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
`;

const HistoryLoading = styled.div`
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
`;

const ErrorBanner = styled.div`
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid rgba(220, 38, 38, 0.25);
  background: rgba(254, 242, 242, 0.9);
  color: #b91c1c;
`;

const WelcomeMessage = styled.div`
  text-align: center;
  max-width: 400px;
  margin: var(--spacing-xl) auto;
`;

const WelcomeIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-md);
  color: var(--color-primary);
`;

const WelcomeTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
`;

const WelcomeText = styled.div`
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-bottom: var(--spacing-lg);

  ul {
    text-align: left;
    margin-top: var(--spacing-sm);
    padding-left: var(--spacing-lg);
  }

  li {
    margin-bottom: var(--spacing-xs);
  }
`;

const SuggestionButtons = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  justify-content: center;
  flex-wrap: wrap;
`;

const SuggestionButton = styled.button`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--color-text-primary);
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
`;
