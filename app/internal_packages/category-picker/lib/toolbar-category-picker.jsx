import CreateNewFolderPopover from './create-new-folder-popover';
import CreateNewLabelPopover from './create-new-label-popover';

const {
  Actions,
  React,
  PropTypes,
  AccountStore,
  WorkspaceStore,
  Folder,
  CategoryStore,
} = require('mailspring-exports');

const { RetinaImg, KeyCommandsRegion } = require('mailspring-component-kit');
const MovePickerPopover = require('./move-picker-popover').default;
const LabelPickerPopover = require('./label-picker-popover').default;
const threadSelectionScope = (props, selection) => {
  let threads = props.items;
  if (selection && WorkspaceStore.layoutMode() !== 'list') {
    const selectionThreads = selection.items();
    if (selectionThreads && selectionThreads.length > 0) {
      threads = selectionThreads;
    }
  }
  return threads;
};
// This sets the folder / label on one or more threads.
class MovePicker extends React.Component {
  static displayName = 'MovePicker';
  static containerRequired = false;

  static propTypes = { items: PropTypes.array };
  static contextTypes = { sheetDepth: PropTypes.number };

  constructor(props) {
    super(props);
    this._account = AccountStore.accountForItems(this.props.items);
    this.state = {
      createFolderPopoverVisible: false,
      moveFolderPopoutVisible: false,
      isFolder: CategoryStore.getInboxCategory(this._account) instanceof Folder,
    };
  }

  // If the threads we're picking categories for change, (like when they
  // get their categories updated), we expect our parents to pass us new
  // props. We don't listen to the DatabaseStore ourselves.
  UNSAFE_componentWillReceiveProps(nextProps) {
    this._account = AccountStore.accountForItems(nextProps.items);
  }

  _shouldResponse = (event, next) => {
    const inThreadList = this.props.position === 'threadList';
    const inMessageList = this.props.position === 'messageList';
    if (!inThreadList && !inMessageList) {
      return;
    }
    const topSheet = WorkspaceStore.topSheet();
    const threadListAnchor = document.querySelector('#moreButtonthreadList');
    if (WorkspaceStore.layoutMode() === 'list') {
      if (topSheet && (topSheet.id === 'Thread' || topSheet.id === 'Sift') && !inMessageList) {
        return;
      }
      if (topSheet && topSheet.id === 'Threads' && !inThreadList) {
        return;
      }
      if (inMessageList) {
        next();
      } else if (threadListAnchor && inThreadList) {
        next(null, threadListAnchor, threadSelectionScope(this.props, this.selection));
      }
    } else {
      if (inMessageList && threadListAnchor) {
        return;
      }
      if (!threadListAnchor) {
        next(null);
      } else {
        next(null, threadListAnchor, threadSelectionScope(this.props, this.selection));
      }
    }
  };

  _onShortcutOpenLabelsPopover = event => {
    this._shouldResponse(event, this._onOpenLabelsPopover);
  };
  _onThreadListOpenLabelsPopover = event => {
    const inThreadList = this.props.position === 'threadList';
    const threadListAnchor = document.querySelector('#moreButtonthreadList');
    if (!threadListAnchor || !inThreadList) {
      return;
    }
    this._onOpenLabelsPopover(null, threadListAnchor, threadSelectionScope(this.props, this.selection));
  };
  _onMessageListOpenLabelsPopover = event => {
    const inMessageList = this.props.position === 'messageList';
    if (!inMessageList) {
      return;
    }
    if (event.preventDefault) {
      event.preventDefault();
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    this._onOpenLabelsPopover(event);
  };
  _onActionCallBack = ({ type = '', data }) => {
    if (typeof this.props.onActionCallback === 'function') {
      this.props.onActionCallback({ type, data });
    }
  };

  _onLabelsChange = data => {
    this._onActionCallBack({ type: 'labelChange', data });
  };

  _onFolderChange = data => {
    this._onActionCallBack({ type: 'folderChange', data });
  };

  _onOpenLabelsPopover = (event, anchorEl, threads) => {
    if (!threads && !(this.props.items.length > 0)) {
      return;
    }
    if (this.context.sheetDepth !== WorkspaceStore.sheetStack().length - 1) {
      return;
    }
    let originRect;
    if (event && event.detail && event.detail.getBoundingClientRect) {
      originRect = event.detail.getBoundingClientRect();
    } else if (event && event.target && event.target.getBoundingClientRect) {
      originRect = event.target.getBoundingClientRect();
    } else if (anchorEl) {
      originRect = anchorEl.getBoundingClientRect();
    } else if (this._labelEl && this._labelEl.getBoundingClientRect) {
      if (this._labelEl.getBoundingClientRect().left === 0) {
        const moreEl = document.querySelector('#threadToolbarMoreButtonmessageList');
        if (!moreEl) {
          if (this._labelEl) {
            originRect = this._labelEl.getBoundingClientRect();
          }
        } else {
          originRect = moreEl.getBoundingClientRect();
        }
      } else if (this._labelEl) {
        originRect = this._labelEl.getBoundingClientRect();
      }
    }
    if (!originRect) {
      AppEnv.reportError(new Error('Can not get anchor element for Label picker'));
      return;
    }
    Actions.openPopover(
      <LabelPickerPopover
        threads={Array.isArray(threads) ? threads : this.props.items}
        account={this._account}
        onCreate={this._onCreateLabel}
        onActionCallback={this._onLabelsChange}
      />,
      {
        originRect,
        direction: 'up',
        disablePointer: true,
      }
    );
  };
  _onCreateLabel = (data, isMoveAction) => {
    Actions.openPopover(
      <CreateNewLabelPopover
        threads={this.props.items}
        account={this._account}
        currentPerspective={this.props.currentPerspective}
        name={data}
        isMoveAction={isMoveAction}
        onCancel={this._onCancelCreate}
        onActionCallback={this._onLabelsChange}
      />,
      {
        isFixedToWindow: true,
        originRect: this._labelEl ? this._labelEl.getBoundingClientRect() : {},
        position: { top: '13%', left: '49%' },
        disablePointer: true,
      }
    );
  };
  _onCreateFolder = data => {
    Actions.openPopover(
      <CreateNewFolderPopover
        threads={this.props.items}
        account={this._account}
        currentPerspective={this.props.currentPerspective}
        defaultValue={data}
        onCancel={this._onCancelCreate}
        onActionCallback={this._onFolderChange}
      />,
      {
        isFixedToWindow: true,
        originRect: this._moveEl.getBoundingClientRect(),
        position: { top: '13%', left: '49%' },
        disablePointer: true,
      }
    );
  };
  _onCancelCreate = () => {
    Actions.closePopover();
  };

  _onMessageListOpenMovePopover = event => {
    if (event.preventDefault) {
      event.preventDefault();
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    }
    const inMessageList = this.props.position === 'messageList';
    if (!inMessageList) {
      return;
    }
    this._onOpenMovePopover(event);
  };

  _onThreadListOpenMovePopover = event => {
    const inThreadList = this.props.position === 'threadList';
    let threadListAnchor = document.querySelector('#moreButtonthreadList');
    if (!inThreadList || !threadListAnchor) {
      return;
    }
    this._onOpenMovePopover(null, threadListAnchor, threadSelectionScope(this.props, this.selection));
  };

  _onShortcutOpenMovePopover = event => {
    this._shouldResponse(event, this._onOpenMovePopover);
  };

  _onOpenMovePopover = (event, anchorEl, threads) => {
    if (!(this.props.items.length > 0)) {
      return;
    }
    if (this.context.sheetDepth !== WorkspaceStore.sheetStack().length - 1) {
      return;
    }
    let originRect;
    if (event && event.detail && event.detail.getBoundingClientRect) {
      console.error('detail bounding');
      originRect = event.detail.getBoundingClientRect();
    } else if (event && event.target && event.target.getBoundingClientRect) {
      console.error('target bounding');
      originRect = event.target.getBoundingClientRect();
    } else if (anchorEl && anchorEl.getBoundingClientRect) {
      console.error('just bounding');
      originRect = anchorEl.getBoundingClientRect();
    } else if (this._moveEl && this._moveEl.getBoundingClientRect) {
      if (this._moveEl.getBoundingClientRect().left === 0) {
        const moreEl = document.querySelector('#threadToolbarMoreButtonmessageList');
        if (!moreEl) {
          originRect = this._moveEl.getBoundingClientRect();
        } else {
          originRect = moreEl.getBoundingClientRect();
        }
      } else {
        originRect = this._moveEl.getBoundingClientRect();
      }
    } else {
      AppEnv.reportError(new Error('Can not get anchor element for Move picker'));
      return;
    }
    const onCreate = this.state.isFolder ? this._onCreateFolder : this._onCreateLabel;
    Actions.openPopover(
      <MovePickerPopover
        threads={Array.isArray(threads) ? threads : this.props.items}
        account={this._account}
        onClose={this._onCloseMoveFolderPopout}
        onCreate={onCreate}
        onActionCallback={this._onFolderChange}
      />,
      {
        originRect: originRect,
        direction: 'down',
        disablePointer: true,
      }
    );
  };
  _onCloseMoveFolderPopout = () => {
    Actions.closePopover();
  };

  render() {
    if (!this._account) {
      return <span />;
    }

    const handlers = {
      'core:change-folders': this._onShortcutOpenMovePopover,
      'core:change-folders-list': this._onThreadListOpenMovePopover,
      'core:change-folders-message': this._onMessageListOpenMovePopover,
    };
    if (this._account.usesLabels()) {
      Object.assign(handlers, {
        'core:change-labels': this._onShortcutOpenLabelsPopover,
        'core:change-labels-list': this._onThreadListOpenLabelsPopover,
        'core:change-labels-message': this._onMessageListOpenLabelsPopover,
      });
    }

    return (
      <div className="button-group move-picker" style={{ order: -108 }}>
        <KeyCommandsRegion globalHandlers={handlers}>
          <button
            id={`movePickerFolder${this.props.position}`}
            tabIndex={-1}
            ref={el => (this._moveEl = el)}
            title={'Move to Folder'}
            onClick={this._onOpenMovePopover}
            className={'btn btn-toolbar btn-category-picker'}
          >
            <RetinaImg
              name={'folder.svg'}
              style={{ width: 24, height: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </button>
          {this._account.usesLabels() && (
            <button
              id={`movePickerLabel${this.props.position}`}
              tabIndex={-1}
              ref={el => (this._labelEl = el)}
              title={'Apply Labels'}
              onClick={this._onOpenLabelsPopover}
              className={'btn btn-toolbar btn-category-picker'}
            >
              <RetinaImg
                name={'label.svg'}
                style={{ width: 24, height: 24 }}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
              />
            </button>
          )}
        </KeyCommandsRegion>
      </div>
    );
  }
}

module.exports = MovePicker;
