import axios from 'axios';
import type { ChatStreamEvent, SendMessageRequest } from '@candidate-test/shared';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  getDashboard: async (studentId: string) => {
    const response = await apiClient.get(`/students/${studentId}/dashboard`);
    return response.data;
  },

  getCourses: async (studentId: string) => {
    const response = await apiClient.get(`/students/${studentId}/courses`);
    return response.data;
  },

  getStats: async (studentId: string) => {
    const response = await apiClient.get(`/students/${studentId}/stats`);
    return response.data;
  },

  updatePreferences: async (studentId: string, preferences: any) => {
    const response = await apiClient.patch(`/students/${studentId}/preferences`, preferences);
    return response.data;
  },

  sendChatMessage: async (data: {
    studentId: string;
    message: string;
    conversationId?: string;
  }) => {
    const response = await apiClient.post('/chat/message', data);
    return response.data;
  },

  sendChatMessageStream: async (
    data: SendMessageRequest,
    handlers: {
      onEvent: (event: ChatStreamEvent) => void;
      signal?: AbortSignal;
    }
  ) => {
    const response = await fetch('/api/chat/message/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(data),
      signal: handlers.signal,
    });

    if (!response.ok) {
      let message = 'Error de conexión';

      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {
        message = response.statusText || message;
      }

      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('El navegador no soporta streaming en esta respuesta');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const dispatchBufferedEvents = () => {
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const lines = frame
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length === 0) {
          continue;
        }

        const eventLine = lines.find((line) => line.startsWith('event:'));
        const dataLine = lines.find((line) => line.startsWith('data:'));

        if (!eventLine || !dataLine) {
          continue;
        }

        const eventType = eventLine.replace(/^event:\s*/, '');
        const rawData = dataLine.replace(/^data:\s*/, '');
        const parsedData = JSON.parse(rawData);

        handlers.onEvent({
          type: eventType as ChatStreamEvent['type'],
          ...parsedData,
        } as ChatStreamEvent);
      }
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        dispatchBufferedEvents();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      dispatchBufferedEvents();
    }
  },

  startNewConversation: async (
    studentId: string,
    initialContext?: string,
    courseId?: string
  ) => {
    const response = await apiClient.post('/chat/conversation/new', {
      studentId,
      initialContext,
      courseId,
    });
    return response.data;
  },

  getConversations: async (studentId: string) => {
    const response = await apiClient.get(`/chat/conversations/${studentId}`);
    return response.data;
  },

  getChatHistory: async (
    studentId: string,
    conversationId?: string,
    page: number = 1,
    limit: number = 50
  ) => {
    const params = {
      ...(conversationId ? { conversationId } : {}),
      page,
      limit,
    };
    const response = await apiClient.get(`/chat/history/${studentId}`, { params });
    return response.data;
  },

  deleteChatHistory: async (studentId: string, conversationId: string) => {
    const response = await apiClient.delete(`/chat/history/${studentId}/${conversationId}`);
    return response.data;
  },
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    const message = error.response?.data?.message || 'Error de conexión';
    return Promise.reject(new Error(message));
  }
);
