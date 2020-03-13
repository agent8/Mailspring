/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import ConversationsPanel from '../components/conversations/ConversationsPanel';
import ChatViewLeftResizeBar from '../components/common/ChatViewLeftResizeBar';
import registerLoginChat from '../utils/register-login-chat';
export default class ChatViewLeft extends Component {
  static displayName = 'ChatViewLeft';

  componentDidMount() {
    registerLoginChat();
  }

  render() {
    return (
      <div className="chat-view-container chat-left-panel-container">
        <div className="left-panel">
          <ChatViewLeftResizeBar />
          <ConversationsPanel />
        </div>
      </div>
    );
  }
}
