import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @ApiOperation({ summary: 'Enviar mensaje al chat con IA' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado y respuesta generada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(dto);
  }

  @Post('message/stream')
  @ApiOperation({ summary: 'Enviar mensaje al chat con streaming' })
  @ApiResponse({ status: 200, description: 'Stream SSE iniciado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async sendMessageStream(@Body() dto: SendMessageDto, @Res() response: Response) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    const writeEvent = (eventName: string, payload: unknown) => {
      response.write(`event: ${eventName}\n`);
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      await this.chatService.streamResponse(dto, (event) => {
        const { type, ...payload } = event;
        writeEvent(type, payload);
      });
      response.end();
    } catch (error) {
      writeEvent('error', {
        message: error instanceof Error ? error.message : 'No se pudo completar el streaming',
      });
      response.end();
    }
  }

  @Post('conversation/new')
  @ApiOperation({ summary: 'Iniciar una nueva conversación' })
  @ApiResponse({ status: 201, description: 'Conversación creada' })
  async startNewConversation(
    @Body('studentId') studentId: string,
    @Body('initialContext') initialContext?: string,
    @Body('courseId') courseId?: string
  ) {
    return this.chatService.startNewConversation(studentId, initialContext, courseId);
  }

  @Get('conversations/:studentId')
  @ApiOperation({ summary: 'Listar conversaciones del estudiante' })
  @ApiParam({ name: 'studentId', description: 'ID del estudiante' })
  @ApiResponse({ status: 200, description: 'Lista de conversaciones' })
  async listConversations(@Param('studentId') studentId: string) {
    return this.chatService.listConversations(studentId);
  }

  @Get('history/:studentId')
  @ApiOperation({ summary: 'Obtener historial de chat del estudiante' })
  @ApiParam({ name: 'studentId', description: 'ID del estudiante' })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    description: 'ID de conversación específica',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Mensajes por página' })
  @ApiResponse({ status: 200, description: 'Historial de mensajes' })
  async getHistory(
    @Param('studentId') studentId: string,
    @Query('conversationId') conversationId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.chatService.getHistory(studentId, {
      conversationId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Delete('history/:studentId/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar historial de una conversación' })
  @ApiParam({ name: 'studentId', description: 'ID del estudiante' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversación' })
  @ApiResponse({ status: 204, description: 'Historial eliminado' })
  @ApiResponse({ status: 404, description: 'Conversación no encontrada' })
  async deleteHistory(
    @Param('studentId') studentId: string,
    @Param('conversationId') conversationId: string
  ) {
    return this.chatService.deleteHistory(studentId, conversationId);
  }
}
