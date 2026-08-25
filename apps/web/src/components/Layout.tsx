import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, LayoutDashboard, MessageSquare, User } from 'lucide-react';
import { api } from '../services/api';

interface LayoutProps {
  children: ReactNode;
  studentId: string;
}

/**
 * ✅ IMPLEMENTADO - Layout principal de la aplicación
 */
export function Layout({ children, studentId }: LayoutProps) {
  const location = useLocation();

  const { data: student } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const dashboard = await api.getDashboard(studentId);
      return dashboard.student;
    },
  });

  return (
    <Container>
      <Sidebar>
        <Logo>
          <LogoIcon><BookOpen size={28} /></LogoIcon>
          <LogoText>StudyHub</LogoText>
        </Logo>

        <Nav>
          <NavItem to="/dashboard" $active={location.pathname === '/dashboard'}>
            <NavIcon><LayoutDashboard size={18} /></NavIcon>
            Dashboard
          </NavItem>
          <NavItem to="/chat" $active={location.pathname === '/chat'}>
            <NavIcon><MessageSquare size={18} /></NavIcon>
            Chat IA
          </NavItem>
        </Nav>

        <UserSection>
          <Avatar><User size={20} /></Avatar>
          <UserInfo>
            <UserName>{student?.name || 'Cargando...'}</UserName>
            <UserEmail>{student?.email || ''}</UserEmail>
          </UserInfo>
        </UserSection>
      </Sidebar>

      <Main>{children}</Main>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  min-height: 100vh;
`;

const Sidebar = styled.aside`
  width: 260px;
  height: 100vh;
  position: sticky;
  top: 0;
  left: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
  flex-shrink: 0;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
`;

const LogoIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
`;

const LogoText = styled.span`
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
`;

const Nav = styled.nav`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
`;

const NavItem = styled(Link)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-secondary)')};
  background: ${(props) => (props.$active ? 'rgba(99, 102, 241, 0.1)' : 'transparent')};
  font-weight: ${(props) => (props.$active ? '600' : '400')};
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.1);
    color: var(--color-primary);
    text-decoration: none;
  }
`;

const NavIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: auto;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  flex-shrink: 0;
`;

const UserInfo = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  font-weight: 600;
  font-size: 14px;
`;

const UserEmail = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`;

const Main = styled.main`
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
`;
