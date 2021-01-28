import {
  React,
  ReactDOM,
  PropTypes,
  Utils,
  Actions,
  AttachmentStore,
  File,
} from 'mailspring-exports';
import {
  DropZone,
  RetinaImg,
  ScrollRegion,
  TabGroupRegion,
  AttachmentItem,
  KeyCommandsRegion,
  InjectedComponentSet,
  ComposerEditor,
  ComposerSupport,
  LottieImg,
} from 'mailspring-component-kit';
import ComposerHeader from './composer-header';
import SendActionButton from './send-action-button';
import ActionBarPlugins from './action-bar-plugins';
import Fields from './fields';
import InjectedComponentErrorBoundary from '../../../src/components/injected-component-error-boundary';

const {
  hasBlockquote,
  hasNonTrailingBlockquote,
  hideQuotedTextByDefault,
  removeQuotedText,
  BLOCK_CONFIG,
} = ComposerSupport.BaseBlockPlugins;
const buttonTimer = 700;
// The ComposerView is a unique React component because it (currently) is a
// singleton. Normally, the React way to do things would be to re-render the
// Composer with new props.
export default class ComposerView extends React.Component {
  static displayName = 'ComposerView';

  static propTypes = {
    session: PropTypes.object.isRequired,
    draft: PropTypes.object.isRequired,
    className: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this._els = {};
    this._mounted = false;

    this._keymapHandlers = {
      'composer:send-message': () => this._onPrimarySend(),
      'composer:delete-empty-draft': () => this.props.draft.pristine && this._onDestroyDraft(),
      'composer:show-and-focus-bcc': () => this._els.header.showAndFocusField(Fields.Bcc),
      'composer:show-and-focus-cc': () => this._els.header.showAndFocusField(Fields.Cc),
      'composer:focus-to': () => this._els.header.showAndFocusField(Fields.To),
      'composer:show-and-focus-from': () => {},
      'composer:select-attachment': () => this._onSelectAttachment(),
    };

    const draft = props.session.draft();
    this.state = {
      isDropping: false,
      quotedTextPresent: hasBlockquote(draft.bodyEditorState),
      quotedTextHidden: hideQuotedTextByDefault(draft),
      isDeleting: false,
      editorSelection: null,
      editorSelectedText: '',
      missingAttachments: true,
    };
    this._deleteTimer = null;
    this._lastCycleIgnoreLostFocus = false;
    this._unlisten = [
      Actions.destroyDraftFailed.listen(this._onDestroyedDraftProcessed, this),
      Actions.destroyDraftSucceeded.listen(this._onDestroyedDraftProcessed, this),
      Actions.removeQuoteText.listen(this._onQuoteRemoved, this),
    ];
    this._scrollToMessageBody = null;
  }

  componentDidMount() {
    this._mounted = true;
    this.props.draft.files.forEach(file => {
      if (Utils.shouldDisplayAsImage(file)) {
        Actions.fetchFile(file);
      }
    });

    const isBrandNew = this.props.draft.pristine && !this.props.draft.hasRefOldDraftOnRemote;
    if (isBrandNew) {
      ReactDOM.findDOMNode(this).scrollIntoView(false);
      this._animationFrameTimer = window.requestAnimationFrame(() => {
        this.focus();
      });
    }
    if (AppEnv.isComposerWindow()) {
      Actions.setCurrentWindowTitle(this._getToName(this.props.draft));
    }
    // this._isDraftMissingAttachments(this.props);
  }
  _getToName(participants) {
    if (!participants || !Array.isArray(participants.to) || participants.to.length === 0) {
      return '';
    }
    return participants.to[0].name || '';
  }
  UNSAFE_componentWillReceiveProps(newProps) {
    // this._isDraftMissingAttachments(newProps);
  }

  componentDidUpdate() {
    const { draft } = this.props;
    const isNewDraft = draft && draft.isNewDraft();
    // If the user has added an inline blockquote, show all the quoted text
    // note: this is necessary because it's hidden with CSS that can't be
    // made more specific.
    if (
      this.state.quotedTextHidden &&
      (hasNonTrailingBlockquote(draft.bodyEditorState) || isNewDraft)
    ) {
      this.setState({ quotedTextHidden: false });
    }

    // scroll to new message body
    if (this._scrollToMessageBody && typeof this._scrollToMessageBody === 'function') {
      this._scrollToMessageBody();
      this._scrollToMessageBody = null;
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._animationFrameTimer) {
      window.cancelAnimationFrame(this._animationFrameTimer);
    }
    for (let unlisten of this._unlisten) {
      unlisten();
    }
    // In the future, we should clean up the draft session entirely, or give it
    // the same lifecycle as the composer view. For now, just make sure we free
    // up all the memory used for undo/redo.
    // const { draft, session } = this.props;
    // session.changes.add({ bodyEditorState: draft.bodyEditorState.set('history', new History()) });
  }

  _onQuoteRemoved({ messageId = '' } = {}) {
    if (this._mounted && this.props.draft && this.props.draft.id === messageId) {
      this.setState({ quotedTextHidden: false, quotedTextPresent: false });
    }
  }

  _onHeaderClicked = () => {
    if (!this._mounted) {
      return;
    }
    if (this._els && this._els[Fields.Body]) {
      this._els[Fields.Body].unfocus();
    }
  };

  _isDraftMissingAttachments = props => {
    console.error('calling composer-view draft missing attachments');
    // if (!props.draft) {
    //   this.setState({ missingAttachments: false });
    //   return;
    // }
    // props.draft.missingAttachments().then(ret => {
    //   if (!this._mounted) {
    //     return;
    //   }
    //   const missing = ret.totalMissing();
    //   if (missing.length !== 0) {
    //     if (!this.state.missingAttachments) {
    //       this.setState({ missingAttachments: true });
    //       Actions.pushToFetchAttachmentsQueue({
    //         accountId: props.draft.accountId,
    //         missingItems: missing.map(f => f.id),
    //       });
    //     } else {
    //       console.warn('state already missing attachments');
    //     }
    //   } else {
    //     if (this.state.missingAttachments) {
    //       this.setState({ missingAttachments: false });
    //     } else {
    //       console.warn('state already not missing attachments');
    //     }
    //   }
    // });
  };

  focus() {
    if (!this._mounted) return;

    // If something within us already has focus, don't change it. Never, ever
    // want to pull the cursor out from under the user while typing
    const node = ReactDOM.findDOMNode(this._els.composerWrap);
    if (node.contains(document.activeElement)) {
      return;
    }

    if (this.props.draft.to.length === 0 || this.props.draft.subject.length === 0) {
      this._els.header.focus();
      // the 'header' focus, should show some body,
      // it is a user-friendly expression that the body can scroll
      // DC-997
      this.scrollBodyInView(this._els.header);
    } else {
      // Sometimes, we the component is mounted but bodyContent is not.
      if (this._els[Fields.Body]) {
        this._els[Fields.Body].focus();
      } else {
        // We retry once at next interval.
        setImmediate(() => {
          if (this._mounted && this._els[Fields.Body]) {
            this._els[Fields.Body].focus();
          }
        });
      }
    }
  }
  _onFocusToBody = () => {
    if (this._mounted && this._els[Fields.Body]) {
      this._els[Fields.Body].focus();
    }
  };

  scrollBodyInView(header) {
    const headerNode = ReactDOM.findDOMNode(header);
    if (!headerNode) {
      return;
    }
    const scroller = headerNode.closest('.scroll-region-content');
    if (!scroller) {
      return;
    }
    const scrollRect = scroller.getBoundingClientRect();
    const headerRect = headerNode.getBoundingClientRect();

    // the scrollTop range must in [scrollHeightMin ~ scrollHeightMax]
    const scrollHeightMax = scroller.scrollTop + (headerRect.y - scrollRect.y);
    const scrollHeightMin = scrollHeightMax - (scrollRect.height - headerRect.height);
    // show some mail body to mean that the body can scroll
    // the 200 is height to show of body
    let extraScrollTop = scrollHeightMin + 200;
    if (extraScrollTop > scrollHeightMax) {
      extraScrollTop = scrollHeightMax;
    } else if (extraScrollTop < 0) {
      extraScrollTop = 0;
    }
    scroller.scrollTop = extraScrollTop;

    this._scrollToMessageBody = () => {
      scroller.scrollTop = extraScrollTop;
    };
  }

  _renderContentScrollRegion() {
    if (AppEnv.isComposerWindow()) {
      return (
        <ScrollRegion
          className="compose-body-scroll"
          ref={el => {
            if (el) {
              this._els.scrollregion = el;
            }
          }}
        >
          {this._renderContent()}
        </ScrollRegion>
      );
    }
    return this._renderContent();
  }

  _onEditorBodyContextMenu = event => {
    AppEnv.logDebug(`context menu, setting ignore lost focus to true`);
    this._lastCycleIgnoreLostFocus = true;
    if (event && typeof event.isDefaultPrevented === 'function' && event.isDefaultPrevented()) {
      AppEnv.logDebug('context menu event already processed, ignoring');
      return;
    }
    if (this._els[Fields.Body] && this.state.editorSelection) {
      this._els[Fields.Body].openContextMenu(
        {
          word: this.state.editorSelectedText,
          sel: this.state.editorSelection,
          hasSelectedText: !this.state.editorSelection.isCollapsed,
        },
        event
      );
    }
    event.preventDefault();
  };

  _renderContent() {
    const isComposerWindow = AppEnv.isComposerWindow();
    return (
      <InjectedComponentErrorBoundary key="composer-error">
        <div className="composer-centered">
          <ComposerHeader
            ref={el => {
              if (el) {
                this._els.header = el;
              }
            }}
            draft={this.props.draft}
            session={this.props.session}
            initiallyFocused={this.props.draft.to.length === 0}
            onClick={this._onHeaderClicked}
            onFocusBody={this._onFocusToBody}
          />
          <div
            className="compose-body"
            ref={el => {
              if (el) {
                this._els.composeBody = el;
              }
            }}
            onMouseUp={this._onMouseUpComposerBody}
            onMouseDown={this._onMouseDownComposerBody}
            onContextMenu={this._onEditorBodyContextMenu}
            onFocus={() => {
              this._onFocusedEditor();
            }}
          >
            {this._renderBodyRegions()}
            {this._renderFooterRegions()}
            {isComposerWindow && this._renderActionsRegion()}
          </div>
        </div>
      </InjectedComponentErrorBoundary>
    );
  }

  _draftNotReady() {
    return this.props.draft && this.props.draft.waitingForBody;
  }

  _renderBodyRegions() {
    if (this._draftNotReady()) {
      return (
        <div className="message-body-loading">
          <RetinaImg
            name="inline-loading-spinner.gif"
            mode={RetinaImg.Mode.ContentDark}
            style={{ width: 14, height: 14 }}
          />
        </div>
      );
    }
    return (
      <div className="composer-body-wrap">
        {this._renderEditor()}
        {this._renderQuotedTextControl()}
        {this._renderAttachments()}
      </div>
    );
  }

  _renderQuotedTextControl() {
    if (!this.state.quotedTextPresent || !this.state.quotedTextHidden) {
      return false;
    }
    return (
      <a
        className="quoted-text-control"
        title="Show trimmed content"
        onMouseDown={e => {
          if (e.target.closest('.remove-quoted-text')) return;
          e.preventDefault();
          e.stopPropagation();
          this.setState({ quotedTextHidden: false });
        }}
      >
        <span className="dots">
          <RetinaImg
            name={'expand-more.svg'}
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </span>
        <span
          className="remove-quoted-text"
          onMouseUp={e => {
            e.preventDefault();
            e.stopPropagation();
            const { draft, session } = this.props;
            const change = removeQuotedText(draft.bodyEditorState);
            session.changes.add({ bodyEditorState: change.value });
            if (draft) {
              Actions.removeQuoteText({ messageId: draft.id });
              Actions.removeAllNoReferenceInLines(draft.id);
            }
            this.setState({ quotedTextHidden: false });
          }}
        >
          <RetinaImg
            title="Remove quoted text"
            name="closeCircle.svg"
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
            style={{ width: 20, height: 20 }}
          />
        </span>
      </a>
    );
  }

  _getDisableCommands = () => {
    return [
      'core:reply',
      'core:reply-all',
      'core:forward',
      'core:star-item',
      'core:delete-item',
      'core:archive-item',
      'core:change-folders',
      'core:snooze-item',
      'core:mark-as-unread',
      'core:report-as-spam',
      'core:pop-sheet',
    ];
  };

  _disableThreadCommand = () => {
    const disableCommands = this._getDisableCommands();
    AppEnv.commands.disableCommand(disableCommands);
  };

  _enableThreadCommand = () => {
    const disableCommands = this._getDisableCommands();
    AppEnv.commands.enableCommand(disableCommands);
  };

  _onFocusedEditor = () => {
    this._disableThreadCommand();
  };

  _onEditorBlur = (event, editor, next) => {
    if (event.isDefaultPrevented()) {
      AppEnv.logDebug(`blur event already handled, ignoring`);
      return;
    }
    event.preventDefault();
    let ignoreLostFocus = false;
    if (this._els && this._els.composeBody) {
      if (event.relatedTarget && this._els.composeBody.contains(event.relatedTarget)) {
        AppEnv.logDebug(
          `draft ${this.props.draft &&
            this.props.draft.id} click is part of composer body, ignore blur`
        );
        ignoreLostFocus = true;
      }
    }
    const toolbars = document.getElementsByClassName('RichEditor-toolbar');
    if (toolbars) {
      for (let i = 0; i < toolbars.length; i++) {
        if (toolbars[0].contains(event.relatedTarget)) {
          AppEnv.logDebug(
            `draft ${this.props.draft &&
              this.props.draft.id} click is part of RichEditor-toolbar, ignore blur`
          );
          ignoreLostFocus = true;
        }
      }
    }
    this.setState({
      editorSelection: editor.value.selection,
      editorSelectedText: editor.value.fragment.text,
    });
    this._onEditorChange(editor, ignoreLostFocus);
    if (!ignoreLostFocus) {
      this._enableThreadCommand();
    }
    this._lastCycleIgnoreLostFocus = ignoreLostFocus;
  };
  _onEditorChange = (change, ignoreLostFocus = false) => {
    // We minimize thrashing and disable editors in multiple windows by ensuring
    // non-value changes (eg focus) to the editorState don't trigger database saves
    if (!this.props.session.isPopout()) {
      const skipSaving = change.operations.every(({ type, properties }) => {
        return (
          type === 'set_selection' ||
          (type === 'set_value' &&
            Object.keys(properties).every(k => {
              if (k === 'schema') {
                //In case we encountered more scheme change
                // console.error('schema');
              }
              return k === 'decorations' || k === 'schema';
            }))
        );
      });
      const isLostFocus = change.operations.every(({ type, properties }) => {
        return type === 'set_selection' && properties && properties.isFocused === false;
      });
      if (isLostFocus) {
        AppEnv.logWarning(
          `draft ${this.props.draft &&
            this.props.draft
              .id} isLostFocus, ignore lost focus ${ignoreLostFocus}, last cycle lost focus ${
            this._lastCycleIgnoreLostFocus
          }`
        );
        if (ignoreLostFocus) {
          return;
        }
        if (this._lastCycleIgnoreLostFocus) {
          AppEnv.logWarning(
            `draft ${this.props.draft &&
              this.props.draft.id} isLostFocus, ignore lost focus because of last cycle`
          );
          this._lastCycleIgnoreLostFocus = false;
          return;
        }
      }
      this.props.session.changes.add({ bodyEditorState: change.value }, { skipSaving });
    }
    const focusBlock = change.value.focusBlock;
    if (focusBlock && focusBlock.type === BLOCK_CONFIG.div.type) {
      if (focusBlock.data && focusBlock.data.get('className') === 'gmail_quote_attribution') {
        AppEnv.logDebug(`Draft ${(this.props.draft || {}).id} in quote, showing quote`);
        this.setState({ quotedTextHidden: false });
      }
    }
  };

  _renderEditor() {
    return (
      <ComposerEditor
        ref={el => {
          if (el) {
            this._els[Fields.Body] = el;
          }
        }}
        className={this.state.quotedTextHidden ? 'hiding-quoted-text' : ''}
        propsForPlugins={{ draft: this.props.draft, session: this.props.session }}
        value={this.props.draft.bodyEditorState}
        onFileReceived={this._onFileReceived}
        onDrop={e => this._dropzone._onDrop(e)}
        onBlur={this._onEditorBlur}
        readOnly={this.props.session ? this.props.session.isPopout() : true}
        onChange={this._onEditorChange}
        onPasteHtmlHasFiles={this._onPasteHtmlHasFiles}
      />
    );
  }

  _renderFooterRegions() {
    return (
      <div className="composer-footer-region">
        <InjectedComponentSet
          deferred
          matching={{ role: 'Composer:Footer' }}
          exposedProps={{
            draft: this.props.draft,
            threadId: this.props.draft.threadId,
            messageId: this.props.draft.id,
            session: this.props.session,
          }}
          direction="column"
        />
      </div>
    );
  }

  _renderAttachments() {
    const { files } = this.props.draft;
    const nonImageFiles = files
      .filter(f => !Utils.shouldDisplayAsImage(f))
      .map(file => (
        <AttachmentItem
          key={file.id}
          className="file-upload"
          draggable={false}
          filePath={AttachmentStore.pathForFile(file)}
          displayName={file.filename}
          displaySize={file.displayFileSize()}
          fileIconName={`file-${file.extension}.png`}
          accountId={this.props.draft.accountId}
          onRemoveAttachment={() => {
            Actions.removeAttachment({
              messageId: this.props.draft.id,
              accountId: this.props.draft.accountId,
              fileToRemove: file,
            });
          }}
          onOpenAttachment={() => Actions.fetchAndOpenFile(file)}
        />
      ));
    const imageFiles = files
      .filter(f => Utils.shouldDisplayAsImage(f))
      .filter(f => !f.contentId)
      .map(file => (
        <AttachmentItem
          key={file.id}
          draggable={false}
          className="file-upload"
          filePath={AttachmentStore.pathForFile(file)}
          displayName={file.filename}
          isImage={true}
          accountId={this.props.draft.accountId}
          onRemoveAttachment={() => {
            Actions.removeAttachment({
              messageId: this.props.draft.id,
              accountId: this.props.draft.accountId,
              fileToRemove: file,
            });
          }}
          onOpenAttachment={() => Actions.fetchAndOpenFile(file)}
        />
      ));
    const nonInlineWithContentIdImageFiles = files
      .filter(f => Utils.shouldDisplayAsImage(f))
      .filter(f => f.contentId)
      .filter(f => {
        if (!this.props.draft || typeof this.props.draft.body !== 'string') {
          AppEnv.reportError(new Error(`draft data incorrect`), { errorData: this.props.draft });
          return false;
        }
        return (
          this.props.draft &&
          this.props.draft.body &&
          !this.props.draft.body.includes(`cid:${f.contentId}`)
        );
      })
      .map(file => (
        <AttachmentItem
          key={file.id}
          draggable={false}
          className="file-upload"
          filePath={AttachmentStore.pathForFile(file)}
          displayName={file.filename}
          isImage={true}
          accountId={this.props.draft.accountId}
          onRemoveAttachment={() => {
            Actions.removeAttachment({
              messageId: this.props.draft.id,
              accountId: this.props.draft.accountId,
              fileToRemove: file,
            });
          }}
          onOpenAttachment={() => Actions.fetchAndOpenFile(file)}
        />
      ));

    return (
      <div className="attachments-area">
        {nonImageFiles.concat(imageFiles, nonInlineWithContentIdImageFiles)}
      </div>
    );
  }

  _renderActionsWorkspaceRegion() {
    return (
      <InjectedComponentSet
        deferred
        matching={{ role: 'Composer:ActionBarWorkspace' }}
        exposedProps={{
          draft: this.props.draft,
          threadId: this.props.draft.threadId,
          messageId: this.props.draft.id,
          session: this.props.session,
        }}
      />
    );
  }

  _renderActionsRegion() {
    return (
      <div className="sendbar-for-dock">
        <div className="action-bar-wrapper">
          <div className="composer-action-bar-wrap" data-tooltips-anchor>
            <div className="tooltips-container" />
            <div className="composer-action-bar-content">
              <ActionBarPlugins draft={this.props.draft} session={this.props.session} />
              <SendActionButton
                ref={el => {
                  if (el) {
                    this._els.sendActionButton = el;
                  }
                }}
                tabIndex={-1}
                style={{ order: -52 }}
                draft={this.props.draft}
                messageId={this.props.draft.id}
                session={this.props.session}
                disabled={this.props.session.isPopout() || this._draftNotReady()}
              />
              <div className="divider-line" style={{ order: -51 }} />
              <button
                tabIndex={-1}
                className="btn btn-toolbar btn-attach"
                style={{ order: -50 }}
                title="Attach file"
                onClick={this._onSelectAttachment.bind(this, { type: 'notInline' })}
                disabled={this._draftNotReady()}
              >
                <RetinaImg
                  name={'attachments.svg'}
                  style={{ width: 24, height: 24, fontSize: 24 }}
                  isIcon
                  mode={RetinaImg.Mode.ContentIsMask}
                />
              </button>
              <button
                tabIndex={-1}
                className="btn btn-toolbar btn-attach"
                style={{ order: -49 }}
                title="Insert photo"
                onClick={this._onSelectAttachment.bind(this, { type: 'image' })}
                disabled={this._draftNotReady()}
              >
                <RetinaImg
                  name={'inline-image.svg'}
                  style={{ width: 24, height: 24, fontSize: 24 }}
                  isIcon
                  mode={RetinaImg.Mode.ContentIsMask}
                />
              </button>
              <div className="divider-line" style={{ order: 10 }} />
              <button
                tabIndex={-1}
                className="btn btn-toolbar btn-trash"
                style={{ order: 40 }}
                title="Delete draft"
                onClick={this._onDestroyDraft}
                disabled={this._draftNotReady()}
              >
                {this.state.isDeleting ? (
                  <LottieImg name={'loading-spinner-blue'} size={{ width: 24, height: 24 }} />
                ) : (
                  <RetinaImg
                    name={'trash.svg'}
                    style={{ width: 24, height: 24, fontSize: 24 }}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask}
                  />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
        <div className="wrapper-space"></div>
      </div>
    );
  }

  // This lets us click outside of the `contenteditable`'s `contentBody`
  // and simulate what happens when you click beneath the text *in* the
  // contentEditable.

  // Unfortunately, we need to manually keep track of the "click" in
  // separate mouseDown, mouseUp events because we need to ensure that the
  // start and end target are both not in the contenteditable. This ensures
  // that this behavior doesn't interfear with a click and drag selection.
  _onMouseDownComposerBody = event => {
    if (
      this._els[Fields.Body] &&
      ReactDOM.findDOMNode(this._els[Fields.Body]) &&
      ReactDOM.findDOMNode(this._els[Fields.Body]).contains(event.target)
    ) {
      this._mouseDownTarget = null;
    } else {
      this._mouseDownTarget = event.target;
    }
  };

  _inFooterRegion(el) {
    return el.closest && el.closest('.composer-footer-region');
  }
  _inSendBarRegion(el) {
    return el && el.closest && el.closest('.sendbar-for-dock');
  }

  _onMouseUpComposerBody = event => {
    if (
      event.target === this._mouseDownTarget &&
      !this._inSendBarRegion(event.target) &&
      this._els[Fields.Body] &&
      ReactDOM.findDOMNode(this._els[Fields.Body])
    ) {
      // We don't set state directly here because we want the native
      // contenteditable focus behavior. When the contenteditable gets focused
      const bodyRect = ReactDOM.findDOMNode(this._els[Fields.Body]).getBoundingClientRect();
      if (event.pageY < bodyRect.top) {
        this._els[Fields.Body].focus();
      } else if (this._els[Fields.Body]) {
        if (this.state.quotedTextHidden) {
          this._els[Fields.Body].focusEndReplyText();
        } else {
          this._els[Fields.Body].focusEndAbsolute();
        }
      }
    }
    this._mouseDownTarget = null;
  };

  _shouldAcceptDrop = event => {
    // Ensure that you can't pick up a file and drop it on the same draft
    const nonNativeFilePath = this._nonNativeFilePathForDrop(event);

    const hasNativeFile = event.dataTransfer.types && event.dataTransfer.types.includes('Files');
    const hasNonNativeFilePath = nonNativeFilePath !== null;

    return hasNativeFile || hasNonNativeFilePath;
  };

  _nonNativeFilePathForDrop = event => {
    if (event.dataTransfer.types && event.dataTransfer.types.includes('text/nylas-file-url')) {
      const downloadURL = event.dataTransfer.getData('text/nylas-file-url');
      const downloadFilePath = downloadURL.split('file://')[1];
      if (downloadFilePath) {
        return downloadFilePath;
      }
    }

    // Accept drops of images from within the app
    if (event.dataTransfer.types && event.dataTransfer.types.includes('text/uri-list')) {
      const uri = event.dataTransfer.getData('text/uri-list');
      if (uri.indexOf('file://') === 0) {
        return decodeURI(uri.split('file://')[1]);
      }
    }
    return null;
  };

  _onDrop = event => {
    // Accept drops of real files from other applications
    for (const file of Array.from(event.dataTransfer.files)) {
      this._onFileReceived(file.path);
      event.preventDefault();
    }

    // Accept drops from attachment components / images within the app
    const uri = this._nonNativeFilePathForDrop(event);
    if (uri) {
      this._onFileReceived(uri);
      event.preventDefault();
    }
  };

  _onAttachmentsCreated = fileObjs => {
    if (!this._mounted) return;
    if (!Array.isArray(fileObjs) || fileObjs.length === 0) {
      return;
    }
    const { draft, session } = this.props;
    const inlineFile = [];
    for (let i = 0; i < fileObjs.length; i++) {
      const fileObj = fileObjs[i];
      if (Utils.shouldDisplayAsImage(fileObj)) {
        const match = draft.files.find(f => f.id === fileObj.id);
        if (!match) {
          return;
        }
        inlineFile.push(fileObj);
        // match.contentId = Utils.generateContentId();
        // match.isInline = true;
        // session.updateAttachments([].concat(draft.files));
        // session.changes.add({
        //   files: [].concat(draft.files),
        // });
      }
    }
    if (inlineFile.length > 0) {
      if (this._els[Fields.Body]) {
        console.log(`update attachment in _onAttachmentsCreated`);
        this._els[Fields.Body].insertInlineAttachments(inlineFile);
      }
      session.changes.commit();
    }
  };

  _onAttachmentCreated = fileObj => {
    if (!this._mounted) return;
    if (Utils.shouldDisplayAsImage(fileObj)) {
      const { draft, session } = this.props;
      const match = draft.files.find(f => f.id === fileObj.id);
      console.log(`update attachment in _onAttachmentCreated`);
      if (!match) {
        return;
      }
      // match.contentId = Utils.generateContentId();
      // match.isInline = true;
      // session.updateAttachments([].concat(draft.files));
      // session.changes.add({
      //   files: [].concat(draft.files),
      // });
      if (this._els[Fields.Body]) {
        this._els[Fields.Body].insertInlineAttachment(fileObj);
      }
      session.changes.commit();
    }
  };

  _onFileReceived = filePath => {
    // called from onDrop and onFilePaste - assume images should be inline
    Actions.addAttachment({
      filePath: filePath,
      messageId: this.props.draft.id,
      accountId: this.props.draft.accountId,
      onCreated: this._onAttachmentCreated,
    });
  };
  _onPasteHtmlHasFiles = newFiles => {
    const newAttachments = newFiles.map(f => {
      return new File(
        Object.assign({}, f, {
          messageId: this.props.draft.id,
          accountId: this.props.draft.accountId,
        })
      );
    });
    Actions.bulkUpdateDraftFiles({
      messageId: this.props.draft.id,
      newFiles: newAttachments,
    });
  };

  _onPrimarySend = ({ disableDraftCheck = false } = {}) => {
    this._els.sendActionButton.primarySend({ disableDraftCheck });
  };
  _timoutButton = () => {
    if (!this._deleteTimer) {
      this._deleteTimer = setTimeout(() => {
        if (this._mounted) {
          this.setState({ isDeleting: false });
        }
        this._deleteTimer = null;
      }, buttonTimer);
    }
  };

  _onDestroyedDraftProcessed = ({ messageIds }) => {
    if (!this.props.draft) {
      return;
    }
    if (messageIds.includes(this.props.draft.id)) {
      if (this._deleteTimer) {
        return;
      }
      this._deleteTimer = setTimeout(() => {
        if (this._mounted) {
          this.setState({ isDeleting: false });
        }
        this._deleteTimer = null;
      }, buttonTimer);
    }
  };

  _onDestroyDraft = () => {
    if (this.props.session.isPopout()) {
      Actions.focusHighestLevelDraftWindow(this.props.draft.id, this.props.draft.threadId);
      return;
    }
    if (!this.state.isDeleting && !this._deleteTimer) {
      this._timoutButton();
      this.setState({ isDeleting: true });
      Actions.destroyDraft([this.props.draft], { source: 'composerView:_onDestroyDraft' });
    }
  };

  _onSelectAttachment = ({ type = 'image' }) => {
    if (this.props.session.isPopout()) {
      Actions.focusHighestLevelDraftWindow(this.props.draft.id, this.props.draft.threadId);
      return;
    }
    if (type === 'image') {
      Actions.selectAttachment({
        messageId: this.props.draft.id,
        accountId: this.props.draft.accountId,
        onCreated: fileObjs => {
          if (Array.isArray(fileObjs)) {
            this._onAttachmentsCreated(fileObjs);
          } else {
            this._onAttachmentCreated(fileObjs);
          }
        },
        type,
      });
    } else {
      Actions.selectAttachment({
        messageId: this.props.draft.id,
        accountId: this.props.draft.accountId,
        type,
      });
    }
  };

  render() {
    const dropCoverDisplay = this.state.isDropping ? 'block' : 'none';
    const isComposerWindow = AppEnv.isComposerWindow();
    return (
      <div className={this.props.className}>
        <KeyCommandsRegion
          localHandlers={this._keymapHandlers}
          className={'message-item-white-wrap focused composer-outer-wrap'}
          ref={el => {
            if (el) {
              this._els.composerWrap = el;
            }
          }}
          tabIndex="-1"
        >
          <TabGroupRegion className="composer-inner-wrap">
            <DropZone
              ref={cm => (this._dropzone = cm)}
              className="composer-inner-wrap"
              shouldAcceptDrop={this._shouldAcceptDrop}
              onDragStateChange={({ isDropping }) => this.setState({ isDropping })}
              onDrop={this._onDrop}
            >
              <div className="composer-drop-cover" style={{ display: dropCoverDisplay }}>
                <div className="centered">
                  <RetinaImg
                    name="composer-drop-to-attach.png"
                    mode={RetinaImg.Mode.ContentIsMask}
                  />
                  Drop to attach
                </div>
              </div>

              <div className="composer-content-wrap">{this._renderContentScrollRegion()}</div>

              <div className="composer-action-bar-workspace-wrap">
                {this._renderActionsWorkspaceRegion()}
              </div>
            </DropZone>
          </TabGroupRegion>
          {!isComposerWindow && this._renderActionsRegion()}
        </KeyCommandsRegion>
      </div>
    );
  }
}
