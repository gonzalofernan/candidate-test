import styled from 'styled-components';
import { BookOpen } from 'lucide-react';

interface CourseCardProps {
  title: string;
  description: string;
  thumbnail?: string;
  progress?: number;
  category: string;
  totalLessons: number;
  completedLessons?: number;
}

export function CourseCard({
  title,
  description,
  thumbnail,
  progress = 0,
  category,
  totalLessons,
  completedLessons = 0,
}: CourseCardProps) {
  const status = progress === 100 ? 'completed' : progress > 0 ? 'in-progress' : 'not-started';
  const statusLabel =
    status === 'completed'
      ? 'Completado'
      : status === 'in-progress'
        ? 'En progreso'
        : 'No iniciado';

  return (
    <Card role="article" aria-label={`Curso ${title}`}>
      <Thumbnail $url={thumbnail}>
        {!thumbnail && <ThumbnailPlaceholder><BookOpen size={48} /></ThumbnailPlaceholder>}
        <CategoryBadge>{category}</CategoryBadge>
      </Thumbnail>

      <Content>
        <Title>{title}</Title>
        <Description>{description}</Description>

        <ProgressSection>
          <ProgressBar aria-label={`Progreso ${progress}%`}>
            <ProgressFill style={{ width: `${progress}%` }} />
          </ProgressBar>
          <ProgressText>
            {completedLessons}/{totalLessons} lecciones • {progress}% • {statusLabel}
          </ProgressText>
        </ProgressSection>

        <ActionButton $status={status} type="button" aria-label={`${statusLabel}: ${title}`}>
          {status === 'completed' && 'Repasar'}
          {status === 'in-progress' && 'Continuar'}
          {status === 'not-started' && 'Comenzar'}
        </ActionButton>
      </Content>
    </Card>
  );
}

const Card = styled.div`
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  }
`;

const Thumbnail = styled.div<{ $url?: string }>`
  height: 140px;
  background: ${(props) => (props.$url ? `url(${props.$url})` : 'var(--color-background)')};
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ThumbnailPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  opacity: 0.5;
`;

const CategoryBadge = styled.span`
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
`;

const Content = styled.div`
  padding: var(--spacing-md);
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-primary);
`;

const Description = styled.p`
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ProgressSection = styled.div`
  margin-bottom: var(--spacing-md);
`;

const ProgressBar = styled.div`
  height: 6px;
  background: var(--color-background);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--spacing-xs);
`;

const ProgressFill = styled.div`
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`;

const ActionButton = styled.button<{ $status: string }>`
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 14px;
  background: ${(props) =>
    props.$status === 'completed'
      ? 'var(--color-success)'
      : props.$status === 'in-progress'
        ? 'var(--color-primary)'
        : 'var(--color-background)'};
  color: ${(props) => (props.$status === 'not-started' ? 'var(--color-text-primary)' : 'white')};
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`;
