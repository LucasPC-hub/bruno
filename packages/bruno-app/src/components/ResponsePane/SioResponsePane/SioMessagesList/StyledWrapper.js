import styled from 'styled-components';

const StyledWrapper = styled.div`
  flex: 1;
  min-height: 0;
  height: 100%;

  .empty-state {
    padding: 1rem;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .sio-message {
    background: ${(props) => props.theme.bg};
    transition: background-color 0.3s ease;

    &.new {
      animation: flash-new 0.6s ease-out;
    }

    &:not(:last-child) {
      border-bottom: 1px solid ${({ theme }) => theme.border.border1};
    }

    &:not(:last-child).open {
      border-bottom-width: 0px;
    }

    .message-content {
      color: ${(props) => props.theme.text};
      font-size: ${(props) => props.theme.font.size.sm};
    }

    .message-timestamp {
      font-size: ${(props) => props.theme.font.size.xs};
      color: ${(props) => props.theme.colors.text.muted};
      font-variant-numeric: tabular-nums;
    }

    .chevron-icon {
      color: ${(props) => props.theme.colors.text.muted};
    }

    .event-badge {
      font-size: ${(props) => props.theme.font.size.xs};
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .direction-label {
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.7;
    }
  }

  @keyframes flash-new {
    0% {
      background-color: ${({ theme }) => theme.table.striped};
    }
    100% {
      background-color: transparent;
    }
  }

  .sio-incoming .message-type-icon {
    color: ${(props) => props.theme.colors.text.green};
  }

  .sio-incoming .event-badge {
    background-color: ${(props) => props.theme.colors.text.green}22;
    color: ${(props) => props.theme.colors.text.green};
    border: 1px solid ${(props) => props.theme.colors.text.green}44;
  }

  .sio-outgoing .message-type-icon {
    color: ${(props) => props.theme.colors.text.yellow};
  }

  .sio-outgoing .event-badge {
    background-color: ${(props) => props.theme.colors.text.yellow}22;
    color: ${(props) => props.theme.colors.text.yellow};
    border: 1px solid ${(props) => props.theme.colors.text.yellow}44;
  }

  .sio-info .message-type-icon {
    color: ${(props) => props.theme.colors.text.blue};
  }

  .sio-error .message-type-icon {
    color: ${(props) => props.theme.colors.text.danger};
  }

  .CodeMirror {
    border-radius: 0.25rem;
  }

  .CodeMirror-foldgutter, .CodeMirror-linenumbers, .CodeMirror-lint-markers {
    background: ${({ theme }) => theme.bg};
  }

  div[role='tablist'] {
    color: ${(props) => props.theme.colors.text.muted};

    .active {
      color: ${(props) => props.theme.colors.text.yellow};
    }
  }
`;

export default StyledWrapper;
