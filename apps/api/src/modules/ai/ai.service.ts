import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface MessageHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiResponse {
  content: string;
  tokensUsed?: number;
  model?: string;
}

interface AiStreamResult {
  content: string;
  tokensUsed?: number;
  model?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model = 'gpt-5-mini';
  private openai?: OpenAI;

  /**
   * System prompt base para el asistente de estudiantes.
   * Mantiene reglas de seguridad y tono comunes para cualquier respuesta.
   */
  private readonly baseSystemPrompt = `Eres un asistente educativo amigable y servicial para estudiantes de una plataforma de cursos online.

Tu objetivo es:
- Ayudar a los estudiantes con dudas sobre el contenido de sus cursos
- Motivar y dar apoyo emocional cuando sea necesario
- Sugerir recursos y técnicas de estudio
- Responder de forma clara, concisa y amigable

Reglas:
- No des respuestas a exámenes directamente, guía al estudiante para que llegue a la respuesta
- Si no sabes algo, admítelo y sugiere buscar ayuda adicional
- Mantén un tono positivo y motivador
- Usa ejemplos prácticos cuando sea posible`;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateResponse(
    userMessage: string,
    history: MessageHistory[] = []
  ): Promise<AiResponse> {
    this.logger.debug(`Generando respuesta para: "${userMessage.substring(0, 50)}..."`);

    return this.generateCompletion({
      systemPrompt: this.baseSystemPrompt,
      userMessage,
      history,
    });
  }

  async *generateStreamResponse(
    userMessage: string,
    history: MessageHistory[] = []
  ): AsyncGenerator<string> {
    const response = await this.streamCompletion({
      systemPrompt: this.baseSystemPrompt,
      userMessage,
      history,
    });

    for (const chunk of response.content.split(' ')) {
      yield `${chunk} `;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  buildContextualSystemPrompt(studentContext: {
    name: string;
    currentCourse?: string;
    progress?: number;
  }): string {
    const contextLines = [
      `Nombre del estudiante: ${studentContext.name}.`,
      studentContext.currentCourse
        ? `Curso actual: ${studentContext.currentCourse}.`
        : null,
      typeof studentContext.progress === 'number'
        ? `Progreso aproximado: ${studentContext.progress}%.`
        : null,
    ].filter(Boolean);

    return `${this.baseSystemPrompt}\n\nContexto del estudiante:\n- ${contextLines.join('\n- ')}`;
  }

  async generateResponseWithRAG(
    userMessage: string,
    history: MessageHistory[] = [],
    relevantContext?: string[]
  ): Promise<AiResponse> {
    const ragContext =
      relevantContext && relevantContext.length > 0
        ? `\n\nContexto recuperado del curso:\n${relevantContext
            .map((chunk, index) => `[${index + 1}] ${chunk}`)
            .join('\n\n')}\n\nUsa este contexto como fuente principal para responder.`
        : '';

    return this.generateCompletion({
      systemPrompt: `${this.baseSystemPrompt}${ragContext}`,
      userMessage,
      history,
    });
  }

  async generateResponseWithRAGStream(
    userMessage: string,
    history: MessageHistory[] = [],
    relevantContext?: string[]
  ): Promise<AiStreamResult & { stream: AsyncGenerator<string> }> {
    const ragContext =
      relevantContext && relevantContext.length > 0
        ? `\n\nContexto recuperado del curso:\n${relevantContext
            .map((chunk, index) => `[${index + 1}] ${chunk}`)
            .join('\n\n')}\n\nUsa este contexto como fuente principal para responder.`
        : '';

    return this.streamCompletion({
      systemPrompt: `${this.baseSystemPrompt}${ragContext}`,
      userMessage,
      history,
    });
  }

  isConfigured(): boolean {
    return !!this.openai;
  }

  /**
   * Centraliza la llamada al modelo para evitar duplicar construcción de mensajes
   * entre la respuesta básica y la respuesta con RAG.
   */
  private async generateCompletion(params: {
    systemPrompt: string;
    userMessage: string;
    history: MessageHistory[];
  }): Promise<AiResponse> {
    const { systemPrompt, userMessage, history } = params;

    if (!this.openai) {
      return this.generatePlaceholderResponse(userMessage);
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...history,
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      return {
        content: completion.choices[0]?.message?.content || '',
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      };
    } catch (error) {
      this.logger.error('Error al generar respuesta con OpenAI', error);
      throw error;
    }
  }

  private async streamCompletion(params: {
    systemPrompt: string;
    userMessage: string;
    history: MessageHistory[];
  }): Promise<AiStreamResult & { stream: AsyncGenerator<string> }> {
    const { systemPrompt, userMessage, history } = params;

    if (!this.openai) {
      const placeholder = this.generatePlaceholderResponse(userMessage);

      return {
        ...placeholder,
        stream: this.streamFromText(placeholder.content),
      };
    }

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...history,
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      let aggregatedContent = '';
      const self = this;

      async function* forwardChunks(): AsyncGenerator<string> {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';

          if (!delta) {
            continue;
          }

          aggregatedContent += delta;
          yield delta;
        }
      }

      return {
        content: aggregatedContent,
        model: this.model,
        stream: (async function* () {
          for await (const delta of forwardChunks()) {
            yield delta;
          }
        })(),
      };
    } catch (error) {
      this.logger.error('Error al generar streaming con OpenAI', error);
      throw error;
    }
  }

  private async *streamFromText(content: string): AsyncGenerator<string> {
    const words = content.split(' ');

    for (const word of words) {
      yield `${word} `;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private generatePlaceholderResponse(userMessage: string): AiResponse {
    const responses = [
      '¡Hola! Soy tu asistente de estudios. Veo que tienes una pregunta interesante. Para ayudarte mejor, ¿podrías darme más detalles sobre el tema específico del curso en el que necesitas ayuda?',
      'Entiendo tu duda. Este es un tema importante que muchos estudiantes encuentran desafiante. Te sugiero que revisemos los conceptos paso a paso. ¿Por dónde te gustaría empezar?',
      '¡Excelente pregunta! Esto demuestra que estás pensando críticamente sobre el material. Déjame darte una explicación que te ayude a entender mejor el concepto.',
      'Gracias por compartir tu pregunta. Para darte la mejor ayuda posible, necesito que OpenAI esté configurado. Por ahora, te recomiendo revisar el material del curso y volver con preguntas específicas.',
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return {
      content: `[RESPUESTA PLACEHOLDER - Implementar OpenAI]\n\n${randomResponse}`,
      tokensUsed: 0,
      model: 'placeholder',
    };
  }
}
