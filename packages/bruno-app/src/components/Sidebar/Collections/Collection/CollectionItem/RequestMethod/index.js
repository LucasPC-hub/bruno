import classnames from 'classnames';
import React from 'react';
import StyledWrapper from './StyledWrapper';

const getMethodFlags = (item) => ({
  isGrpc: item.type === 'grpc-request',
  isWS: item.type === 'ws-request',
  isSIO: item.type === 'socketio-request',
  isGraphQL: item.type === 'graphql-request'
});

const getMethodText = (item, { isGrpc, isWS, isSIO, isGraphQL }) => {
  if (isGrpc) return 'grpc';
  if (isWS) return 'ws';
  if (isSIO) return 'sio';
  if (isGraphQL) return 'gql';
  return item.request.method.length > 5
    ? item.request.method.substring(0, 3)
    : item.request.method;
};

const getClassname = (method = '', { isGrpc, isWS, isSIO, isGraphQL }) => {
  method = method.toLocaleLowerCase();
  return classnames('mr-1', {
    'method-get': method === 'get',
    'method-post': method === 'post',
    'method-put': method === 'put',
    'method-delete': method === 'delete',
    'method-patch': method === 'patch',
    'method-head': method === 'head',
    'method-options': method === 'options',
    'method-grpc': isGrpc,
    'method-ws': isWS,
    'method-sio': isSIO,
    'method-graphql': isGraphQL
  });
};

const RequestMethod = ({ item }) => {
  if (!['http-request', 'graphql-request', 'grpc-request', 'ws-request', 'socketio-request'].includes(item.type)) {
    return null;
  }

  const flags = getMethodFlags(item);
  const methodText = getMethodText(item, flags);
  const className = getClassname(item.request.method, flags);

  return (
    <StyledWrapper>
      <div className={className}>
        <span className="uppercase">
          {methodText}
        </span>
      </div>
    </StyledWrapper>
  );
};

export default RequestMethod;
