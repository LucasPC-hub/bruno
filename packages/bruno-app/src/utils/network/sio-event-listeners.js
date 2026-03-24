import { useEffect } from 'react';
import { sioResponseReceived, runSioRequestEvent } from 'providers/ReduxStore/slices/collections/index';
import { useDispatch } from 'react-redux';
import { isElectron } from 'utils/common/platform';
import { updateActiveConnectionsInStore } from 'providers/ReduxStore/slices/collections/actions';

const useSioEventListeners = () => {
  const { ipcRenderer } = window;
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isElectron()) {
      return () => {};
    }

    const removeConnectingListener = ipcRenderer.on('main:sio:connecting', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({ eventType: 'connecting', itemUid: requestId, collectionUid, eventData }));
    });

    const removeConnectedListener = ipcRenderer.on('main:sio:connected', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({ eventType: 'connected', itemUid: requestId, collectionUid, eventData }));
    });

    const removeMessageListener = ipcRenderer.on('main:sio:message', (requestId, collectionUid, eventData) => {
      dispatch(sioResponseReceived({ itemUid: requestId, collectionUid, eventType: 'message', eventData }));
    });

    const removeErrorListener = ipcRenderer.on('main:sio:error', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({ eventType: 'error', itemUid: requestId, collectionUid, eventData }));
    });

    const removeDisconnectedListener = ipcRenderer.on('main:sio:disconnected', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({ eventType: 'disconnected', itemUid: requestId, collectionUid, eventData }));
    });

    const removeAckListener = ipcRenderer.on('main:sio:ack', (requestId, collectionUid, eventData) => {
      dispatch(sioResponseReceived({ itemUid: requestId, collectionUid, eventType: 'ack', eventData }));
    });

    const removeConnectionsChangedListener = ipcRenderer.on('main:sio:connections-changed', (data) => {
      dispatch(updateActiveConnectionsInStore(data));
    });

    return () => {
      removeConnectingListener();
      removeConnectedListener();
      removeMessageListener();
      removeErrorListener();
      removeDisconnectedListener();
      removeAckListener();
      removeConnectionsChangedListener();
    };
  }, [isElectron]);
};

export default useSioEventListeners;
