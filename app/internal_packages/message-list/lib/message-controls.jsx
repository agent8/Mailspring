/* eslint global-require: 0 */
import { remote } from 'electron';
import {
  React,
  ReactDOM,
  PropTypes,
  Actions,
  TaskQueue,
  GetMessageRFC2822Task,
  MakePrimaryTask,
  MakeOtherTask,
  TaskFactory,
  FocusedPerspectiveStore,
  MuteNotificationStore,
} from 'mailspring-exports';
import { RetinaImg, ButtonDropdown, Menu, FullScreenModal } from 'mailspring-component-kit';
import MessageTimestamp from './message-timestamp';
import UserViewBtn from '../../../src/components/user-review-button';

const buttonTimeout = 700;
const EnableFocusedInboxKey = 'core.workspace.enableFocusedInbox';
const isMessageView = AppEnv.isDisableThreading();

export default class MessageControls extends React.Component {
  static displayName = 'MessageControls';
  static propTypes = {
    thread: PropTypes.object,
    isBlocked: PropTypes.bool,
    onBlock: PropTypes.func,
    message: PropTypes.object.isRequired,
    messages: PropTypes.array,
    threadPopedOut: PropTypes.bool,
    hideControls: PropTypes.bool,
    trackers: PropTypes.array,
    viewOriginalEmail: PropTypes.bool,
    setViewOriginalEmail: PropTypes.func,
    selection: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.CONFIG_KEY = 'core.appearance.adaptiveEmailColor';
    this.state = {
      isReplying: false,
      isReplyAlling: false,
      isForwarding: false,
      isMuted: false,
      showViewOriginalEmail: AppEnv.isDarkTheme() && AppEnv.config.get(this.CONFIG_KEY),
      showMoveFocusedOtherModal: false,
    };
    this._mounted = false;
    this._replyTimer = null;
    this._replyAllTimer = null;
    this._forwardTimer = null;
    this._unlisten = [
      Actions.draftReplyForwardCreated.listen(this._onDraftCreated, this),
      MuteNotificationStore.listen(this._onMuteChange),
    ];
  }

  componentDidMount() {
    this._mounted = true;
    this._onMuteChange();
    this.disposable = AppEnv.config.onDidChange(this.CONFIG_KEY, () => {
      if (this._mounted) {
        this.setState({
          showViewOriginalEmail:
            AppEnv.isDarkTheme() && AppEnv.isDarkTheme() && AppEnv.config.get(this.CONFIG_KEY),
        });
      }
    });
  }

  componentWillUnmount() {
    this._mounted = false;
    this._unlisten.forEach(un => un());
    this.disposable.dispose();
    clearTimeout(this._forwardTimer);
    clearTimeout(this._replyAllTimer);
    clearTimeout(this._replyTimer);
  }

  _onMuteChange = () => {
    const { message } = this.props;
    const accoundId = message.accountId;
    const email = message.from && message.from[0] ? message.from[0].email : '';
    const isMuted = MuteNotificationStore.isMuteByAccount(accoundId, email);
    this.setState({ isMuted });
  };

  _timeoutButton = type => {
    if (type === 'reply') {
      if (!this._replyTimer) {
        this._replyTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplying: false });
            this._replyTimer = null;
          }
        }, buttonTimeout);
      }
    } else if (type === 'reply-all') {
      if (!this._replyAllTimer) {
        this._replyAllTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplyAlling: false });
            this._replyAllTimer = null;
          }
        }, buttonTimeout);
      }
    } else {
      if (!this._forwardTimer) {
        this._forwardTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isForwarding: false });
            this._forwardTimer = null;
          }
        }, buttonTimeout);
      }
    }
  };

  _onDraftCreated = ({ messageId, type = '' }) => {
    if (messageId && messageId === this.props.message.id && this._mounted) {
      if (type === 'reply') {
        if (this._replyTimer) {
          return;
        }
        this._replyTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplying: false });
          }
          this._replyTimer = null;
        }, buttonTimeout);
      } else if (type === 'reply-all') {
        if (this._replyAllTimer) {
          return;
        }
        this._replyAllTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isReplyAlling: false });
          }
          this._replyAllTimer = null;
        }, buttonTimeout);
      } else {
        if (this._forwardTimer) {
          return;
        }
        this._forwardTimer = setTimeout(() => {
          if (this._mounted) {
            this.setState({ isForwarding: false });
          }
          this._forwardTimer = null;
        }, buttonTimeout);
      }
    }
  };

  _onViewOriginalEmail = () => {
    if (this.props.setViewOriginalEmail && typeof this.props.setViewOriginalEmail === 'function') {
      this.props.setViewOriginalEmail(true);
    }
  };

  _onPrintEmail = () => {
    const actionsWrap = ReactDOM.findDOMNode(this._actionsWrap);
    if (!actionsWrap) {
      return;
    }
    const emailWrap = actionsWrap.closest('.message-item-wrap');
    if (!emailWrap) {
      return;
    }

    const messageIframe = emailWrap.getElementsByTagName('iframe');
    if (!messageIframe || !messageIframe[0]) {
      return;
    }

    const iframeHtml = messageIframe[0].contentDocument
      ? messageIframe[0].contentDocument.body.innerHTML
      : '';

    Actions.printMessage(this.props.thread, emailWrap.outerHTML, iframeHtml);
  };

  _onToggleMuteEmail = () => {
    this.setState({ showMuteEmailModal: !this.state.showMuteEmailModal });
  };

  _onToggleMoveFocusedOther = () => {
    this.setState({ showMoveFocusedOtherModal: !this.state.showMoveFocusedOtherModal });
  };

  _onUnmuteNotification = () => {
    const { message } = this.props;
    const email = message.from && message.from[0] ? message.from[0].email : '';

    MuteNotificationStore.unMuteNotifacationByAccount(message.accountId, email);
  };

  _onMuteEmail = email => {
    const { message } = this.props;
    this._onToggleMuteEmail();
    MuteNotificationStore.muteNotifacationByAccount(message.accountId, email);
  };

  _onMoveToFocused = event => {
    const { accountId, id } = this.props.message;
    Actions.queueTask(new MakePrimaryTask({ accountId: accountId, messageIds: [id] }));
    if (event) {
      event.stopPropagation();
    }
    this._onToggleMoveFocusedOther();
    if (this.props.selection) {
      this.props.selection.clear();
    }

    Actions.popSheet({ reason: 'MessageControls:_onMoveFocused' });
  };

  _onMoveToOther = event => {
    const { accountId, id } = this.props.message;
    Actions.queueTask(new MakeOtherTask({ accountId: accountId, messageIds: [id] }));
    if (event) {
      event.stopPropagation();
    }
    this._onToggleMoveFocusedOther();
    if (this.props.selection) {
      this.props.selection.clear();
    }
    Actions.popSheet({ reason: 'MessageControls:_onMoveOther' });
  };

  _items() {
    const { isMuted } = this.state;
    const reply = {
      name: 'Reply',
      image: 'reply.svg',
      disabledIcon: this.state.isReplying,
      select: this.props.threadPopedOut ? this._onPopoutThread : this._onReply,
    };
    const replyAll = {
      name: 'Reply All',
      image: 'reply-all.svg',
      disabledIcon: this.state.isReplyAlling,
      select: this.props.threadPopedOut ? this._onPopoutThread : this._onReplyAll,
    };
    const forward = {
      name: 'Forward',
      image: 'forward.svg',
      disabledIcon: this.state.isForwarding,
      select: this.props.threadPopedOut ? this._onPopoutThread : this._onForward,
    };
    const trash = {
      name: this.props.message.isInTrash() ? 'Delete Forever' : 'Trash',
      image: 'trash.svg',
      select: this.props.threadPopedOut ? this._onPopoutThread : this._onTrash,
    };

    const viewOriginalEmail = {
      name: 'View original email',
      image: 'show-password.svg',
      iconHidden: true,
      disabled: this.props.viewOriginalEmail,
      select: this._onViewOriginalEmail,
    };

    const printEmail = {
      name: 'Print',
      image: 'print.svg',
      iconHidden: true,
      select: this._onPrintEmail,
    };

    const muteEmail = {
      name: `${isMuted ? 'Unmute' : 'Mute'} notifications`,
      image: 'preview.svg',
      iconHidden: true,
      select: isMuted ? this._onUnmuteNotification : this._onToggleMuteEmail,
    };

    const moveToFocused = {
      name: 'Move to Focused',
      image: 'preview.svg',
      iconHidden: true,
      select: this._onToggleMoveFocusedOther,
    };

    const moveToOther = {
      name: 'Move to Other',
      image: 'preview.svg',
      iconHidden: true,
      select: this._onToggleMoveFocusedOther,
    };

    const markAsRead = {
      name: 'Mark as Read',
      image: 'read.svg',
      iconHidden: true,
      select: this._onMarkAsRead,
    };
    const markAsUnread = {
      name: 'Mark as Unread',
      image: 'unread.svg',
      iconHidden: true,
      select: this._onMarkAsUnread,
    };

    const ret = [];
    if (this.props.message && !this.props.message.draft) {
      if (!this.props.message.canReplyAll()) {
        ret.push(reply);
      } else {
        const defaultReplyType = AppEnv.config.get('core.sending.defaultReplyType');
        if (defaultReplyType === 'reply-all') {
          ret.push(replyAll, reply);
        } else {
          ret.push(reply, replyAll);
        }
      }
      ret.push(forward);
    }

    if (!this.props.message.draft && !isMessageView) {
      ret.push(trash);
    }
    if (!isMessageView && this.props.message) {
      if (this.props.message.unread) {
        ret.push(markAsRead);
      } else {
        ret.push(markAsUnread);
      }
    }
    if (this.state.showViewOriginalEmail) {
      ret.push(viewOriginalEmail);
    }
    if (
      this.props.message &&
      this.props.message.isFromMe &&
      !this.props.message.isFromMe({ ignoreOtherAccounts: true })
    ) {
      ret.push(muteEmail);
    } else if (this.props.message && !this.props.message.isFromMe) {
      ret.push(muteEmail);
    }
    if (AppEnv.config.get(EnableFocusedInboxKey)) {
      if (this.props.message.isInInboxFocused()) {
        ret.push(moveToOther);
      }
      if (this.props.message.isInInboxOther()) {
        ret.push(moveToFocused);
      }
    }
    if (!isMessageView) {
      ret.push(printEmail);
    }

    return ret;
  }

  _onPopoutThread = () => {
    if (!this.props.thread) {
      return;
    }
    Actions.popoutThread(this.props.thread);
    // This returns the single-pane view to the inbox, and does nothing for
    // double-pane view because we're at the root sheet.
    Actions.popSheet({ reason: 'Message-Controls:_onPopoutThread' });
  };

  _dropdownMenu(items) {
    const itemContent = item => {
      const style = { width: 18, height: 18, fontSize: 18 };
      if (item.iconHidden || item.disabledIcon) {
        style.color = 'transparent';
      }
      return (
        <span>
          <RetinaImg
            name={item.image}
            style={style}
            isIcon={true}
            mode={RetinaImg.Mode.ContentIsMask}
          />
          {item.name}
        </span>
      );
    };

    return (
      <Menu
        items={items}
        itemKey={item => item.name}
        itemContent={itemContent}
        onSelect={item => item.select()}
      />
    );
  }
  _isInTrashOrSpamView = () => {
    const perspective = FocusedPerspectiveStore.current();
    if (perspective && (perspective.isTrash() || perspective.isSpam())) {
      AppEnv.showMessageBox({
        title: 'Cannot create draft',
        detail: `Cannot create draft in ${
          perspective.isTrash() ? 'Trash' : 'Spam'
        } view, please move message out.`,
        buttons: ['Okay'],
      });
      return true;
    }
    return false;
  };
  _onMarkAsRead = () => {
    Actions.setMessagesReadUnread({
      messageIds: [this.props.message.id],
      unread: false,
      source: 'MessageControl:SingleMessage:mark as read',
    });
  };
  _onMarkAsUnread = () => {
    Actions.setMessagesReadUnread({
      messageIds: [this.props.message.id],
      unread: true,
      source: 'MessageControl:SingleMessage:mark as unread',
    });
  };

  _onReply = () => {
    const { thread, message } = this.props;
    if (!this.state.isReplying && !this._replyTimer) {
      if (this._isInTrashOrSpamView()) {
        return;
      }
      this._timeoutButton('reply');
      this.setState({ isReplying: true });
      Actions.composeReply({
        thread,
        message,
        type: 'reply',
        behavior: 'prefer-existing-if-pristine',
      });
    }
  };

  _onReplyAll = () => {
    const { thread, message } = this.props;
    if (!this.state.isReplyAlling && !this._replyAllTimer) {
      if (this._isInTrashOrSpamView()) {
        return;
      }
      this._timeoutButton('reply-all');
      this.setState({ isReplyAlling: true });
      Actions.composeReply({
        thread,
        message,
        type: 'reply-all',
        behavior: 'prefer-existing-if-pristine',
      });
    }
  };

  _onForward = () => {
    const { thread, message } = this.props;
    if (!this.state.isForwarding && !this._forwardTimer) {
      if (this._isInTrashOrSpamView()) {
        return;
      }
      this._timeoutButton('forward');
      this.setState({ isForwarding: true });
      Actions.composeForward({ thread, message });
    }
  };

  _onRemove = event => {
    const tasks = TaskFactory.tasksForMovingToTrash({
      messages: [this.props.message],
      source: 'Toolbar Button: Message List: Remove',
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (!task.accountId) {
          AppEnv.reportError(new Error(`Expunge Task no accountId`), {
            errorData: {
              task: task.toJSON(),
              message: JSON.stringify(this.props.message),
            },
          });
        }
      });
    }
    Actions.queueTasks(tasks);
    if (event) {
      event.stopPropagation();
    }
    if (this.props.selection) {
      this.props.selection.clear();
    }
    // if (this.props.messages && this.props.messages && this.props.messages.length === 1) {
    //   Actions.popSheet({ reason: 'MessageControls:_onRemove' });
    // }
  };
  _onExpunge = event => {
    const tasks = TaskFactory.tasksForExpungingThreadsOrMessages({
      messages: [this.props.message],
      source: 'Toolbar Button: Message List',
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (!task.accountId) {
          AppEnv.reportError(new Error(`Expunge Task no accountId`), {
            errorData: {
              task: task.toJSON(),
              message: JSON.stringify(this.props.message),
            },
          });
        }
      });
    }
    AppEnv.showMessageBox({
      title: 'Are you sure?',
      detail: 'Message(s) will be permanently deleted.',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response } = {}) => {
      if (response !== 0) {
        AppEnv.logDebug(`Expunging message canceled, user clicked No`);
        return;
      }
      Actions.queueTasks(tasks);
      // if (this.props.messages && this.props.messages && this.props.messages.length === 1) {
      //   Actions.popSheet({ reason: 'MessageControls:_onExpunge' });
      // }
    });
    if (event) {
      event.stopPropagation();
    }
  };

  _onTrash = () => {
    const inTrash = this.props.message.isInTrash();
    if (inTrash) {
      this._onExpunge();
    } else {
      this._onRemove();
    }
  };

  _onShowActionsMenu = () => {
    const SystemMenu = remote.Menu;
    const SystemMenuItem = remote.MenuItem;

    // Todo: refactor this so that message actions are provided
    // dynamically. Waiting to see if this will be used often.
    const menu = new SystemMenu();
    menu.append(new SystemMenuItem({ label: 'Log Data', click: this._onLogData }));
    // menu.append(new SystemMenuItem({ label: 'Show Original', click: this._onShowOriginal }));
    menu.append(
      new SystemMenuItem({ label: 'Copy Debug Info to Clipboard', click: this._onCopyToClipboard })
    );
    menu.popup({});
  };

  _onShowOriginal = async () => {
    const { message } = this.props;
    const filepath = require('path').join(remote.app.getPath('temp'), message.id);
    const task = new GetMessageRFC2822Task({
      messageId: message.id,
      accountId: message.accountId,
      filepath,
    });
    Actions.queueTask(task);
    await TaskQueue.waitForPerformRemote(task);
    const win = new remote.BrowserWindow({
      width: 800,
      height: 600,
      title: `${message.subject} - RFC822`,
    });
    win.loadURL(`file://${filepath}`);
  };

  _onLogData = () => {
    console.log(this.props.message);
    window.__message = this.props.message;
    window.__thread = this.props.thread;
    console.log('Also now available in window.__message and window.__thread');
  };

  _onCopyToClipboard = () => {
    const { message, thread } = this.props;
    const clipboard = require('electron').clipboard;
    const data = `
      AccountID: ${message.accountId}
      Message ID: ${message.id}
      Message Metadata: ${JSON.stringify(message.pluginMetadata, null, '  ')}
      Thread ID: ${thread.id}
      Thread Metadata: ${JSON.stringify(thread.pluginMetadata, null, '  ')}
    `;
    clipboard.writeText(data);
  };

  _consoleDebugInfo = () => {
    const { message, thread } = this.props;
    const data = `
      AccountID: ${message.accountId}
      Message ID: ${message.id}
      Message Metadata: ${JSON.stringify(message.pluginMetadata, null, '  ')}
      Thread ID: ${thread.id}
      Thread Metadata: ${JSON.stringify(thread.pluginMetadata, null, '  ')}
    `;
    console.log('** debug info ***', data);
  };

  _onClickTrackingIcon = event => {
    const originRect = event.target.getBoundingClientRect();
    Actions.openPopover(this._renderTrackingPopup(), {
      disablePointer: true,
      direction: 'left',
      originRect: {
        bottom: originRect.bottom - 149,
        top: originRect.top + 149,
        right: originRect.right - 38,
        left: originRect.left + 38,
        height: originRect.height,
        width: originRect.width,
      },
      className: 'remove-tracker-popover',
    });
  };

  _onCloseTrackingPopup = () => {
    Actions.closePopover();
  };

  _renderTrackingPopup = () => {
    return (
      <div className="remove-tracker">
        <RetinaImg name={'emailtracking-popup-image.png'} mode="" />
        <h3>Email tracking is Blocked</h3>
        <p>Senders won&#39;t see when and where you read messages.</p>
        <UserViewBtn />
        <RetinaImg
          className="close"
          style={{ width: 20 }}
          name={'close.svg'}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this._onCloseTrackingPopup}
        />
      </div>
    );
  };

  _renderMuteEmailPopup = () => {
    const { message } = this.props;
    const email = message.from && message.from[0] ? message.from[0].email : '';

    return (
      <div className="email-confirm-popup">
        <RetinaImg
          isIcon
          className="close-icon"
          style={{ width: '20', height: '20' }}
          name="close.svg"
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this._onToggleMuteEmail}
        />
        <h1>
          Mute notifications from
          <br />
          {email}
        </h1>
        <p>You won&#39;t be notified about new mail from this sender.</p>
        <div className="btn-list">
          <div className="btn cancel" onClick={this._onToggleMuteEmail}>
            Cancel
          </div>
          <div className="btn confirm" onClick={() => this._onMuteEmail(email)}>
            Mute
          </div>
        </div>
      </div>
    );
  };

  _renderMoveFocusedOtherPopup = () => {
    const { message } = this.props;
    const email = message.from && message.from[0] ? message.from[0].email : '';
    const isInInbox = message.isInInboxFocused();
    const toTabsName = isInInbox ? 'Other' : 'Focused';
    const onConfirmFn = isInInbox ? this._onMoveToOther : this._onMoveToFocused;
    return (
      <div className="email-confirm-popup">
        <RetinaImg
          isIcon
          className="close-icon"
          style={{ width: '20', height: '20' }}
          name="close.svg"
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this._onToggleMoveFocusedOther}
        />
        <h1>{`Move to ${toTabsName} Inbox`}</h1>
        <p>
          Always move conversations from
          <br />
          <span>{`${email} to your ${toTabsName} Inbox`}</span>
        </p>
        <div className="btn-list">
          <div className="btn cancel" onClick={this._onToggleMoveFocusedOther}>
            Cancel
          </div>
          <div className="btn confirm" onClick={onConfirmFn}>
            Move
          </div>
        </div>
      </div>
    );
  };

  _renderBlockBtn() {
    const { message, isBlocked, onBlock } = this.props;
    if (message && message.isFromMe && message.isFromMe({ ignoreOtherAccounts: true })) {
      return;
    }
    let btnText = '';

    if (message.listUnsubscribe) {
      btnText = isBlocked ? 'Resubscribe' : 'Unsubscribe';
    } else {
      btnText = isBlocked ? 'Unblock' : 'Block';
    }

    return (
      <div
        className="blockBtn"
        onClick={e => {
          if (onBlock && typeof onBlock === 'function') {
            onBlock(e);
          }
        }}
      >
        {btnText}
      </div>
    );
  }

  render() {
    const items = this._items();
    const { trackers } = this.props;
    return (
      <div
        className="message-actions-wrap"
        onClick={e => e.stopPropagation()}
        ref={el => (this._actionsWrap = el)}
      >
        {trackers.length > 0 ? (
          <div className="remove-tracker">
            <RetinaImg
              name={'readReceipts.svg'}
              style={{ width: 16, height: 16, fontSize: 16 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
              onClick={this._onClickTrackingIcon}
            />
          </div>
        ) : null}
        <MessageTimestamp
          onClick={this._consoleDebugInfo}
          className="message-time"
          isDetailed
          date={this.props.message.date}
        />
        {!this.props.hideControls && this.props.message && !this.props.message.draft ? (
          <div className="replyBtn" title={items[0].name} onClick={items[0].select}>
            <RetinaImg
              name={items[0].image}
              style={{ width: 24, height: 24, fontSize: 24, verticalAlign: 'middle' }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </div>
        ) : null}
        {this._renderBlockBtn()}
        {!this.props.hideControls && items.length > 1 ? (
          <ButtonDropdown
            primaryClick={() => {}}
            closeOnMenuClick
            menu={this._dropdownMenu(items.slice(1))}
          />
        ) : null}
        {/* {!this.props.hideControls ? (
          <div className="message-actions-ellipsis" onClick={this._onShowActionsMenu}>
            <RetinaImg
              name="expand-more.svg"
              style={{ width: 24, height: 24, fontSize: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </div>
        ) : null} */}

        <FullScreenModal
          visible={this.state.showMuteEmailModal}
          style={{
            height: 'auto',
            width: '400px',
            top: '165px',
            right: '255px',
            left: 'auto',
            bottom: 'auto',
          }}
        >
          {this._renderMuteEmailPopup()}
        </FullScreenModal>
        <FullScreenModal
          visible={this.state.showMoveFocusedOtherModal}
          style={{
            height: 'auto',
            width: '400px',
            top: '165px',
            right: '255px',
            left: 'auto',
            bottom: 'auto',
          }}
        >
          {this._renderMoveFocusedOtherPopup()}
        </FullScreenModal>
      </div>
    );
  }
}
