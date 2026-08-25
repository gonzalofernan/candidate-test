import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Chat } from './Chat';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    sendChatMessage: vi.fn(),
    sendChatMessageStream: vi.fn(),
    startNewConversation: vi.fn(),
    getChatHistory: vi.fn(),
    getConversations: vi.fn(),
    getCourses: vi.fn(),
    deleteChatHistory: vi.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Chat', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api.getCourses).mockResolvedValue([{ _id: 'course-1', title: 'React Hooks' }]);
    vi.mocked(api.getConversations).mockResolvedValue({
      conversations: [
        {
          id: 'conv-existing',
          title: 'Dudas sobre Hooks',
          studentId: 'test-id',
          courseId: 'course-1',
          isActive: true,
          messageCount: 2,
        },
      ],
    });
    vi.mocked(api.startNewConversation).mockResolvedValue({ _id: 'conv-123' });
    vi.mocked(api.getChatHistory).mockResolvedValue({
      conversation: {
        id: 'conv-existing',
        courseId: 'course-1',
      },
      messages: [
        {
          id: 'msg-old-1',
          role: 'user',
          content: 'Pregunta anterior',
          createdAt: new Date('2026-08-24T10:00:00.000Z').toISOString(),
        },
        {
          id: 'msg-old-2',
          role: 'assistant',
          content: 'Respuesta anterior',
          createdAt: new Date('2026-08-24T10:01:00.000Z').toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 22,
        hasMore: true,
      },
    });
    vi.mocked(api.deleteChatHistory).mockResolvedValue(undefined);
    vi.mocked(api.sendChatMessageStream).mockImplementation(async (_data, handlers) => {
      handlers.onEvent({
        type: 'start',
        conversationId: 'conv-123',
        userMessage: {
          id: 'msg-user',
          conversationId: 'conv-123',
          role: 'user',
          content: 'Test',
        },
        relevantChunksCount: 4,
      });
      handlers.onEvent({
        type: 'delta',
        content: 'Response',
      });
      handlers.onEvent({
        type: 'done',
        conversationId: 'conv-123',
        assistantMessage: {
          id: 'msg-assistant',
          conversationId: 'conv-123',
          role: 'assistant',
          content: 'Response',
          metadata: {
            relevantChunksCount: 4,
            model: 'gpt-5-mini-2025-08-07',
          },
          createdAt: new Date('2026-08-24T10:02:00.000Z').toISOString(),
        },
        relevantChunksCount: 4,
      });
    });
    vi.mocked(api.sendChatMessage).mockResolvedValue({
      conversationId: 'conv-123',
      userMessage: { _id: 'msg-1', content: 'Test', role: 'user' },
      assistantMessage: {
        _id: 'msg-2',
        content: 'Fallback response',
        role: 'assistant',
        createdAt: new Date('2026-08-24T10:02:00.000Z').toISOString(),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should render welcome message when no messages', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    expect(await screen.findByText(/Hola/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asistente de Estudios' })).toBeInTheDocument();
  });

  it('should send message through streaming when clicking send button', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.change(screen.getByLabelText('Mensaje del chat'), {
      target: { value: 'Hola RAG' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => {
      expect(api.sendChatMessageStream).toHaveBeenCalledWith(
        {
          studentId: 'test-id',
          message: 'Hola RAG',
          conversationId: undefined,
        },
        expect.objectContaining({
          onEvent: expect.any(Function),
        })
      );
    });

    expect(await screen.findByText('Response')).toBeInTheDocument();
  });

  it('should send message when pressing Enter', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.change(screen.getByLabelText('Mensaje del chat'), {
      target: { value: 'Hola por teclado' },
    });
    fireEvent.keyDown(screen.getByLabelText('Mensaje del chat'), {
      key: 'Enter',
      code: 'Enter',
    });

    await waitFor(() => {
      expect(api.sendChatMessageStream).toHaveBeenCalled();
    });
  });

  it('should show user message immediately and stream assistant content', async () => {
    const pending = deferred<void>();
    vi.mocked(api.sendChatMessageStream).mockImplementationOnce(async (_data, handlers) => {
      handlers.onEvent({
        type: 'start',
        conversationId: 'conv-existing',
        userMessage: {
          id: 'msg-user',
          conversationId: 'conv-existing',
          role: 'user',
          content: 'Mensaje optimista',
        },
      });
      handlers.onEvent({
        type: 'delta',
        content: 'Respuesta ',
      });
      await pending.promise;
      handlers.onEvent({
        type: 'delta',
        content: 'final',
      });
      handlers.onEvent({
        type: 'done',
        conversationId: 'conv-existing',
        assistantMessage: {
          id: 'msg-assistant',
          conversationId: 'conv-existing',
          role: 'assistant',
          content: 'Respuesta final',
          createdAt: new Date('2026-08-24T10:02:00.000Z').toISOString(),
        },
      });
    });

    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.click(await screen.findByRole('button', { name: /Dudas sobre Hooks/i }));
    await screen.findByText('Pregunta anterior');

    fireEvent.change(screen.getByLabelText('Mensaje del chat'), {
      target: { value: 'Mensaje optimista' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByText('Mensaje optimista')).toBeInTheDocument();
    expect(await screen.findByText('Respuesta')).toBeInTheDocument();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(await screen.findByText('Respuesta final')).toBeInTheDocument();
  });

  it('should disable input while streaming', async () => {
    const pending = deferred<void>();
    vi.mocked(api.sendChatMessageStream).mockImplementationOnce(async (_data, handlers) => {
      handlers.onEvent({
        type: 'start',
        conversationId: 'conv-123',
        userMessage: {
          id: 'msg-user',
          conversationId: 'conv-123',
          role: 'user',
          content: 'Espera',
        },
      });
      await pending.promise;
      handlers.onEvent({
        type: 'done',
        conversationId: 'conv-123',
        assistantMessage: {
          id: 'msg-assistant',
          conversationId: 'conv-123',
          role: 'assistant',
          content: 'Hecho',
          createdAt: new Date('2026-08-24T10:02:00.000Z').toISOString(),
        },
      });
    });

    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.change(screen.getByLabelText('Mensaje del chat'), {
      target: { value: 'Espera' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Mensaje del chat')).toBeDisabled();
    });

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
  });

  it('should start new conversation when button clicked', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.click(await screen.findByRole('button', { name: /Dudas sobre Hooks/i }));
    expect(await screen.findByText('Pregunta anterior')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ Nueva conversación/i }));

    expect(await screen.findByText(/Hola/i)).toBeInTheDocument();
  });

  it('should load history for existing conversation', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.click(await screen.findByRole('button', { name: /Dudas sobre Hooks/i }));

    expect(await screen.findByText('Pregunta anterior')).toBeInTheDocument();
    expect(screen.getByText('Respuesta anterior')).toBeInTheDocument();
  });

  it('should load older messages when scrolling to the top', async () => {
    vi.mocked(api.getChatHistory)
      .mockResolvedValueOnce({
        conversation: {
          id: 'conv-existing',
          courseId: 'course-1',
        },
        messages: [
          {
            id: 'msg-old-1',
            role: 'user',
            content: 'Pregunta anterior',
            createdAt: new Date('2026-08-24T10:00:00.000Z').toISOString(),
          },
          {
            id: 'msg-old-2',
            role: 'assistant',
            content: 'Respuesta anterior',
            createdAt: new Date('2026-08-24T10:01:00.000Z').toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 22,
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        conversation: {
          id: 'conv-existing',
          courseId: 'course-1',
        },
        messages: [
          {
            id: 'msg-older-1',
            role: 'user',
            content: 'Mensaje más antiguo',
            createdAt: new Date('2026-08-24T09:58:00.000Z').toISOString(),
          },
        ],
        pagination: {
          page: 2,
          limit: 20,
          total: 22,
          hasMore: false,
        },
      });

    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.click(await screen.findByRole('button', { name: /Dudas sobre Hooks/i }));
    const messagesContainer = await screen.findByLabelText('Mensajes del chat');

    Object.defineProperty(messagesContainer, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(messagesContainer, 'scrollHeight', {
      value: 400,
      writable: true,
      configurable: true,
    });

    fireEvent.scroll(messagesContainer);

    await waitFor(() => {
      expect(api.getChatHistory).toHaveBeenLastCalledWith('test-id', 'conv-existing', 2, 20);
    });

    expect(await screen.findByText('Mensaje más antiguo')).toBeInTheDocument();
  });

  it('should fallback to classic endpoint when streaming fails before start', async () => {
    vi.mocked(api.sendChatMessageStream).mockRejectedValueOnce(new Error('Fallo stream'));

    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.change(screen.getByLabelText('Mensaje del chat'), {
      target: { value: 'Usa fallback' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => {
      expect(api.sendChatMessage).toHaveBeenCalledWith({
        studentId: 'test-id',
        message: 'Usa fallback',
        conversationId: 'conv-123',
      });
    });

    expect(await screen.findByText('Fallback response')).toBeInTheDocument();
  });

  it('should show error when streaming and fallback both fail', async () => {
    vi.mocked(api.sendChatMessageStream).mockRejectedValueOnce(new Error('Fallo stream'));
    vi.mocked(api.sendChatMessage).mockRejectedValueOnce(new Error('Fallo final'));

    renderWithProviders(<Chat studentId="test-id" />);

    fireEvent.change(screen.getByLabelText('Mensaje del chat'), {
      target: { value: 'Provoca error' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo stream');
  });

  it('should have proper aria labels', async () => {
    renderWithProviders(<Chat studentId="test-id" />);

    expect(await screen.findByLabelText('Historial de conversaciones')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar curso para el chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensajes del chat')).toBeInTheDocument();
  });
});
