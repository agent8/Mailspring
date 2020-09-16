import React from 'react';
import PropTypes from 'prop-types';
import {
  Utils,
  Actions,
  AttachmentStore,
  MessageStore,
  BlockedSendersStore,
  EmailAvatar,
  CalendarStore,
  FocusedPerspectiveStore,
  TrashFromSenderTask,
} from 'mailspring-exports';
import {
  RetinaImg,
  InjectedComponentSet,
  InjectedComponent,
  OutboxSender,
} from 'mailspring-component-kit';

import MessageParticipants from './message-participants';
import MessageItemBody from './message-item-body';
import MessageTimestamp from './message-timestamp';
import MessageControls from './message-controls';

export default class MessageItem extends React.Component {
  static displayName = 'MessageItem';

  static propTypes = {
    isOutboxDraft: PropTypes.bool,
    thread: PropTypes.object,
    message: PropTypes.object,
    messageIndex: PropTypes.number,
    messages: PropTypes.array,
    collapsed: PropTypes.bool,
    pending: PropTypes.bool,
    disableDraftEdit: PropTypes.bool,
    isMostRecent: PropTypes.bool,
    className: PropTypes.string,
    threadPopedOut: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);

    const fileIds = this.props.message.fileIds();
    const { message } = this.props;
    const accountId = message.accountId;
    const fromEmail = message.from && message.from[0] ? message.from[0].email : '';

    this.CONFIG_KEY = 'core.appearance.adaptiveEmailColor';
    this.state = {
      // Holds the downloadData (if any) for all of our files. It's a hash
      // keyed by a fileId. The value is the downloadData.
      downloads: AttachmentStore.getDownloadDataForFiles(fileIds),
      filePreviewPaths: AttachmentStore.previewPathsForFiles(fileIds),
      detailedHeaders: false,
      missingFileIds: MessageStore.getMissingFileIds(),
      calendar: CalendarStore.getCalendarByMessageId(props.message ? props.message.id : 'null'),
      accountId,
      fromEmail,
      isBlocked: BlockedSendersStore.isBlockedByAccount(accountId, fromEmail),
      trackers: [],
      viewOriginalEmail: AppEnv.isDarkTheme() && !AppEnv.config.get(this.CONFIG_KEY),
    };
    this.markAsReadTimer = null;
    this.mounted = false;
  }

  componentDidMount() {
    this._storeUnlisten = [
      AttachmentStore.listen(this._onDownloadStoreChange),
      MessageStore.listen(this._onMessageStoreChange),
      CalendarStore.listen(this._onCalendarStoreChange),
      BlockedSendersStore.listen(this._onBlockStoreChange),
    ];
    this.disposable = AppEnv.config.onDidChange(this.CONFIG_KEY, () => {
      if (this.mounted) {
        this.setState({
          viewOriginalEmail: AppEnv.isDarkTheme() && !AppEnv.config.get(this.CONFIG_KEY),
        });
      }
    });
    this.mounted = true;
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.markAsReadTimer);
    if (this._storeUnlisten) {
      for (let un of this._storeUnlisten) {
        un();
      }
    }
    this.disposable.dispose();
  }

  _onClickBlockBtn = e => {
    if (this.state.isBlocked) {
      BlockedSendersStore.unBlockEmailByAccount(this.state.accountId, this.state.fromEmail);
    } else {
      BlockedSendersStore.blockEmailByAccount(this.state.accountId, this.state.fromEmail);
    }
    e.stopPropagation();
  };

  _onClickParticipants = e => {
    let el = e.target;
    while (el !== e.currentTarget) {
      if (el.classList.contains('collapsed-participants')) {
        this.setState({ detailedHeaders: true });
        e.stopPropagation();
        return;
      }
      el = el.parentElement;
    }
    return;
  };

  _onClickHeader = e => {
    this._onToggleCollapsed();
  };

  _onDownloadAll = files => {
    Actions.fetchAndSaveAllFiles({
      files: files,
      accountId: this.state.accountId,
    });
  };

  _onToggleCollapsed = () => {
    const perspective = FocusedPerspectiveStore.current();
    if (this.props.isMostRecent && !perspective.sift) {
      return;
    }
    Actions.toggleMessageIdExpanded(this.props.message.id);
  };

  _onCalendarStoreChange = () => {
    this.setState({ calendar: CalendarStore.getCalendarByMessageId(this.props.message.id) });
  };

  _onMessageStoreChange = () => {
    const fileIds = this.props.message.fileIds();
    // const ret = [];
    // for (let fileId of fileIds) {
    //   const attachment = AttachmentStore.getAttachment(fileId);
    //   if (!attachment || attachment.missingData) {
    //     ret.push(fileId);
    //   }
    // }
    console.log(`attachments missing data ids`);
    this.setState({
      // attachmentsMissingData: ret,
      downloads: AttachmentStore.getDownloadDataForFiles(fileIds),
      filePreviewPaths: AttachmentStore.previewPathsForFiles(fileIds),
      missingFileIds: MessageStore.getMissingFileIds(),
    });
  };

  _onDownloadStoreChange = () => {
    const fileIds = this.props.message.fileIds();
    this.setState({
      downloads: AttachmentStore.getDownloadDataForFiles(fileIds),
      filePreviewPaths: AttachmentStore.previewPathsForFiles(fileIds),
      missingFileIds: MessageStore.getMissingFileIds(),
    });
  };

  _onBlockStoreChange = () => {
    const isBlocked = BlockedSendersStore.isBlockedByAccount(
      this.state.accountId,
      this.state.fromEmail
    );
    this.setState({ isBlocked });
  };

  _onTrashThisSenderMail = () => {
    const { accountId, fromEmail } = this.state;
    if (accountId && fromEmail) {
      const task = new TrashFromSenderTask({ accountId: accountId, email: fromEmail });
      Actions.queueTask(task);
    }
  };

  _cancelMarkAsRead = () => {
    if (this.markAsReadTimer) {
      clearTimeout(this.markAsReadTimer);
      this.markAsReadTimer = null;
    }
  };
  _markAsRead = () => {
    if (!this.props.message) {
      return;
    }
    if (this.props.collapsed || this.props.pending) {
      return;
    }
    if (!this.props.message.unread || this.props.message.draft) {
      return;
    }
    MessageStore.markAsRead('Message-Item:OnMouseEnter');
  };

  _setTrackers = trackers => {
    this.setState({ trackers });
  };
  _isAllAttachmentsDownloading() {
    if (this.props.message.files.length > 0) {
      return this.props.message.files.every(f => {
        return f.isDownloading;
      });
    } else {
      return false;
    }
  }

  _renderDownloadAllButton(attachments) {
    return (
      <div className="download-all">
        <div className="attachment-number">
          <RetinaImg
            name="feed-attachments.svg"
            isIcon
            style={{ width: 18, height: 18, fontSize: 18 }}
            mode={RetinaImg.Mode.ContentIsMask}
          />
          <span>{attachments.length} attachments</span>
        </div>
        <div className="separator">-</div>
        {this._isAllAttachmentsDownloading() ? (
          <div className="download-all-action">
            <RetinaImg
              name="refresh.svg"
              className="infinite-rotation-linear"
              style={{ width: 24, height: 24, fontSize: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </div>
        ) : (
          <div
            className="download-all-action"
            onClick={this._onDownloadAll.bind(this, attachments)}
          >
            <RetinaImg
              name="download.svg"
              isIcon
              style={{ width: 18, height: 18, fontSize: 18 }}
              mode={RetinaImg.Mode.ContentIsMask}
            />
            <span>Download all</span>
          </div>
        )}
      </div>
    );
  }

  _renderAttachments() {
    const { files = [], body, id, accountId } = this.props.message;
    if (!body) {
      console.log('message have no body');
      return null;
    }
    const { filePreviewPaths, downloads } = this.state;
    const attachedFiles = files.filter(f => {
      if (f.isTNEFType && f.isTNEFType()) {
        Actions.extractTnefFile(f, this.props.message);
      }
      return (
        !f.isTNEFType() &&
        (!f.contentId ||
          !(body || '').includes(`cid:${f.contentId}`) ||
          (f.contentId && !Utils.shouldDisplayAsImage(f)))
      );
    });

    return (
      <div>
        {attachedFiles.length > 0 && (
          <div className="attachments-area">
            <InjectedComponent
              matching={{ role: 'MessageAttachments' }}
              exposedProps={{
                files: attachedFiles,
                messageId: id,
                accountId,
                downloads,
                filePreviewPaths,
                canRemoveAttachments: false,
              }}
            />
          </div>
        )}
        {attachedFiles.length > 1 ? this._renderDownloadAllButton(attachedFiles) : null}
      </div>
    );
  }

  _renderFooterStatus() {
    return (
      <InjectedComponentSet
        className="message-footer-status"
        matching={{ role: 'MessageFooterStatus' }}
        exposedProps={{
          message: this.props.message,
          thread: this.props.thread,
          detailedHeaders: this.state.detailedHeaders,
        }}
      />
    );
  }

  _renderBlockNote() {
    if (this.state.isBlocked) {
      const { message } = this.props;
      return (
        <div className="message-block-note">
          {message.listUnsubscribe ? 'You unsubscribed from' : "You've successfully blocked"}{' '}
          {<span>{this.state.fromEmail}</span>}. Emails from this sender will now be sent to the
          Trash unless you {message.listUnsubscribe ? 'resubscribe' : 'unblock'} them.
          <div onClick={this._onTrashThisSenderMail}>Trash all previous mail from this sender</div>
        </div>
      );
    }
    return null;
  }

  _renderEmailAvatar() {
    if (this.props.isOutboxDraft) {
      return (
        <OutboxSender draft={this.props.message} lottieStyle={{ margin: '-45px auto 0px -5px' }} />
      );
    } else {
      return (
        <EmailAvatar
          key="thread-avatar"
          message={this.props.message}
          messagePending={this.props.pending}
        />
      );
    }
  }

  _renderHeader() {
    const { message, thread, messages, disableDraftEdit } = this.props;
    const { trackers, isBlocked } = this.state;
    return (
      <header
        ref={el => (this._headerEl = el)}
        className={`message-header `}
        onClick={this._onClickHeader}
      >
        {!this.props.isOutboxDraft ? (
          <InjectedComponent
            matching={{ role: 'MessageHeader' }}
            exposedProps={{ message: message, thread: thread, messages: messages }}
          />
        ) : null}
        {/*<div className="pending-spinner" style={{ position: 'absolute', marginTop: -2, left: 55 }}>*/}
        {/*  <RetinaImg width={18} name="sending-spinner.gif" mode={RetinaImg.Mode.ContentPreserve} />*/}
        {/*</div>*/}
        <div className="row">
          {this._renderEmailAvatar()}
          <div style={{ flex: 1, width: 0 }}>
            <div className="participants-to">
              <MessageParticipants
                from={message.from}
                onClick={this._onClickParticipants}
                isDetailed={this.state.detailedHeaders}
              >
                {this._renderHeaderDetailToggle()}
              </MessageParticipants>
              {disableDraftEdit && (
                <span className="draft-icon draft-indicator">Draft</span>
                // <RetinaImg
                //   name={`pencil.svg`}
                //   className={'draft-indicator'}
                //   isIcon={true}
                //   mode={RetinaImg.Mode.ContentIsMask}
                // />
              )}
              <div className="message-header-right">
                {!this.props.isOutboxDraft ? (
                  <InjectedComponentSet
                    className="message-header-status"
                    matching={{ role: 'MessageHeaderStatus' }}
                    exposedProps={{
                      message: message,
                      thread: thread,
                      detailedHeaders: this.state.detailedHeaders,
                    }}
                  />
                ) : null}
                <MessageControls
                  thread={thread}
                  message={message}
                  messages={messages}
                  isBlocked={isBlocked}
                  onBlock={this._onClickBlockBtn}
                  threadPopedOut={this.props.threadPopedOut}
                  hideControls={this.props.isOutboxDraft}
                  trackers={trackers}
                  viewOriginalEmail={this.state.viewOriginalEmail}
                  setViewOriginalEmail={value => {
                    this.setState({ viewOriginalEmail: !!value });
                  }}
                />
              </div>
            </div>
            <MessageParticipants
              detailFrom={message.from}
              to={message.to}
              cc={message.cc}
              bcc={message.bcc}
              replyTo={message.replyTo.filter(c => !message.from.find(fc => fc.email === c.email))}
              onClick={this._onClickParticipants}
              isDetailed={this.state.detailedHeaders}
            >
              {this._renderHeaderDetailToggle()}
            </MessageParticipants>
          </div>
        </div>
        {/* {this._renderFolder()} */}
      </header>
    );
  }

  _renderHeaderDetailToggle() {
    if (this.props.pending) {
      return null;
    }
    if (this.state.detailedHeaders) {
      return (
        <div
          className="header-toggle-control"
          style={{ top: 18, left: -14, transform: 'rotate(180deg)' }}
          onClick={e => {
            this.setState({ detailedHeaders: false });
            e.stopPropagation();
          }}
        >
          <RetinaImg
            name={'down-arrow.svg'}
            style={{ width: 16, height: 16, fontSize: 16 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      );
    }

    return (
      <div
        className="header-toggle-control inactive"
        style={{ top: 18 }}
        onClick={e => {
          this.setState({ detailedHeaders: true });
          e.stopPropagation();
        }}
      >
        <RetinaImg
          name={'down-arrow.svg'}
          style={{ width: 16, height: 16, fontSize: 16 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  _renderCollapsed() {
    const {
      message: { snippet, from, files, date, draft },
      className,
    } = this.props;

    const attachmentClassName = Utils.iconClassName('feed-attachments.svg');
    const pencilClassName = Utils.iconClassName('pencil.svg');
    const attachmentIcon = Utils.showIconForAttachments(files) ? (
      <div className={`collapsed-attachment ${attachmentClassName}`} />
    ) : null;

    return (
      <div className={className} onClick={this._onToggleCollapsed}>
        <div className="message-item-white-wrap">
          <div className="message-item-area">
            <EmailAvatar key="thread-avatar" message={this.props.message} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="row">
                <div className="collapsed-from">
                  {from && from[0] && from[0].displayName({ compact: true })}
                </div>
                {draft && <div className={`collapsed-pencil ${pencilClassName}`} />}
                {attachmentIcon}
                <div className="collapsed-timestamp">
                  <MessageTimestamp date={date} />
                </div>
              </div>
              <div className="collapsed-snippet">{Utils.superTrim(snippet)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  _renderFull() {
    return (
      <div
        className={this.props.className}
        onMouseEnter={this._markAsRead}
        onMouseLeave={this._cancelMarkAsRead}
      >
        <div className="message-item-white-wrap">
          <div className="message-item-area">
            {this._renderBlockNote()}
            {this._renderHeader()}
            <MessageItemBody
              pending={this.props.pending}
              message={this.props.message}
              messageIndex={this.props.messageIndex}
              downloads={this.state.downloads}
              calendar={this.state.calendar}
              setTrackers={this._setTrackers}
              viewOriginalEmail={this.state.viewOriginalEmail}
            />
            {this._renderAttachments()}
            {this._renderFooterStatus()}
          </div>
        </div>
      </div>
    );
  }
  _renderOutboxDraft() {
    return (
      <div className={this.props.className}>
        <div className="message-item-white-wrap">
          <div className="message-item-area">
            {this._renderHeader()}
            <MessageItemBody
              message={this.props.message}
              messageIndex={this.props.messageIndex}
              downloads={this.state.downloads}
              setTrackers={this._setTrackers}
              viewOriginalEmail={this.state.viewOriginalEmail}
            />
            {this._renderAttachments()}
          </div>
        </div>
      </div>
    );
  }

  render() {
    if (this.props.isOutboxDraft) {
      return this._renderOutboxDraft();
    }
    return this.props.collapsed ? this._renderCollapsed() : this._renderFull();
  }
}
