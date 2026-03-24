const { ipcMain } = require('electron');
const { SioClient } = require('@usebruno/requests');
const { cloneDeep, each, get } = require('lodash');
const interpolateVars = require('./interpolate-vars');
const { preferencesUtil } = require('../../store/preferences');
const { getCertsAndProxyConfig } = require('./cert-utils');
const {
  getEnvVars,
  getTreePathFromCollectionToItem,
  mergeHeaders,
  mergeScripts,
  mergeVars,
  mergeAuth,
  getFormattedCollectionOauth2Credentials
} = require('../../utils/collection');
const { getProcessEnvVars } = require('../../store/process-env');
const {
  getOAuth2TokenUsingPasswordCredentials,
  getOAuth2TokenUsingClientCredentials,
  getOAuth2TokenUsingAuthorizationCode
} = require('../../utils/oauth2');
const { interpolateString } = require('./interpolate-string');
const { setAuthHeaders } = require('./prepare-request');

const prepareSioRequest = async (item, collection, environment, runtimeVariables, certsAndProxyConfig = {}) => {
  const request = item.draft ? item.draft.request : item.request;
  const collectionRoot = collection?.draft?.root ? get(collection, 'draft.root', {}) : get(collection, 'root', {});
  const brunoConfig = collection.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig', {})
    : get(collection, 'brunoConfig', {});
  const rawHeaders = cloneDeep(request.headers ?? []);
  const headers = {};

  const scriptFlow = brunoConfig?.scripts?.flow ?? 'sandwich';
  const requestTreePath = getTreePathFromCollectionToItem(collection, item);
  if (requestTreePath && requestTreePath.length > 0) {
    mergeHeaders(collection, request, requestTreePath);
    mergeScripts(collection, request, requestTreePath, scriptFlow);
    mergeVars(collection, request, requestTreePath);
    mergeAuth(collection, request, requestTreePath);
    request.globalEnvironmentVariables = collection?.globalEnvironmentVariables;
    request.oauth2CredentialVariables = getFormattedCollectionOauth2Credentials({
      oauth2Credentials: collection?.oauth2Credentials
    });
  }

  each(get(collectionRoot, 'request.headers', []), (h) => {
    if (h.enabled && h.name?.toLowerCase() === 'content-type') {
      return false;
    }
  });

  each(get(request, 'headers', []), (h) => {
    if (h.enabled) {
      headers[h.name] = h.value;
    }
  });

  const envVars = getEnvVars(environment);
  const processEnvVars = getProcessEnvVars(collection.uid);
  const { promptVariables = {} } = collection;

  let sioRequest = {
    uid: item.uid,
    mode: request.body?.mode,
    url: request.url,
    headers,
    processEnvVars,
    envVars,
    runtimeVariables,
    body: request.body,
    // Add variable properties for interpolation
    vars: request.vars,
    collectionVariables: request.collectionVariables,
    folderVariables: request.folderVariables,
    requestVariables: request.requestVariables,
    globalEnvironmentVariables: request.globalEnvironmentVariables,
    oauth2CredentialVariables: request.oauth2CredentialVariables
  };

  sioRequest = setAuthHeaders(sioRequest, request, collection);

  if (sioRequest.oauth2) {
    let requestCopy = cloneDeep(sioRequest);
    const { oauth2: { grantType, tokenPlacement, tokenHeaderPrefix, tokenQueryKey, accessTokenUrl, refreshTokenUrl } = {}, collectionVariables, folderVariables, requestVariables } = requestCopy || {};

    // Get cert/proxy configs for token and refresh URLs
    let certsAndProxyConfigForTokenUrl = certsAndProxyConfig;
    let certsAndProxyConfigForRefreshUrl = certsAndProxyConfig;

    if (accessTokenUrl && grantType !== 'implicit') {
      const interpolatedTokenUrl = interpolateString(accessTokenUrl, {
        globalEnvironmentVariables: request.globalEnvironmentVariables,
        collectionVariables,
        envVars,
        folderVariables,
        requestVariables,
        runtimeVariables,
        processEnvVars,
        promptVariables
      });
      const tokenRequestForConfig = { ...requestCopy, url: interpolatedTokenUrl };
      certsAndProxyConfigForTokenUrl = await getCertsAndProxyConfig({
        collectionUid: collection.uid,
        collection,
        request: tokenRequestForConfig,
        envVars,
        runtimeVariables,
        processEnvVars,
        collectionPath: collection.pathname,
        globalEnvironmentVariables: request.globalEnvironmentVariables
      });
    }

    const tokenUrlForRefresh = refreshTokenUrl || accessTokenUrl;
    if (tokenUrlForRefresh && grantType !== 'implicit') {
      const interpolatedRefreshUrl = interpolateString(tokenUrlForRefresh, {
        globalEnvironmentVariables: request.globalEnvironmentVariables,
        collectionVariables,
        envVars,
        folderVariables,
        requestVariables,
        runtimeVariables,
        processEnvVars,
        promptVariables
      });
      const refreshRequestForConfig = { ...requestCopy, url: interpolatedRefreshUrl };
      certsAndProxyConfigForRefreshUrl = await getCertsAndProxyConfig({
        collectionUid: collection.uid,
        collection,
        request: refreshRequestForConfig,
        envVars,
        runtimeVariables,
        processEnvVars,
        collectionPath: collection.pathname,
        globalEnvironmentVariables: request.globalEnvironmentVariables
      });
    }

    let credentials, credentialsId, oauth2Url, debugInfo;

    switch (grantType) {
      case 'authorization_code':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
        ({
          credentials,
          url: oauth2Url,
          credentialsId,
          debugInfo
        } = await getOAuth2TokenUsingAuthorizationCode({
          request: requestCopy,
          collectionUid: collection.uid,
          certsAndProxyConfigForTokenUrl,
          certsAndProxyConfigForRefreshUrl
        }));
        sioRequest.oauth2Credentials = {
          credentials,
          url: oauth2Url,
          collectionUid: collection.uid,
          credentialsId,
          debugInfo,
          folderUid: request.oauth2Credentials?.folderUid
        };
        if (tokenPlacement == 'header') {
          sioRequest.headers['Authorization'] = `${tokenHeaderPrefix} ${credentials?.access_token}`;
        } else {
          try {
            const url = new URL(request.url);
            url?.searchParams?.set(tokenQueryKey, credentials?.access_token);
            request.url = url?.toString();
          } catch (error) {}
        }
        break;
      case 'client_credentials':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
        ({
          credentials,
          url: oauth2Url,
          credentialsId,
          debugInfo
        } = await getOAuth2TokenUsingClientCredentials({
          request: requestCopy,
          collectionUid: collection.uid,
          certsAndProxyConfigForTokenUrl,
          certsAndProxyConfigForRefreshUrl
        }));
        sioRequest.oauth2Credentials = {
          credentials,
          url: oauth2Url,
          collectionUid: collection.uid,
          credentialsId,
          debugInfo,
          folderUid: request.oauth2Credentials?.folderUid
        };
        if (tokenPlacement == 'header') {
          sioRequest.headers['Authorization'] = `${tokenHeaderPrefix} ${credentials?.access_token}`;
        } else {
          try {
            const url = new URL(request.url);
            url?.searchParams?.set(tokenQueryKey, credentials?.access_token);
            request.url = url?.toString();
          } catch (error) {}
        }
        break;
      case 'password':
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
        ({
          credentials,
          url: oauth2Url,
          credentialsId,
          debugInfo
        } = await getOAuth2TokenUsingPasswordCredentials({
          request: requestCopy,
          collectionUid: collection.uid,
          certsAndProxyConfigForTokenUrl,
          certsAndProxyConfigForRefreshUrl
        }));
        sioRequest.oauth2Credentials = {
          credentials,
          url: oauth2Url,
          collectionUid: collection.uid,
          credentialsId,
          debugInfo,
          folderUid: request.oauth2Credentials?.folderUid
        };
        if (tokenPlacement == 'header') {
          sioRequest.headers['Authorization'] = `${tokenHeaderPrefix} ${credentials?.access_token}`;
        } else {
          try {
            const url = new URL(request.url);
            url?.searchParams?.set(tokenQueryKey, credentials?.access_token);
            request.url = url?.toString();
          } catch (error) {}
        }
        break;
    }
  }

  // Add API key to the URL if placement is queryparams
  if (sioRequest.apiKeyAuthValueForQueryParams && sioRequest.apiKeyAuthValueForQueryParams.placement === 'queryparams') {
    try {
      const urlObj = new URL(sioRequest.url);

      const globalEnvironmentVariables = request.globalEnvironmentVariables;
      const promptVariables = collection?.promptVariables || {};

      const interpolationOptions = {
        globalEnvironmentVariables,
        envVars,
        runtimeVariables,
        promptVariables,
        processEnvVars
      };

      const key = interpolateString(sioRequest.apiKeyAuthValueForQueryParams.key, interpolationOptions);
      const value = interpolateString(sioRequest.apiKeyAuthValueForQueryParams.value, interpolationOptions);

      urlObj.searchParams.set(key, value);
      sioRequest.url = urlObj.toString();
    } catch (error) {
      console.error('Error adding API key to Socket.IO URL:', error);
    }
  }

  delete sioRequest.apiKeyAuthValueForQueryParams;

  interpolateVars(sioRequest, envVars, runtimeVariables, processEnvVars);

  return sioRequest;
};

// Creating sioClient at module level so it can be accessed from window-all-closed event
let sioClient;

/**
 * Register IPC handlers for Socket.IO
 */
const registerSioEventHandlers = (window) => {
  const sendEvent = (eventName, ...args) => {
    if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
      window.webContents.send(eventName, ...args);
    } else {
      console.warn(`Unable to send message "${eventName}": Window not available`);
    }
  };

  sioClient = new SioClient(sendEvent);

  // Forward all sio events from sioClient to the renderer
  const sioEvents = [
    'main:sio:connecting',
    'main:sio:connected',
    'main:sio:message',
    'main:sio:error',
    'main:sio:disconnected',
    'main:sio:ack',
    'main:sio:connections-changed'
  ];

  sioEvents.forEach((eventName) => {
    sioClient.on(eventName, (...args) => {
      sendEvent(eventName, ...args);
    });
  });

  // Start a new Socket.IO connection
  ipcMain.handle(
    'renderer:sio:start-connection',
    async (event, { request, collection, environment, runtimeVariables, settings, options = {} }) => {
      try {
        const requestCopy = cloneDeep(request);
        const preparedRequest = await prepareSioRequest(requestCopy, collection, environment, runtimeVariables, {});
        const connectOnly = options?.connectOnly ?? false;

        const requestSent = {
          type: 'request',
          url: preparedRequest.url,
          headers: preparedRequest.headers,
          body: preparedRequest.body,
          timestamp: Date.now()
        };

        if (!connectOnly) {
          const sioBody = preparedRequest.body?.sio ?? [];
          const hasEvents = sioBody.some((evt) => evt.content && evt.content.length);
          if (hasEvents) {
            sioBody.forEach((evt) => {
              sioClient.queueEvent(preparedRequest.uid, collection.uid, evt.eventName, evt.content);
            });
          }
        }

        // Get certificates and proxy configuration
        const certsAndProxyConfig = await getCertsAndProxyConfig({
          collectionUid: collection.uid,
          collection,
          request: requestCopy.request,
          envVars: preparedRequest.envVars,
          runtimeVariables,
          processEnvVars: preparedRequest.processEnvVars,
          collectionPath: collection.pathname,
          globalEnvironmentVariables: collection.globalEnvironmentVariables
        });

        const { httpsAgentRequestFields } = certsAndProxyConfig;

        const sslOptions = {
          rejectUnauthorized: preferencesUtil.shouldVerifyTls(),
          ca: httpsAgentRequestFields.ca,
          cert: httpsAgentRequestFields.cert,
          key: httpsAgentRequestFields.key,
          pfx: httpsAgentRequestFields.pfx,
          passphrase: httpsAgentRequestFields.passphrase
        };

        // Start Socket.IO connection
        await sioClient.startConnection({
          request: preparedRequest,
          collection,
          options: {
            timeout: settings.timeout,
            sslOptions
          }
        });

        sendEvent('main:sio:request', preparedRequest.uid, collection.uid, requestSent);

        // Send OAuth credentials update if available
        if (preparedRequest?.oauth2Credentials) {
          window.webContents.send('main:credentials-update', {
            credentials: preparedRequest.oauth2Credentials?.credentials,
            url: preparedRequest.oauth2Credentials?.url,
            collectionUid: collection.uid,
            credentialsId: preparedRequest.oauth2Credentials?.credentialsId,
            ...(preparedRequest.oauth2Credentials?.folderUid
              ? { folderUid: preparedRequest.oauth2Credentials.folderUid }
              : { itemUid: preparedRequest.uid }),
            debugInfo: preparedRequest.oauth2Credentials.debugInfo
          });
        }

        return { success: true };
      } catch (error) {
        console.error('Error starting Socket.IO connection:', error);
        if (error instanceof Error) {
          throw error;
        }
        sendEvent('main:sio:error', request.uid, collection.uid, { error: error.message });
        return { success: false, error: error.message };
      }
    }
  );

  // Emit an event on an existing Socket.IO connection
  ipcMain.handle('renderer:sio:emit-event', (event, requestId, collectionUid, eventName, data) => {
    try {
      sioClient.emitEvent(requestId, collectionUid, eventName, data);
      return { success: true };
    } catch (error) {
      console.error('Error emitting Socket.IO event:', error);
      return { success: false, error: error.message };
    }
  });

  // Disconnect a Socket.IO connection
  ipcMain.handle('renderer:sio:disconnect', (event, requestId) => {
    try {
      sioClient.disconnect(requestId);
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting Socket.IO connection:', error);
      return { success: false, error: error.message };
    }
  });

  // Get the connection status of a Socket.IO connection
  ipcMain.handle('renderer:sio:connection-status', (event, requestId) => {
    try {
      const status = sioClient.connectionStatus(requestId);
      return { success: true, status };
    } catch (error) {
      console.error('Error getting Socket.IO connection status:', error);
      return { success: false, error: error.message, status: 'disconnected' };
    }
  });

  // Get all active Socket.IO connection IDs
  ipcMain.handle('renderer:sio:get-active-connections', (event) => {
    try {
      const activeConnections = sioClient.getActiveConnections();
      return { success: true, activeConnections };
    } catch (error) {
      console.error('Error getting active Socket.IO connections:', error);
      return { success: false, error: error.message, activeConnections: [] };
    }
  });

  // Check if a Socket.IO connection is active
  ipcMain.handle('renderer:sio:is-connection-active', (event, requestId) => {
    try {
      const isActive = sioClient.isConnectionActive(requestId);
      return { success: true, isActive };
    } catch (error) {
      console.error('Error checking Socket.IO connection status:', error);
      return { success: false, error: error.message, isActive: false };
    }
  });
};

module.exports = {
  registerSioEventHandlers,
  sioClient
};
