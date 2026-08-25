import { Controller, Get, Patch, Param, Body, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { StudentService } from './student.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('students')
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Obtener datos del dashboard del estudiante' })
  @ApiParam({ name: 'id', description: 'ID del estudiante' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
  async getDashboard(@Param('id') id: string) {
    const dashboard = await this.studentService.getDashboard(id);
    if (!dashboard) {
      throw new NotFoundException(`Estudiante con ID ${id} no encontrado`);
    }
    return dashboard;
  }

  @Get(':id/courses')
  @ApiOperation({ summary: 'Obtener cursos del estudiante con progreso' })
  @ApiParam({ name: 'id', description: 'ID del estudiante' })
  @ApiResponse({ status: 200, description: 'Lista de cursos con progreso' })
  async getCourses(@Param('id') id: string) {
    return this.studentService.getCoursesWithProgress(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Obtener estadísticas detalladas del estudiante' })
  @ApiParam({ name: 'id', description: 'ID del estudiante' })
  @ApiResponse({ status: 200, description: 'Estadísticas del estudiante' })
  async getStats(@Param('id') id: string) {
    const stats = await this.studentService.getDetailedStats(id);
    if (!stats) {
      throw new NotFoundException(`Estudiante con ID ${id} no encontrado`);
    }

    return stats;
  }

  @Patch(':id/preferences')
  @ApiOperation({ summary: 'Actualizar preferencias del estudiante' })
  @ApiParam({ name: 'id', description: 'ID del estudiante' })
  @ApiResponse({ status: 200, description: 'Preferencias actualizadas' })
  @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
  async updatePreferences(
    @Param('id') id: string,
    @Body() updatePreferencesDto: UpdatePreferencesDto
  ) {
    const student = await this.studentService.updatePreferences(id, updatePreferencesDto);
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${id} no encontrado`);
    }

    return student;
  }
}
