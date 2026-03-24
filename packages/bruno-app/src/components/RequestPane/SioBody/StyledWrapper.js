import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;

  .events-container {
    flex: 1;
    display: flex;
    flex-direction: column;

    &.single {
      height: 100%;
    }

    &.multi {
      overflow-y: auto;
      padding-bottom: 48px;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;

    p {
      color: ${(props) => props.theme.colors.text.muted};
      font-size: 13px;
    }
  }

  .add-event-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background: ${(props) => props.theme.bg};
  }

  .event-container {
    display: flex;
    flex-direction: column;
    min-height: 240px;
    margin-bottom: 8px;

    &.last {
      margin-bottom: 0;
    }

    &.single {
      height: 100%;
      min-height: unset;

      .editor-container {
        height: calc(100% - 64px);
      }
    }
  }

  .event-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 4px 0px;
    height: 32px;
    flex-shrink: 0;

    .event-name-input {
      flex: 1;
      background: transparent;
      border: 1px solid ${(props) => props.theme.input.border};
      border-radius: 3px;
      padding: 2px 6px;
      font-size: ${(props) => props.theme.font.size.sm};
      color: ${(props) => props.theme.text};
      outline: none;

      &::placeholder {
        color: ${(props) => props.theme.colors.text.muted};
      }

      &:focus {
        border-color: ${(props) => props.theme.input.focusBorder};
      }
    }

    .event-label {
      font-size: ${(props) => props.theme.font.size.sm};
      color: ${(props) => props.theme.colors.text.subtext1};
      margin-right: 4px;
      white-space: nowrap;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .toolbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      color: ${(props) => props.theme.colors.text.muted};
      transition: all 0.15s ease;

      &:hover {
        background-color: ${(props) => props.theme.dropdown.hoverBg};
        color: ${(props) => props.theme.text};
      }

      &.delete:hover {
        color: ${(props) => props.theme.colors.text.danger};
      }
    }
  }

  .editor-container {
    flex: 1;
    min-height: 0;
  }
`;

export default StyledWrapper;
