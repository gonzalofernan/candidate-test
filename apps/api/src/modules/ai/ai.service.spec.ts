import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  const mockConfigService = {
    get: jest.fn(),
  };

  const mockCreate = jest.fn();
  const mockOpenAi = {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  };

  beforeEach(async () => {
    mockConfigService.get.mockReset();
    mockConfigService.get.mockReturnValue(undefined);
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return false when API key is not set', () => {
      (service as any).openai = undefined;
      expect(service.isConfigured()).toBe(false);
    });

    it('should return true when API key is set', () => {
      (service as any).openai = {} as any;
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('generateResponse', () => {
    it('should return placeholder response when OpenAI not configured', async () => {
      const result = await service.generateResponse('Hello');

      expect(result).toHaveProperty('content');
      expect(result.content).toContain('PLACEHOLDER');
      expect(result.model).toBe('placeholder');
    });

    it('should call OpenAI API with correct parameters', async () => {
      (service as any).openai = mockOpenAi;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Respuesta final' } }],
        usage: { total_tokens: 42 },
        model: 'gpt-5-mini-2025-08-07',
      });

      await service.generateResponse('Explica closures');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('Eres un asistente educativo'),
          },
          {
            role: 'user',
            content: 'Explica closures',
          },
        ],
      });
    });

    it('should include system prompt in messages', async () => {
      (service as any).openai = mockOpenAi;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 20 },
        model: 'gpt-5-mini-2025-08-07',
      });

      await service.generateResponse('Hola');

      const request = mockCreate.mock.calls[0][0];
      expect(request.messages[0]).toEqual({
        role: 'system',
        content: expect.stringContaining('Eres un asistente educativo'),
      });
    });

    it('should include conversation history', async () => {
      (service as any).openai = mockOpenAi;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 20 },
        model: 'gpt-5-mini-2025-08-07',
      });

      const history = [
        { role: 'user' as const, content: 'Primera pregunta' },
        { role: 'assistant' as const, content: 'Primera respuesta' },
      ];

      await service.generateResponse('Segunda pregunta', history);

      const request = mockCreate.mock.calls[0][0];
      expect(request.messages).toEqual([
        {
          role: 'system',
          content: expect.any(String),
        },
        ...history,
        {
          role: 'user',
          content: 'Segunda pregunta',
        },
      ]);
    });

    it('should handle OpenAI API errors', async () => {
      const loggerErrorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);
      const apiError = new Error('OpenAI exploded');

      (service as any).openai = mockOpenAi;
      mockCreate.mockRejectedValue(apiError);

      await expect(service.generateResponse('Hola')).rejects.toThrow('OpenAI exploded');
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error al generar respuesta con OpenAI',
        apiError
      );
    });

    it('should respect rate limits', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
      });

      (service as any).openai = mockOpenAi;
      mockCreate.mockRejectedValue(rateLimitError);

      await expect(service.generateResponse('Hola')).rejects.toMatchObject({
        message: 'Rate limit exceeded',
        status: 429,
      });
    });

    it('should return token usage information', async () => {
      (service as any).openai = mockOpenAi;
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Respuesta final' } }],
        usage: { total_tokens: 73 },
        model: 'gpt-5-mini-2025-08-07',
      });

      const result = await service.generateResponse('Resume el tema');

      expect(result).toEqual({
        content: 'Respuesta final',
        tokensUsed: 73,
        model: 'gpt-5-mini-2025-08-07',
      });
    });
  });

  describe('generateStreamResponse', () => {
    it('should yield tokens one by one', async () => {
      const chunks: string[] = [];

      for await (const chunk of service.generateStreamResponse('Hola')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toContain('PLACEHOLDER');
    });
  });

  describe('buildContextualSystemPrompt', () => {
    it('should include student name, course, progress and base prompt content', () => {
      const prompt = service.buildContextualSystemPrompt({
        name: 'María',
        currentCourse: 'React desde Cero',
        progress: 70,
      });

      expect(prompt).toContain('Eres un asistente educativo');
      expect(prompt).toContain('Nombre del estudiante: María.');
      expect(prompt).toContain('Curso actual: React desde Cero.');
      expect(prompt).toContain('Progreso aproximado: 70%.');
    });
  });
});
