import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { Course, CourseDocument } from './schemas/course.schema';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class StudentService {
  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>
  ) {}

  async getDashboard(studentId: string) {
    const student = await this.studentModel.findById(studentId).lean();
    if (!student) return null;

    const progressRecords = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .lean();

    const totalCourses = progressRecords.length;
    const completedCourses = progressRecords.filter(
      (p) => p.progressPercentage === 100
    ).length;
    const inProgressCourses = progressRecords.filter(
      (p) => p.progressPercentage > 0 && p.progressPercentage < 100
    ).length;
    const totalTimeSpent = progressRecords.reduce(
      (acc, p) => acc + (p.timeSpentMinutes || 0),
      0
    );

    const recentProgress = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ lastAccessedAt: -1 })
      .limit(3)
      .populate('courseId')
      .lean();

    const recentCourses = recentProgress.map((p) => ({
      course: p.courseId,
      progress: p.progressPercentage,
      lastAccessed: p.lastAccessedAt,
    }));

    return {
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        avatar: student.avatar,
        preferences: student.preferences,
      },
      stats: {
        totalCourses,
        completedCourses,
        inProgressCourses,
        totalTimeSpentMinutes: totalTimeSpent,
        totalTimeSpentFormatted: this.formatTime(totalTimeSpent),
      },
      recentCourses,
    };
  }

  async getCoursesWithProgress(studentId: string) {
    const courses = await this.courseModel.find().lean();
    const progressRecords = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .lean();

    const progressMap = new Map(progressRecords.map((p) => [p.courseId.toString(), p]));

    return courses.map((course) => {
      const progress = progressMap.get(course._id.toString());
      return {
        ...course,
        progress: progress
          ? {
              completedLessons: progress.completedLessons,
              progressPercentage: progress.progressPercentage,
              lastAccessedAt: progress.lastAccessedAt,
              timeSpentMinutes: progress.timeSpentMinutes,
            }
          : null,
      };
    });
  }

  async getDetailedStats(studentId: string) {
    const student = await this.studentModel.findById(studentId).lean();
    if (!student) return null;

    const progressRecords = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .populate('courseId')
      .lean();

    const totalTimeSpentMinutes = progressRecords.reduce(
      (acc, progress) => acc + (progress.timeSpentMinutes || 0),
      0
    );
    const completedCourses = progressRecords.filter(
      (progress) => progress.progressPercentage === 100
    ).length;
    const inProgressCourses = progressRecords.filter(
      (progress) =>
        progress.progressPercentage > 0 && progress.progressPercentage < 100
    ).length;

    const studyStreakDays = this.calculateStudyStreak(
      progressRecords
        .map((progress) => progress.lastAccessedAt)
        .filter((value): value is Date => !!value)
    );

    const averageWeeklyProgress =
      progressRecords.length > 0
        ? Math.round(
            progressRecords.reduce(
              (acc, progress) => acc + progress.progressPercentage,
              0
            ) / progressRecords.length
          )
        : 0;

    const timeByCategoryMap = new Map<
      string,
      { category: string; minutes: number; formatted: string }
    >();

    for (const progress of progressRecords) {
      const category = (progress.courseId as any)?.category || 'Sin categoría';
      const current = timeByCategoryMap.get(category) || {
        category,
        minutes: 0,
        formatted: '0m',
      };

      current.minutes += progress.timeSpentMinutes || 0;
      current.formatted = this.formatTime(current.minutes);
      timeByCategoryMap.set(category, current);
    }

    return {
      totalTimeSpentMinutes,
      totalTimeSpentFormatted: this.formatTime(totalTimeSpentMinutes),
      completedCourses,
      inProgressCourses,
      studyStreakDays,
      averageWeeklyProgress,
      timeByCategory: Array.from(timeByCategoryMap.values()).sort(
        (a, b) => b.minutes - a.minutes
      ),
    };
  }

  async updatePreferences(studentId: string, dto: UpdatePreferencesDto) {
    const student = await this.studentModel.findById(studentId);
    if (!student) return null;

    student.preferences = {
      ...(student.preferences || {}),
      ...dto,
    };

    await student.save();

    return {
      id: student._id,
      name: student.name,
      email: student.email,
      avatar: student.avatar,
      preferences: student.preferences,
    };
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }

  async findById(id: string) {
    return this.studentModel.findById(id).lean();
  }

  private calculateStudyStreak(accessDates: Date[]): number {
    if (accessDates.length === 0) {
      return 0;
    }

    const normalizedDays = Array.from(
      new Set(
        accessDates.map((date) => {
          const normalized = new Date(date);
          normalized.setHours(0, 0, 0, 0);
          return normalized.getTime();
        })
      )
    ).sort((a, b) => b - a);

    let streak = 1;

    for (let i = 1; i < normalizedDays.length; i++) {
      const diffInDays =
        (normalizedDays[i - 1] - normalizedDays[i]) / (1000 * 60 * 60 * 24);

      if (diffInDays === 1) {
        streak += 1;
        continue;
      }

      if (diffInDays > 1) {
        break;
      }
    }

    return streak;
  }
}
