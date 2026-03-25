import { IconArrowRight, IconDeviceFloppy, IconPlugConnected, IconPlugConnectedX } from '@tabler/icons';
import classnames from 'classnames';
import SingleLineEditor from 'components/SingleLineEditor/index';
import { requestUrlChanged, socketioNamespaceChanged } from 'providers/ReduxStore/slices/collections';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { useTheme } from 'providers/Theme';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { isMacOS } from 'utils/common/platform';
import { findEnvironmentInCollection } from 'utils/collections';
import { hasRequestChanges } from 'utils/collections';
import { getAllVariables } from 'utils/collections';
import { interpolateUrl } from 'utils/url';
import useDebounce from 'hooks/useDebounce';
import get from 'lodash/get';
import StyledWrapper from './StyledWrapper';

const CONNECTION_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected'
};

const useSioConnectionStatus = (item) => {
  const connectionStatus = item?.sioResponse?.connectionStatus ?? CONNECTION_STATUS.DISCONNECTED;
  return connectionStatus;
};

const SioQueryUrl = ({ item, collection, handleRun }) => {
  const dispatch = useDispatch();
  const { theme, displayedTheme } = useTheme();
  const saveShortcut = isMacOS() ? '⌘S' : 'Ctrl+S';
  const hasChanges = useMemo(() => hasRequestChanges(item), [item]);

  const connectionStatus = useSioConnectionStatus(item);
  const url = item.draft ? get(item, 'draft.request.url', '') : get(item, 'request.url', '');
  const namespace = item.draft
    ? get(item, 'draft.request.socketio.namespace', '')
    : get(item, 'request.socketio.namespace', '');

  const [namespaceValue, setNamespaceValue] = useState(namespace || '');

  const allVariables = useMemo(() => {
    return getAllVariables(collection, item);
  }, [collection, item]);

  const interpolatedURL = useMemo(() => {
    if (!url) return '';
    return interpolateUrl({ url, variables: allVariables }) || '';
  }, [url, allVariables]);

  const debouncedInterpolatedURL = useDebounce(interpolatedURL, 400);
  const previousDebouncedInterpolatedURL = useRef(debouncedInterpolatedURL);

  const handleConnect = async () => {
    const { ipcRenderer } = window;
    if (!ipcRenderer) {
      toast.error('IPC renderer not available');
      return;
    }

    const activeEnvironmentUid = collection.activeEnvironmentUid;
    const environment = activeEnvironmentUid ? findEnvironmentInCollection(collection, activeEnvironmentUid) : {};
    const runtimeVariables = collection.runtimeVariables || {};

    try {
      await ipcRenderer.invoke('renderer:sio:start-connection', {
        request: item.draft ? item.draft : item,
        collection,
        environment: environment || {},
        runtimeVariables,
        settings: {},
        options: { connectOnly: true }
      });
      previousDebouncedInterpolatedURL.current = debouncedInterpolatedURL;
    } catch (err) {
      console.error('Failed to connect Socket.IO:', err);
      toast.error('Failed to connect: ' + (err.message || err));
    }
  };

  const handleDisconnect = async (e, notify) => {
    e && e.stopPropagation();
    const { ipcRenderer } = window;
    if (!ipcRenderer) return;

    try {
      await ipcRenderer.invoke('renderer:sio:disconnect', item.uid);
      if (notify) toast.success('Socket.IO connection closed');
    } catch (err) {
      console.error('Failed to close Socket.IO connection:', err);
      if (notify) toast.error('Failed to close Socket.IO connection');
    }
  };

  const handleReconnect = async (e) => {
    e && e.stopPropagation();
    try {
      await handleDisconnect(e, false);
      setTimeout(() => {
        handleConnect();
      }, 2000);
    } catch (err) {
      console.error('Failed to reconnect Socket.IO connection', err);
    }
  };

  const handleRunClick = async (e) => {
    e.stopPropagation();
    if (!url) {
      toast.error('Please enter a valid Socket.IO URL');
      return;
    }

    const { ipcRenderer } = window;
    if (!ipcRenderer) return;

    // If not connected, connect first
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      await handleConnect();
      return;
    }

    // Emit all events from the body
    const body = item.draft ? get(item, 'draft.request.body') : get(item, 'request.body');
    const events = body?.socketio || [];

    for (const evt of events) {
      const eventName = evt.eventName || evt.name || evt.event;
      if (!eventName) continue;
      try {
        await ipcRenderer.invoke('renderer:sio:emit-event', item.uid, eventName, evt.content || '');
      } catch (err) {
        console.error('Failed to emit Socket.IO event:', err);
        toast.error(`Failed to emit event "${eventName}"`);
      }
    }
  };

  const onSave = () => {
    dispatch(saveRequest(item.uid, collection.uid));
  };

  const handleUrlChange = (value) => {
    const finalUrl = value?.trim() ?? value;
    dispatch(requestUrlChanged({
      itemUid: item.uid,
      collectionUid: collection.uid,
      url: finalUrl
    }));
  };

  // Reconnect on URL change if already connected
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    if (previousDebouncedInterpolatedURL.current === debouncedInterpolatedURL) return;
    if (debouncedInterpolatedURL === '') return;
    handleReconnect();
  }, [debouncedInterpolatedURL, connectionStatus]);

  return (
    <StyledWrapper>
      <div className="flex items-center h-full url-row">
        <div className="flex items-center input-container flex-1 w-full h-full relative">
          <div className="flex items-center justify-center px-[10px]">
            <span className="text-xs font-medium method-sio">SIO</span>
          </div>
          <SingleLineEditor
            value={url}
            onSave={onSave}
            onChange={handleUrlChange}
            placeholder="http://localhost:3000 or https://example.com"
            className="w-full"
            theme={displayedTheme}
            onRun={handleRun}
            collection={collection}
            item={item}
          />
          <div className="flex items-center h-full cursor-pointer gap-3 mx-3">
            <div
              className="infotip"
              onClick={(e) => {
                e.stopPropagation();
                if (!hasChanges) return;
                onSave();
              }}
            >
              <IconDeviceFloppy
                color={hasChanges ? theme.draftColor : theme.requestTabs.icon.color}
                strokeWidth={1.5}
                size={20}
                className={`${hasChanges ? 'cursor-pointer' : 'cursor-default'}`}
              />
              <span className="infotip-text text-xs">
                Save <span className="shortcut">({saveShortcut})</span>
              </span>
            </div>

            {connectionStatus === CONNECTION_STATUS.CONNECTED && (
              <div className="connection-controls relative flex items-center h-full">
                <div className="infotip" onClick={(e) => handleDisconnect(e, true)}>
                  <IconPlugConnectedX
                    color={theme.colors.text.danger}
                    strokeWidth={1.5}
                    size={20}
                    className="cursor-pointer"
                  />
                  <span className="infotip-text text-xs">Close Connection</span>
                </div>
              </div>
            )}

            {connectionStatus !== CONNECTION_STATUS.CONNECTED && (
              <div className="connection-controls relative flex items-center h-full">
                <div className="infotip" onClick={handleConnect}>
                  <IconPlugConnected
                    className={classnames('cursor-pointer', {
                      'animate-pulse': connectionStatus === CONNECTION_STATUS.CONNECTING
                    })}
                    color={theme.colors.text.green}
                    strokeWidth={1.5}
                    size={20}
                  />
                  <span className="infotip-text text-xs">Connect</span>
                </div>
              </div>
            )}

            <div data-testid="run-button" className="cursor-pointer" onClick={handleRunClick}>
              <IconArrowRight color={theme.requestTabPanel.url.icon} strokeWidth={1.5} size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center h-full namespace-row px-[10px] gap-2">
        <span className="namespace-label">Namespace</span>
        <input
          type="text"
          className="namespace-input"
          placeholder="/"
          value={namespaceValue}
          onChange={(e) => {
            const val = e.target.value;
            setNamespaceValue(val);
            dispatch(socketioNamespaceChanged({
              itemUid: item.uid,
              collectionUid: collection.uid,
              namespace: val
            }));
          }}
        />
      </div>

      {connectionStatus === CONNECTION_STATUS.CONNECTED && <div className="connection-status-strip"></div>}
    </StyledWrapper>
  );
};

export default SioQueryUrl;
