import { render, screen } from '@testing-library/react';
import { BookOpen, Clock } from 'lucide-react';
import { StatsCard } from './StatsCard';

describe('StatsCard', () => {
  it('should render title and value', () => {
    render(<StatsCard title="Total Cursos" value={5} icon={<BookOpen data-testid="icon" />} />);

    expect(screen.getByText('Total Cursos')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should render string value correctly', () => {
    render(<StatsCard title="Tiempo" value="9h 25m" icon={<Clock />} />);

    expect(screen.getByText('9h 25m')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(
      <StatsCard title="Tiempo" value="9h 25m" icon={<Clock />} subtitle="Total acumulado" />
    );

    expect(screen.getByText('Total acumulado')).toBeInTheDocument();
  });

  it('should apply custom color to icon wrapper', () => {
    render(
      <StatsCard
        title="Cursos"
        value={2}
        icon={<BookOpen data-testid="icon" />}
        color="#ff6600"
      />
    );

    const icon = screen.getByTestId('icon');
    expect(icon.parentElement).toHaveStyle({ color: 'rgb(255, 102, 0)' });
  });

  it('should handle zero value', () => {
    render(<StatsCard title="Cursos completados" value={0} icon={<BookOpen />} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should be accessible', () => {
    render(<StatsCard title="Cursos Activos" value={2} icon={<BookOpen />} />);

    expect(screen.getByRole('article', { name: 'Cursos Activos' })).toBeInTheDocument();
  });
});
