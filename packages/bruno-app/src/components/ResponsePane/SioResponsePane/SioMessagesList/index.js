import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import classnames from 'classnames';
import StyledWrapper from './StyledWrapper';
import { IconExclamationCircle, IconChevronRight, IconInfoCircle, IconChevronDown, IconArrowUpRight, IconArrowDownLeft } from '@tabler/icons';
import CodeEditor from 'components/CodeEditor/index';
import { useTheme } from 'providers/Theme';
import { useSelector } from 'react-redux';
import { Virtuoso } from 'react-virtuoso';

const getContentMeta = (content) => {
  if (content === undefined || content === null) {
    return { isJSON: false, content: '' };
  }
  if (typeof content === 'object') {
    return {
      isJSON: true,
      content: JSON.stringify(content, null, 0)
    };
  }
  try {
    return {
      isJSON: true,
      content: JSON.stringify(JSON.parse(content), null, 0)
    };
  } catch {
    return {
      isJSON: false,
      content: String(content)
    };
  }
};

const parseContent = (content) => {
  let contentMeta = getContentMeta(content);
  return {
    type: contentMeta.isJSON ? 'application/json' : 'text/plain',
    content: contentMeta.isJSON ? JSON.stringify(JSON.parse(contentMeta.content), null, 2) : contentMeta.content
  };
};

const getDataTypeText = (type) => {
  const textMap = {
    'text/plain': 'RAW',
    'application/json': 'JSON'
  };
  return textMap[type] ?? 'RAW';
};

/**
 * @param {"incoming"|"outgoing"|"info"|"error"} type
 */
const TypeIcon = ({ type }) => {
  const commonProps = { size: 18 };
  return {
    incoming: <IconArrowDownLeft {...commonProps} />,
    outgoing: <IconArrowUpRight {...commonProps} />,
    info: <IconInfoCircle {...commonProps} />,
    error: <IconExclamationCircle {...commonProps} />
  }[type];
};

const SioMessageItem = memo(({ message, isOpen, onToggle }) => {
  const [showHex, setShowHex] = useState(false);
  const preferences = useSelector((state) => state.app.preferences);
  const { displayedTheme } = useTheme();
  const [isNew, setIsNew] = useState(false);
  const notified = useRef(false);

  const isIncoming = message.type === 'incoming';
  const isInfo = message.type === 'info';
  const isError = message.type === 'error';
  const isOutgoing = message.type === 'outgoing';

  // Socket.IO messages have an event name and payload
  const eventName = message.event || null;
  const payload = message.payload !== undefined ? message.payload : message.message;
  let parsedContent = parseContent(payload);
  const dataType = getDataTypeText(parsedContent.type);

  useEffect(() => {
    if (notified.current === true) return;
    const dateDiff = Date.now() - new Date(message.timestamp).getTime();
    if (dateDiff < 1000 * 10) {
      setIsNew(true);
      const timer = setTimeout(() => {
        notified.current = true;
        setIsNew(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [message.timestamp]);

  const canOpenMessage = !isInfo && !isError && parsedContent.content;

  const handleToggle = () => {
    if (!canOpenMessage) return;
    onToggle?.(message.timestamp);
  };

  return (
    <div
      className={classnames('sio-message flex flex-col p-2', {
        'sio-incoming': isIncoming,
        'sio-outgoing': isOutgoing,
        'sio-info': isInfo,
        'sio-error': isError,
        'open': isOpen,
        'new': isNew
      })}
    >
      <div
        className={classnames('flex items-center justify-between', {
          'cursor-pointer': canOpenMessage,
          'cursor-not-allowed': !canOpenMessage
        })}
        onClick={handleToggle}
      >
        <div className="flex min-w-0 shrink items-center gap-2">
          <span className="message-type-icon flex-shrink-0">
            <TypeIcon type={message.type} />
          </span>
          {eventName && (
            <span className="event-badge">
              {eventName}
            </span>
          )}
          <span className="text-ellipsis max-w-full overflow-hidden text-nowrap message-content">
            {parsedContent.content}
          </span>
        </div>
        <div className="flex shrink-0 gap-2 items-center">
          {message.timestamp && (
            <span className="message-timestamp">{new Date(message.timestamp).toISOString()}</span>
          )}
          {canOpenMessage
            ? (
                <span className="chevron-icon">
                  {isOpen ? (
                    <IconChevronDown size={16} strokeWidth={1.5} />
                  ) : (
                    <IconChevronRight size={16} strokeWidth={1.5} />
                  )}
                </span>
              )
            : <span className="w-4"></span>}
        </div>
      </div>
      {isOpen && (
        <>
          <div className="mt-2 flex justify-end gap-2 text-xs sio-message-toolbar" role="tablist">
            <div
              className={classnames('select-none capitalize', {
                'active': !showHex,
                'cursor-pointer': showHex
              })}
              role="tab"
              onClick={() => setShowHex(false)}
            >
              {dataType.toLowerCase()}
            </div>
          </div>
          <div className="mt-1 h-[300px] w-full">
            <CodeEditor
              mode={parsedContent.type}
              theme={displayedTheme}
              enableLineWrapping={true}
              font={preferences.codeFont || 'default'}
              value={parsedContent.content}
            />
          </div>
        </>
      )}
    </div>
  );
});

const SioMessagesList = ({ messages = [] }) => {
  const virtuosoRef = useRef(null);
  const [scrollerElement, setScrollerElement] = useState(null);
  const [openMessages, setOpenMessages] = useState(new Set());
  const userScrolledAwayRef = useRef(false);

  const handleMessageToggle = useCallback((timestamp) => {
    setOpenMessages((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!scrollerElement) return;

    const handleWheel = (e) => {
      if (e.deltaY < 0) {
        userScrolledAwayRef.current = true;
      }
    };

    scrollerElement.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      scrollerElement.removeEventListener('wheel', handleWheel);
    };
  }, [scrollerElement]);

  const handleAtBottomStateChange = useCallback((atBottom) => {
    if (atBottom) {
      userScrolledAwayRef.current = false;
    }
  }, []);

  const followOutput = useCallback((isAtBottom) => {
    if (userScrolledAwayRef.current || openMessages.size > 0) {
      return false;
    }
    if (isAtBottom) {
      return 'smooth';
    }
    return false;
  }, [openMessages.size]);

  const renderItem = useCallback((_, msg) => {
    const isOpen = openMessages.has(msg.timestamp);
    return <SioMessageItem message={msg} isOpen={isOpen} onToggle={handleMessageToggle} />;
  }, [openMessages, handleMessageToggle]);

  const computeItemKey = useCallback((_, msg) => {
    return msg.seq ?? msg.timestamp;
  }, []);

  if (!messages.length) {
    return <StyledWrapper><div className="empty-state">No events yet.</div></StyledWrapper>;
  }

  return (
    <StyledWrapper className="sio-messages-list flex flex-col">
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={setScrollerElement}
        data={messages}
        itemContent={renderItem}
        computeItemKey={computeItemKey}
        followOutput={followOutput}
        initialTopMostItemIndex={messages.length - 1}
        atBottomStateChange={handleAtBottomStateChange}
      />
    </StyledWrapper>
  );
};

export default SioMessagesList;
