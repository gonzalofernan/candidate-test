import styled from 'styled-components';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeText } from '../utils/text';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isLoading?: boolean;
}

export function ChatMessage({ role, content, timestamp, isLoading }: ChatMessageProps) {
  const normalizedContent = normalizeText(content);

  return (
    <Container $role={role}>
      <Avatar $role={role}>{role === 'user' ? <User size={18} /> : <Bot size={18} />}</Avatar>

      <MessageContent $role={role}>
        {isLoading ? (
          <LoadingIndicator aria-label="El asistente está escribiendo">
            <Dot />
            <Dot />
            <Dot />
          </LoadingIndicator>
        ) : (
          <>
            <MessageText>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedContent}</ReactMarkdown>
            </MessageText>
            {timestamp && <Timestamp>{formatTime(timestamp)}</Timestamp>}
          </>
        )}
      </MessageContent>
    </Container>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Container = styled.div<{ $role: string }>`
  display: flex;
  gap: var(--spacing-sm);
  flex-direction: ${(props) => (props.$role === 'user' ? 'row-reverse' : 'row')};
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
  animation: fadeIn 0.18s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Avatar = styled.div<{ $role: string }>`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: ${(props) =>
    props.$role === 'user' ? 'var(--color-primary)' : 'var(--color-background)'};
  color: ${(props) => (props.$role === 'user' ? 'white' : 'var(--color-text-secondary)')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const MessageContent = styled.div<{ $role: string }>`
  max-width: 70%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  background: ${(props) =>
    props.$role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)'};
  color: ${(props) => (props.$role === 'user' ? 'white' : 'var(--color-text-primary)')};
  border: ${(props) => (props.$role === 'assistant' ? '1px solid var(--color-border)' : 'none')};
`;

const MessageText = styled.div`
  word-break: break-word;
  line-height: 1.6;

  p,
  ul,
  ol,
  pre,
  blockquote,
  table {
    margin: 0;
  }

  p + p,
  p + ul,
  p + ol,
  p + pre,
  ul + p,
  ol + p,
  pre + p,
  blockquote + p,
  p + blockquote,
  p + table,
  table + p {
    margin-top: 10px;
  }

  ul,
  ol {
    padding-left: 20px;
  }

  li + li {
    margin-top: 4px;
  }

  a {
    color: inherit;
    text-decoration: underline;
  }

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.95em;
    padding: 1px 6px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.08);
  }

  pre {
    padding: 12px;
    border-radius: 12px;
    overflow-x: auto;
    background: rgba(15, 23, 42, 0.08);
  }

  pre code {
    padding: 0;
    border-radius: 0;
    background: transparent;
    display: block;
    white-space: pre-wrap;
  }

  blockquote {
    padding-left: 12px;
    border-left: 3px solid rgba(99, 102, 241, 0.35);
    color: color-mix(in srgb, currentColor 78%, #6b7280);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: 8px 10px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: 600;
    background: rgba(148, 163, 184, 0.08);
  }
`;

const Timestamp = styled.div`
  font-size: 11px;
  opacity: 0.7;
  margin-top: var(--spacing-xs);
  text-align: right;
`;

const LoadingIndicator = styled.div`
  display: flex;
  gap: 4px;
  padding: var(--spacing-xs);
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-text-secondary);
  animation: bounce 1s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.12s;
  }

  &:nth-child(3) {
    animation-delay: 0.24s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    40% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }
`;
