import CreateNewFolderPopover from './create-new-folder-popover';

const { Actions, React, PropTypes, AccountStore, WorkspaceStore } = require('mailspring-exports');

const { RetinaImg, KeyCommandsRegion } = require('mailspring-component-kit');
const MovePickerPopover = require('./move-picker-popover').default;
const LabelPickerPopover = require('./label-picker-popover').default;

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
    };
  }

  // If the threads we're picking categories for change, (like when they
  // get their categories updated), we expect our parents to pass us new
  // props. We don't listen to the DatabaseStore ourselves.
  componentWillReceiveProps(nextProps) {
    this._account = AccountStore.accountForItems(nextProps.items);
  }

  _onOpenLabelsPopover = () => {
    if (!(this.props.items.length > 0)) {
      return;
    }
    if (this.context.sheetDepth !== WorkspaceStore.sheetStack().length - 1) {
      return;
    }
    Actions.openPopover(<LabelPickerPopover threads={this.props.items} account={this._account}/>, {
      originRect: this._labelEl.getBoundingClientRect(),
      direction: 'down',
    });
  };
  _onCreateFolder = () => {
    this.setState({ createFolderPopoverVisible: true, moveFolderPopoutVisible: false });
  };
  _onCancelCreate = () => {
    this.setState({ createFolderPopoverVisible: false });
  };

  _onOpenMovePopover = () => {
    if (!(this.props.items.length > 0)) {
      return;
    }
    if (this.context.sheetDepth !== WorkspaceStore.sheetStack().length - 1) {
      return;
    }
    this.setState({ moveFolderPopoutVisible: true });
  };
  _onCloseMoveFolderPopout = ()=>{
    this.setState({moveFolderPopoutVisible: false});
  }

  render() {
    if (!this._account) {
      return <span/>;
    }

    const handlers = {
      'core:change-folders': this._onOpenMovePopover,
    };
    if (this._account.usesLabels()) {
      Object.assign(handlers, {
        'core:change-labels': this._onOpenLabelsPopover,
      });
    }

    return (
      <div className="button-group" style={{ order: -108 }}>
        <KeyCommandsRegion globalHandlers={handlers}>
          <button
            tabIndex={-1}
            ref={el => (this._moveEl = el)}
            title={'Move to Folder'}
            onClick={this._onOpenMovePopover}
            className={'btn btn-toolbar btn-category-picker'}
          >
            <RetinaImg name={'folder.svg'} style={{ width: 26, height: 26 }} isIcon
                       mode={RetinaImg.Mode.ContentIsMask}/>
          </button>
          {this._account.usesLabels() && (
            <button
              tabIndex={-1}
              ref={el => (this._labelEl = el)}
              title={'Apply Labels'}
              onClick={this._onOpenLabelsPopover}
              className={'btn btn-toolbar btn-category-picker'}
            >
              <RetinaImg name={'label.svg'} style={{ width: 26, height: 26 }} isIcon
                         mode={RetinaImg.Mode.ContentIsMask}/>
            </button>
          )}
        </KeyCommandsRegion>
        {this.state.createFolderPopoverVisible ?
          <CreateNewFolderPopover
            threads={this.props.items}
            account={this._account}
            onCancel={this._onCancelCreate}/> : null}
        {this.state.moveFolderPopoutVisible ?
          <MovePickerPopover threads={this.props.items}
                             account={this._account}
                             originEl={this._moveEl ? this._moveEl.getBoundingClientRect() : null}
                             onClose={this._onCloseMoveFolderPopout}
                             onCreate={this._onCreateFolder}/> : null}
      </div>
    );
  }
}

module.exports = MovePicker;
