/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import ConversationsPanel from '../components/conversations/ConversationsPanel';
import ChatViewLeftResizeBar from '../components/common/ChatViewLeftResizeBar';
import registerLoginChat from '../utils/register-login-chat';

export const BOTTOM_OFFSET = 37;
export const MIN_HEIGHT = 50;

export default class ChatViewLeft extends Component {
  static displayName = 'ChatViewLeft';

  componentDidMount() {
    registerLoginChat();
  }

  render() {
    return (
      <div
        className="chat-view-container chat-left-panel-container"
        style={{
          minHeight: MIN_HEIGHT + 'px',
          bottom: BOTTOM_OFFSET + 'px',
        }}
      >
        <div className="left-panel">
          <ChatViewLeftResizeBar />
          <ConversationsPanel />
        </div>
      </div>
    );
  }
}
