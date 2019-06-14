/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import Root from '../chat-components/containers/Root';

const { history } = require('../chat-components/store/configureStore').default;
import registerLoginChatAccounts from '../utils/registerLoginChatAccounts';

export default class ChatView extends Component {
  static displayName = 'ChatView';

  render() {
    return (
      <div className="chat-view-container">
        <Root store={chatReduxStore} />
      </div>
    )
  }
}
