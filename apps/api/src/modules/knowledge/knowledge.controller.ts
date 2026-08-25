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
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('index')
  @ApiOperation({ summary: 'Indexar contenido de un curso' })
  @ApiResponse({ status: 201, description: 'Contenido indexado exitosamente' })
  async indexContent(
    @Body() body: { courseId: string; content: string; sourceFile?: string }
  ) {
    if (!body.courseId || !body.content) {
      throw new BadRequestException('courseId y content son obligatorios');
    }

    // sourceFile permite distinguir reindexaciones por origen de contenido
    // y reemplazar solo los chunks asociados a ese material.
    return this.knowledgeService.indexCourseContent(
      body.courseId,
      body.content,
      body.sourceFile || 'manual-input'
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar contenido similar' })
  @ApiResponse({ status: 200, description: 'Resultados de busqueda' })
  async search(
    @Query('q') query: string,
    @Query('courseId') courseId?: string,
    @Query('limit') limit?: number
  ) {
    if (!query) {
      throw new BadRequestException('q es obligatorio');
    }

    return this.knowledgeService.searchSimilar(query, {
      courseId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadisticas de la base de conocimiento' })
  async getStats() {
    return this.knowledgeService.getStats();
  }

  @Delete('course/:courseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar conocimiento de un curso' })
  async deleteCourseKnowledge(@Param('courseId') courseId: string) {
    return this.knowledgeService.deleteCourseChunks(courseId);
  }
}
