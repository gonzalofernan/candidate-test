import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import styled from 'styled-components';
import { Loader2, SendHorizonal } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe tu mensaje...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 1000;

  useEffect(() => {
    const element = textAreaRef.current;
    if (!element) {
      return;
    }

    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }, [message]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) {
      return;
    }

    onSend(trimmed);
    setMessage('');
  };

  return (
    <Container>
      <InputWrapper>
        <TextArea
          ref={textAreaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          maxLength={maxLength}
          aria-label="Mensaje del chat"
        />
        <CharacterCount $limitReached={message.length >= maxLength}>
          {message.length}/{maxLength}
        </CharacterCount>
      </InputWrapper>

      <SendButton
        type="button"
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        aria-label={disabled ? 'Enviando mensaje' : 'Enviar mensaje'}
      >
        {disabled ? <Loader2 size={18} /> : <SendHorizonal size={18} />}
      </SendButton>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
`;

const InputWrapper = styled.div`
  flex: 1;
  position: relative;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md) 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
  min-height: 44px;
  max-height: 120px;

  &:focus {
    border-color: var(--color-primary);
  }

  &:disabled {
    background: var(--color-background);
    cursor: not-allowed;
  }
`;

const CharacterCount = styled.span<{ $limitReached: boolean }>`
  position: absolute;
  right: 12px;
  bottom: 8px;
  font-size: 11px;
  color: ${(props) =>
    props.$limitReached ? 'var(--color-error)' : 'var(--color-text-secondary)'};
`;

const SendButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  border: none;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  svg {
    flex-shrink: 0;
  }

  svg[data-lucide='loader-2'] {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  &:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  &:disabled {
    background: var(--color-border);
    cursor: not-allowed;
  }
`;
