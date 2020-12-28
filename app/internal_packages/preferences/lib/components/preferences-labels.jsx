import React from 'react';
import { AccountStore, CategoryStore, Actions, DestroyCategoryTask } from 'mailspring-exports';
import {
  Table,
  TableCell,
  ButtonDropdown,
  Menu,
  RetinaImg,
  LabelPopover,
} from 'mailspring-component-kit';
import LabelsDataSource from '../../../../src/components/LabelsDataSource';

class PreferencesLabels extends React.Component {
  static displayName = 'PreferencesBlockedSenders';

  constructor(props) {
    super(props);
    const accounts = AccountStore.accounts().filter(account => {
      return account && (account.provider === 'gmail' || account.provider === 'onmail');
    });
    const selectedAccount = accounts.length > 0 ? accounts[0] : null;
    this.state = {
      selectedAccount,
      accounts,
      labelsDataSource: this._setupDataSource(selectedAccount),
      tableHeight: 550,
    };
    this._creatingLabelTimer = null;
    this._unsubscribe = [];
    this._mounted = false;
    this._tableRef = null;
  }

  componentDidMount() {
    this._mounted = true;
    this._unsubscribe = [
      AccountStore.listen(this._onAccountChange),
      CategoryStore.listen(this._onCategoriesChange),
    ];
    window.addEventListener('resize', this._onTableResize);
    this._onTableResize();
  }

  componentWillUnmount() {
    this._mounted = false;
    for (let unsub of this._unsubscribe) {
      unsub();
    }
    window.removeEventListener('resize', this._onTableResize);
  }

  _setupDataSource = selectedAccount => {
    let labelsDataSource = null;
    if (selectedAccount) {
      const categories = CategoryStore.userCategories(selectedAccount).filter(cat => {
        return cat.selectable;
      });
      labelsDataSource = new LabelsDataSource({
        labels: categories,
        keys: [
          { dataKey: 'displayName', displayName: 'Label Name' },
          { dataKey: 'isHidden', displayName: 'Show in menu?' },
          { dataKey: 'id', displayName: '' },
        ],
      });
    }
    return labelsDataSource;
  };
  _showHideLabel = ({ catId, show }) => {
    const cat = CategoryStore.byFolderId(catId);
    if (cat) {
      if (show) {
        CategoryStore.showCategoryInFolderTree({ accountId: cat.accountId, id: cat.path });
      } else {
        CategoryStore.hideCategoryInFolderTree({ accountId: cat.accountId, id: cat.path });
      }
    }
  };
  _renderLabelName = rowIndex => {
    return (
      <TableCell isHeader={false}>
        {this.state.labelsDataSource.cellAt({ rowIdx: rowIndex, colIdx: 0 })}
      </TableCell>
    );
  };
  _renderToggleControl = rowIndex => {
    const isHidden = this.state.labelsDataSource.cellAt({ rowIdx: rowIndex, colIdx: 1 });
    const folderId = this.state.labelsDataSource.cellAt({ rowIdx: rowIndex, colIdx: 2 });
    return (
      <TableCell isHeader={false}>
        <span
          className={`label-pill ${isHidden ? '' : ' pill-selected '}`}
          onClick={this._showHideLabel.bind(this, { catId: folderId, show: true })}
        >
          show
        </span>
        <span
          className={`label-pill ${isHidden ? ' pill-selected ' : ''}`}
          onClick={this._showHideLabel.bind(this, { catId: folderId, show: false })}
        >
          hide
        </span>
      </TableCell>
    );
  };
  _renderEditControls = rowIndex => {
    const categoryId = this.state.labelsDataSource.cellAt({ rowIdx: rowIndex, colIdx: 2 });
    const category = CategoryStore.byFolderId(categoryId);
    return (
      <TableCell isHeader={false}>
        <span className="label-pill pill-selected" onClick={this._onEditLabel.bind(this, category)}>
          Edit
        </span>
        <span className="close" onClick={this._onDestroyLabel.bind(this, category)}>
          <RetinaImg name="closeCircle.svg" isIcon={true} mode={RetinaImg.Mode.ContentIsMask} />
        </span>
      </TableCell>
    );
  };
  _renderCell = data => {
    if (data.isHeader) {
      return TableCell(data);
    }
    if (data.colIdx === 0) {
      return this._renderLabelName(data.rowIdx);
    }
    if (data.colIdx === 1) {
      return this._renderToggleControl(data.rowIdx);
    }
    return this._renderEditControls(data.rowIdx);
  };
  _onCategoriesChange = () => {
    this.setState({
      labelsDataSource: this._setupDataSource(this.state.selectedAccount),
    });
  };
  _onAccountChange = () => {
    if (!this._mounted) {
      return;
    }
    const state = {
      accounts: AccountStore.accounts().filter(account => {
        return account && (account.provider === 'gmail' || account.provider === 'onmail');
      }),
    };
    if (this.state.selectedAccount) {
      const account = AccountStore.accountForId(this.state.selectedAccount);
      if (!account) {
        state.selectedAccount = null;
      }
    }
    this.setState(state);
  };
  _onTableResize = () => {
    if (!this._tableRef) {
      return;
    }
    const box = this._tableRef.getBoundingClientRect();
    this.setState({ tableHeight: box.height - 40 });
  };
  _renderLabelsTable = () => {
    if (this.state.labelsDataSource) {
      return (
        <Table
          className="labels-table"
          displayHeader={true}
          rowHeight={40}
          bodyHeight={this.state.tableHeight}
          tableRefCallback={ref => (this._tableRef = ref)}
          tableDataSource={this.state.labelsDataSource}
          CellRenderer={this._renderCell}
        />
      );
    } else {
      return null;
    }
  };
  _onSelectAccount = account => {
    if (!this._mounted) {
      return;
    }
    this.setState({ selectedAccount: account, labelsDataSource: this._setupDataSource(account) });
  };

  _renderAccountSelection = () => {
    const menu = (
      <Menu
        className="labels-menu"
        items={this.state.accounts}
        itemKey={account => account.id || account.pid}
        itemContent={account => account.emailAddress}
        onSelect={this._onSelectAccount}
      />
    );
    return (
      <div className="account-selection">
        <span className="label">Account: </span>
        <ButtonDropdown
          className="dropdown-menu"
          closeOnMenuClick={true}
          primaryItem={this.state.selectedAccount.emailAddress}
          menu={menu}
        />
      </div>
    );
  };
  _onClosePopOver = () => {
    Actions.closePopover();
  };
  _onLabelCreated = () => {
    if (this._creatingLabelTimer) {
      clearTimeout(this._creatingLabelTimer);
    }
    this.setState({ creatingLabel: false });
  };
  _onCreateLabel = () => {
    this._creatingLabelTimer = setTimeout(this._onLabelCreated, 5000);
    Actions.openPopover(
      <LabelPopover
        account={this.state.selectedAccount}
        name={''}
        isNew={true}
        onCancel={this._onClosePopOver}
        onActionCallback={this._onLabelCreated}
      />,
      {
        isFixedToWindow: true,
        originRect: {
          top: 0,
          left: 0,
        },
        position: { top: '13%', left: '49%' },
        disablePointer: true,
        closeOnAppBlur: false,
      }
    );
  };
  _onEditLabel = category => {
    if (!category) {
      return;
    }
    this._creatingLabelTimer = setTimeout(this._onLabelCreated, 5000);
    Actions.openPopover(
      <LabelPopover
        account={this.state.selectedAccount}
        name={category.name}
        isNew={false}
        originalBgColor={category.bgColor}
        onCancel={this._onClosePopOver}
        onActionCallback={this._onLabelCreated}
      />,
      {
        isFixedToWindow: true,
        originRect: {
          top: 0,
          left: 0,
        },
        position: { top: '13%', left: '49%' },
        disablePointer: true,
        closeOnAppBlur: false,
      }
    );
  };
  _onDestroyLabel = label => {
    if (!label) {
      return;
    }
    AppEnv.showMessageBox({
      title: 'Remove Label?',
      showInMainWindow: true,
      detail: 'This will only remove label from messages, messages will not be deleted.',
      buttons: ['Proceed', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    }).then(({ response } = {}) => {
      if (response !== 0) {
        AppEnv.logDebug(`Removing Label in Preference canceled, user clicked cancel`);
        return;
      }
      const task = new DestroyCategoryTask(
        Object.assign({}, label, { source: 'Preference Delete' })
      );
      Actions.queueTask(task);
    });
  };

  _renderAddNewLabel() {
    return (
      <button
        className={`btn btn-toolbar add-label `}
        title="New Label"
        onClick={this._onCreateLabel}
      >
        <RetinaImg
          name="add.svg"
          style={{ width: 20, height: 20 }}
          isIcon={true}
          mode={RetinaImg.Mode.ContentIsMask}
        />
        <span>New Label</span>
      </button>
    );
  }

  render() {
    return (
      <div className="container-labels">
        <div className="config-group labels-group">
          <h6>MANAGE LABELS</h6>
          <div className="labels-description">
            Manage your list of labels and decide what&apos;s shown in your menu list. Note: Labels
            are only available in some accounts. Removing a label won&apos;t remove messages with
            that label.
          </div>
          <div className="labels-controls">
            {this._renderAccountSelection()}
            {this._renderAddNewLabel()}
          </div>
        </div>
        {this._renderLabelsTable()}
      </div>
    );
  }
}

export default PreferencesLabels;
