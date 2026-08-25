import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getDashboard: vi.fn(),
    getCourses: vi.fn(),
  },
}));

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

const mockCourses = [
  {
    _id: '1',
    title: 'React desde Cero',
    description: 'Aprende React',
    category: 'Frontend',
    totalLessons: 20,
    progress: { progressPercentage: 70, completedLessons: 14 },
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(api.getDashboard).mockResolvedValue(mockDashboard);
    vi.mocked(api.getCourses).mockResolvedValue(mockCourses);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render student greeting', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByText(/Asistente|Cursos Activos/i)).toBeInTheDocument();
    expect(screen.getByText(/Hola/i)).toBeInTheDocument();
  });

  it('should render stats cards', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(screen.getByText('Cursos Activos')).toBeInTheDocument();
      expect(screen.getByText('Cursos Completados')).toBeInTheDocument();
      expect(screen.getByText('Tiempo de Estudio')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(api.getDashboard).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<Dashboard studentId="test" />);

    expect(screen.getByLabelText('Cargando dashboard')).toBeInTheDocument();
  });

  it('should show error state when API fails', async () => {
    vi.mocked(api.getDashboard).mockRejectedValue(new Error('fallo'));

    renderWithProviders(<Dashboard studentId="test" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error al cargar el dashboard');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('should render course cards', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(
      await screen.findByRole('article', { name: 'Curso React desde Cero' })
    ).toBeInTheDocument();
    expect(screen.getByText(/14\/20 lecciones/i)).toBeInTheDocument();
  });

  it('should show empty state when no courses', async () => {
    vi.mocked(api.getCourses).mockResolvedValue([]);

    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByText(/No tienes cursos/i)).toBeInTheDocument();
  });

  it('should render activity chart placeholder', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByLabelText('Actividad semanal')).toBeInTheDocument();
    expect(screen.getByText(/Distribución estimada/i)).toBeInTheDocument();
  });

  it('should be accessible', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByRole('heading', { name: /Hola/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver todos/i })).toBeInTheDocument();
  });
});
