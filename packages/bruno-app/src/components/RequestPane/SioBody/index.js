import { IconPlus, IconTrash, IconWand, IconCaretDown } from '@tabler/icons';
import CodeEditor from 'components/CodeEditor/index';
import ToolHint from 'components/ToolHint/index';
import Dropdown from 'components/Dropdown';
import { get } from 'lodash';
import { updateRequestBody } from 'providers/ReduxStore/slices/collections';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { useTheme } from 'providers/Theme';
import React, { forwardRef, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toastError } from 'utils/common/error';
import { prettifyJsonString } from 'utils/common/index';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const TYPE_MODES = [
  { label: 'JSON', key: 'json' },
  { label: 'Text', key: 'text' }
];

const CODEMIRROR_MODE = {
  json: 'application/ld+json',
  text: 'application/text'
};

const SingleSioEvent = ({ event, item, collection, index, handleRun, isLast, isSingle }) => {
  const dispatch = useDispatch();
  const { displayedTheme } = useTheme();
  const preferences = useSelector((state) => state.app.preferences);
  const dropdownTippyRef = useRef();
  const onDropdownCreate = (ref) => (dropdownTippyRef.current = ref);

  const body = item.draft ? get(item, 'draft.request.body') : get(item, 'request.body');
  const eventName = event.eventName || event.name || event.event || '';
  const { content, type = 'json' } = event;

  const getEvents = () => [...(body.socketio || [])];

  const onUpdateEventName = (value) => {
    const events = getEvents();
    events[index] = { ...events[index], eventName: value, name: value };
    dispatch(updateRequestBody({ content: events, itemUid: item.uid, collectionUid: collection.uid }));
  };

  const onUpdateType = (newType) => {
    const events = getEvents();
    events[index] = { ...events[index], type: newType };
    dispatch(updateRequestBody({ content: events, itemUid: item.uid, collectionUid: collection.uid }));
  };

  const onEdit = (value) => {
    const events = getEvents();
    const name = eventName || `event_${index + 1}`;
    events[index] = { eventName: name, name, type, content: value };
    dispatch(updateRequestBody({ content: events, itemUid: item.uid, collectionUid: collection.uid }));
  };

  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));

  const onDeleteEvent = () => {
    const events = getEvents();
    events.splice(index, 1);
    dispatch(updateRequestBody({ content: events, itemUid: item.uid, collectionUid: collection.uid }));
  };

  const onPrettify = () => {
    if (type === 'json') {
      try {
        const prettyContent = prettifyJsonString(content);
        const events = getEvents();
        events[index] = { ...events[index], content: prettyContent };
        dispatch(updateRequestBody({ content: events, itemUid: item.uid, collectionUid: collection.uid }));
      } catch (e) {
        toastError(new Error('Unable to prettify. Invalid JSON format.'));
      }
    }
  };

  const TypeIcon = forwardRef((props, ref) => (
    <div ref={ref} className="flex items-center justify-center pl-3 py-1 select-none" style={{ fontSize: 'inherit' }}>
      {type === 'json' ? 'JSON' : 'Text'}
      <IconCaretDown className="ml-1" size={12} strokeWidth={2} style={{ color: 'inherit' }} />
    </div>
  ));

  return (
    <div className={`event-container ${isSingle ? 'single' : ''} ${isLast ? 'last' : ''}`}>
      <div className="event-toolbar">
        <div className="event-name">
          <input
            type="text"
            className="event-name-input"
            placeholder="event name"
            value={eventName || ''}
            onChange={(e) => onUpdateEventName(e.target.value)}
            size={Math.max(10, (eventName || '').length + 2)}
          />
        </div>
        <div className="toolbar-actions">
          <Dropdown onCreate={onDropdownCreate} icon={<TypeIcon />} placement="bottom-end">
            {TYPE_MODES.map((m) => (
              <div
                className="dropdown-item"
                key={m.key}
                onClick={() => {
                  dropdownTippyRef.current.hide();
                  onUpdateType(m.key);
                }}
              >
                {m.label}
              </div>
            ))}
          </Dropdown>

          <ToolHint text="Format" toolhintId={`sio-prettify-${index}`}>
            <button onClick={onPrettify} className="toolbar-btn" disabled={type !== 'json'}>
              <IconWand size={16} strokeWidth={1.5} />
            </button>
          </ToolHint>

          {index > 0 && (
            <ToolHint text="Delete event" toolhintId={`sio-delete-${index}`}>
              <button onClick={onDeleteEvent} className="toolbar-btn delete">
                <IconTrash size={16} strokeWidth={1.5} />
              </button>
            </ToolHint>
          )}
        </div>
      </div>
      <div className="editor-container">
        <CodeEditor
          collection={collection}
          theme={displayedTheme}
          font={get(preferences, 'font.codeFont', 'default')}
          fontSize={get(preferences, 'font.codeFontSize')}
          value={content || ''}
          onEdit={onEdit}
          onRun={handleRun}
          onSave={onSave}
          mode={CODEMIRROR_MODE[type] ?? 'text/plain'}
          enableVariableHighlighting={true}
        />
      </div>
    </div>
  );
};

const SioBody = ({ item, collection, handleRun }) => {
  const dispatch = useDispatch();
  const body = item.draft ? get(item, 'draft.request.body') : get(item, 'request.body');
  const canClientSendMultipleMessages = false;

  const addNewEvent = () => {
    const currentEvents = Array.isArray(body?.socketio) ? [...body.socketio] : [];
    currentEvents.push({
      eventName: '',
      type: 'json',
      content: '{}'
    });
    dispatch(updateRequestBody({
      content: currentEvents,
      itemUid: item.uid,
      collectionUid: collection.uid
    }));
  };

  if (!body?.socketio || !Array.isArray(body.socketio)) {
    return (
      <StyledWrapper>
        <div className="empty-state">
          <p>No Socket.IO events configured</p>
          <Button
            onClick={addNewEvent}
            variant="filled"
            color="secondary"
            size="sm"
            icon={<IconPlus size={14} strokeWidth={1.5} />}
          >
            Add Event
          </Button>
        </div>
      </StyledWrapper>
    );
  }

  const eventsToShow = body.socketio.filter((_, index) => canClientSendMultipleMessages || index === 0);

  return (
    <StyledWrapper>
      <div className={`events-container ${canClientSendMultipleMessages && eventsToShow.length > 1 ? 'multi' : 'single'}`}>
        {eventsToShow.map((event, index) => (
          <SingleSioEvent
            key={index}
            event={event}
            item={item}
            collection={collection}
            index={index}
            handleRun={handleRun}
            isSingle={!canClientSendMultipleMessages || eventsToShow.length === 1}
            isLast={index === eventsToShow.length - 1}
          />
        ))}
      </div>

      {canClientSendMultipleMessages && (
        <div className="add-event-footer">
          <Button
            onClick={addNewEvent}
            variant="filled"
            color="secondary"
            size="sm"
            fullWidth
            icon={<IconPlus size={14} strokeWidth={1.5} />}
          >
            Add Event
          </Button>
        </div>
      )}
    </StyledWrapper>
  );
};

export default SioBody;
