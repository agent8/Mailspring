import classNames from 'classnames';
import { Actions, React, PropTypes, Utils, DraftStore, ComponentRegistry, Message } from 'mailspring-exports';

import MessageItem from './message-item';

export default class MessageItemContainer extends React.Component {
  static displayName = 'MessageItemContainer';

  static propTypes = {
    thread: PropTypes.object.isRequired,
    message: PropTypes.object.isRequired,
    messages: PropTypes.array.isRequired,
    collapsed: PropTypes.bool,
    isMostRecent: PropTypes.bool,
    isBeforeReplyArea: PropTypes.bool,
    scrollTo: PropTypes.func,
    threadPopedOut: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {isSending: false};
    this.state = this._getStateFromStores();
    this.state.draftMissingAttachments = false;
  }

  componentDidMount() {
    if (this.props.message.draft) {
      this._unlisten = DraftStore.listen(this._onSendingStateChanged);
    }
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    this.setState(this._getStateFromStores(newProps));
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  focus = () => {
    this._messageComponent.focus();
  };

  _classNames() {
    return classNames({
      draft: this.props.message.draft,
      unread: this.props.message.unread,
      collapsed: this.props.collapsed,
      'message-item-wrap': true,
      'before-reply-area': this.props.isBeforeReplyArea,
    });
  }

  _onSendingStateChanged = ({ headerMessageIds = [], headerMessageId = '' }) => {
    if (
      Array.isArray(headerMessageIds) &&
      headerMessageIds.includes(this.props.message.headerMessageId)
    ) {
      console.log('draft sending state changed');
      this.setState(this._getStateFromStores());
    } else if (headerMessageId === this.props.message.headerMessageId) {
      console.log('draft sending state changed for single headerMessageId');
      console.log(`DraftStore: ${DraftStore.isSendingDraft(this.props.message.headerMessageId)}`);
      this.setState(this._getStateFromStores());
    } else {
      console.log(`change draft HeaderMessageId ${headerMessageId}, current: ${this.props.message.headerMessageId}`);
    }
  };

  _getStateFromStores(props = this.props) {
    const isSending = DraftStore.isSendingDraft(props.message.headerMessageId);
    return { isSending };
  }

  _renderMessage({ pending }) {
    return (
      <MessageItem
        ref={cm => {
          this._messageComponent = cm;
        }}
        pending={pending}
        thread={this.props.thread}
        message={this.props.message}
        messages={this.props.messages}
        className={this._classNames()}
        collapsed={this.props.collapsed}
        isMostRecent={this.props.isMostRecent}
        threadPopedOut={this.props.threadPopedOut}
      />
    );
  }

  _renderComposer() {
    const Composer = ComponentRegistry.findComponentsMatching({ role: 'Composer' })[0];
    if (!Composer) {
      return <span>No Composer Component Present</span>;
    }
    return (
      <Composer
        ref={cm => {
          this._messageComponent = cm;
        }}
        headerMessageId={this.props.message.headerMessageId}
        messageId={this.props.message.id}
        draft={this.props.message}
        className={this._classNames()}
        mode={'inline'}
        threadId={this.props.thread.id}
        scrollTo={this.props.scrollTo}
      />
    );
  }

  _isMessageSendingState() {
    const { message } = this.props;
    if (!message) {
      return false;
    }
    return (
      message.draft &&
      (Message.compareMessageState(message.syncState, Message.messageSyncState.sending) ||
        Message.compareMessageState(message.syncState, Message.messageSyncState.failing))
    );
  }

  _draftNotReady() {
    if (!this.props.message.draft) {
      return false;
    }
    return (
      this.state.isSending || this._isMessageSendingState()
    );
  }

  render() {
    if (this._draftNotReady()) {
      return this._renderMessage({ pending: true });
    }
    if (this.props.message.draft && !this.props.collapsed && this.props.message.body) {
      return this._renderComposer();
    }
    return this._renderMessage({ pending: false });
  }
}