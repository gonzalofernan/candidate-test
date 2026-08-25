import { Test, TestingModule } from '@nestjs/testing';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { NotFoundException } from '@nestjs/common';

describe('StudentController', () => {
  let controller: StudentController;
  let service: StudentService;

  const mockStudentService = {
    getDashboard: jest.fn(),
    getCoursesWithProgress: jest.fn(),
    getDetailedStats: jest.fn(),
    updatePreferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        {
          provide: StudentService,
          useValue: mockStudentService,
        },
      ],
    }).compile();

    controller = module.get<StudentController>(StudentController);
    service = module.get<StudentService>(StudentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard data for valid student', async () => {
      const mockDashboard = {
        student: {
          id: '507f1f77bcf86cd799439011',
          name: 'María García',
          email: 'maria@test.com',
        },
        stats: {
          totalCourses: 5,
          completedCourses: 1,
          inProgressCourses: 2,
          totalTimeSpentMinutes: 565,
          totalTimeSpentFormatted: '9h 25m',
        },
        recentCourses: [],
      };

      mockStudentService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockDashboard);
      expect(service.getDashboard).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException when student not found', async () => {
      mockStudentService.getDashboard.mockResolvedValue(null);

      await expect(controller.getDashboard('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCourses', () => {
    it('should return courses with progress', async () => {
      const mockCourses = [
        {
          _id: 'course1',
          title: 'React desde Cero',
          progress: { progressPercentage: 70 },
        },
        {
          _id: 'course2',
          title: 'Node.js',
          progress: null,
        },
      ];

      mockStudentService.getCoursesWithProgress.mockResolvedValue(mockCourses);

      const result = await controller.getCourses('507f1f77bcf86cd799439011');

      expect(result).toHaveLength(2);
      expect(result[0].progress?.progressPercentage).toBe(70);
    });
  });

  describe('getStats', () => {
    it('should return detailed statistics for student', async () => {
      const mockStats = {
        totalTimeSpentMinutes: 565,
        totalTimeSpentFormatted: '9h 25m',
        completedCourses: 1,
        inProgressCourses: 2,
        studyStreakDays: 2,
        averageWeeklyProgress: 41,
        timeByCategory: [{ category: 'Frontend', minutes: 280, formatted: '4h 40m' }],
      };

      mockStudentService.getDetailedStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockStats);
      expect(service.getDetailedStats).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException when stats student is missing', async () => {
      mockStudentService.getDetailedStats.mockResolvedValue(null);

      await expect(controller.getStats('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePreferences', () => {
    it('should update student preferences', async () => {
      const payload = { theme: 'dark' as const, notifications: false };
      const updatedStudent = {
        id: '507f1f77bcf86cd799439011',
        name: 'María García',
        email: 'maria@test.com',
        preferences: payload,
      };

      mockStudentService.updatePreferences.mockResolvedValue(updatedStudent);

      const result = await controller.updatePreferences(
        '507f1f77bcf86cd799439011',
        payload
      );

      expect(result).toEqual(updatedStudent);
      expect(service.updatePreferences).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        payload
      );
    });

    it('should throw NotFoundException for invalid student', async () => {
      mockStudentService.updatePreferences.mockResolvedValue(null);

      await expect(
        controller.updatePreferences('missing', { theme: 'light' })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
