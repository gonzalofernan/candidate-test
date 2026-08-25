import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
import { BookOpen, CheckCircle, Clock, Target, BarChart3 } from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import { CourseCard } from '../components/CourseCard';
import { api } from '../services/api';

interface DashboardProps {
  studentId: string;
}

export function Dashboard({ studentId }: DashboardProps) {
  const {
    data: dashboard,
    isLoading,
    error,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['dashboard', studentId],
    queryFn: () => api.getDashboard(studentId),
  });

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', studentId],
    queryFn: () => api.getCourses(studentId),
  });

  if (isLoading || isLoadingCourses) {
    return (
      <LoadingState aria-label="Cargando dashboard">
        <SkeletonGrid>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </SkeletonGrid>
      </LoadingState>
    );
  }

  if (error) {
    return (
      <ErrorPanel role="alert">
        <strong>Error al cargar el dashboard</strong>
        <RetryButton type="button" onClick={() => void refetchDashboard()}>
          Reintentar
        </RetryButton>
      </ErrorPanel>
    );
  }

  if (!dashboard) {
    return <ErrorPanel>No se encontraron datos</ErrorPanel>;
  }

  return (
    <Container>
      <Header>
        <Greeting>
          <h1>¡Hola, {dashboard.student.name}!</h1>
          <Subtitle>Aquí está tu progreso de hoy</Subtitle>
        </Greeting>
      </Header>

      <StatsGrid>
        <StatsCard
          title="Cursos Activos"
          value={dashboard.stats.inProgressCourses}
          icon={<BookOpen size={24} />}
          color="var(--color-primary)"
        />
        <StatsCard
          title="Cursos Completados"
          value={dashboard.stats.completedCourses}
          icon={<CheckCircle size={24} />}
          color="var(--color-success)"
        />
        <StatsCard
          title="Tiempo de Estudio"
          value={dashboard.stats.totalTimeSpentFormatted}
          icon={<Clock size={24} />}
          color="var(--color-secondary)"
          subtitle="Total acumulado"
        />
        <StatsCard
          title="Total Cursos"
          value={dashboard.stats.totalCourses}
          icon={<Target size={24} />}
          color="var(--color-primary)"
        />
      </StatsGrid>

      <Section>
        <SectionTitle>Actividad Semanal</SectionTitle>
        <ActivityChartPlaceholder aria-label="Actividad semanal">
          <ChartBars>
            {buildWeeklyActivity(dashboard.stats.totalTimeSpentMinutes).map((day) => (
              <ChartBarItem key={day.day}>
                <ChartBar
                  title={`${day.day}: ${day.hours.toFixed(1)} horas`}
                  style={{ height: `${Math.max(day.hours * 18, 16)}px` }}
                />
                <ChartDay>{day.day}</ChartDay>
              </ChartBarItem>
            ))}
          </ChartBars>
          <PlaceholderText>
            <PlaceholderIcon>
              <BarChart3 size={18} />
            </PlaceholderIcon>
            Distribución estimada de las últimas 7 jornadas
          </PlaceholderText>
        </ActivityChartPlaceholder>
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>Continúa donde lo dejaste</SectionTitle>
          <ViewAllLink href="/courses">Ver todos →</ViewAllLink>
        </SectionHeader>

        <CoursesGrid>
          {courses.slice(0, 4).map((course: any) => (
            <CourseCard
              key={course._id}
              title={course.title}
              description={course.description}
              thumbnail={course.thumbnail}
              progress={course.progress?.progressPercentage || 0}
              category={course.category}
              totalLessons={course.totalLessons}
              completedLessons={course.progress?.completedLessons || 0}
            />
          ))}
        </CoursesGrid>

        {courses.length === 0 && (
          <EmptyState>No tienes cursos todavía. Explora el catálogo para empezar.</EmptyState>
        )}
      </Section>
    </Container>
  );
}

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.header`
  margin-bottom: var(--spacing-xl);
`;

const Greeting = styled.div`
  h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: var(--spacing-xs);
  }
`;

const Subtitle = styled.p`
  color: var(--color-text-secondary);
  font-size: 16px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
`;

const Section = styled.section`
  margin-bottom: var(--spacing-xl);
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
`;

const ViewAllLink = styled.a`
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
`;

const ActivityChartPlaceholder = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-height: 200px;
  padding: var(--spacing-lg);
  display: grid;
  gap: var(--spacing-md);
`;

const PlaceholderText = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  color: var(--color-text-secondary);
  font-size: 14px;
`;

const PlaceholderIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--color-primary) 45%, var(--color-text-secondary));
  flex-shrink: 0;
`;

const ChartBars = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  align-items: end;
  gap: 12px;
  min-height: 120px;
`;

const ChartBarItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const ChartBar = styled.div`
  width: 100%;
  max-width: 48px;
  border-radius: 10px 10px 4px 4px;
  background: linear-gradient(180deg, var(--color-primary), #8ea1ff);
`;

const ChartDay = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`;

const CoursesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
`;

const LoadingState = styled.div`
  min-height: 400px;
`;

const ErrorPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--color-error);
`;

const RetryButton = styled.button`
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
`;

const SkeletonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
`;

const SkeletonCard = styled.div`
  height: 112px;
  border-radius: var(--radius-lg);
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.12),
    rgba(148, 163, 184, 0.24),
    rgba(148, 163, 184, 0.12)
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite linear;

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--color-border);
`;

function buildWeeklyActivity(totalTimeSpentMinutes: number) {
  const totalHours = Math.max(totalTimeSpentMinutes / 60, 1);
  const weights = [0.12, 0.08, 0.14, 0.16, 0.18, 0.14, 0.18];
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return days.map((day, index) => ({
    day,
    hours: Number((totalHours * weights[index]).toFixed(1)),
  }));
}
