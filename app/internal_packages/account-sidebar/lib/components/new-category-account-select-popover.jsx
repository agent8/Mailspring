import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { RetinaImg, ButtonDropdown, Menu } from 'mailspring-component-kit';
import { Actions } from 'mailspring-exports';
import SidebarActions from '../sidebar-actions';
class NewCategoryAccountSelectPopover extends Component {
  static displayName = 'NewCategoryAccountSelectPopover';
  static propTypes = {
    accounts: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
      })
    ),
  };
  constructor(props) {
    super(props);
    this.state = { selectedAccount: this.props.accounts[0] };
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
  }
  componentWillUnmount() {
    this._mounted = false;
  }
  _onCancel = e => {
    e.stopPropagation();
    SidebarActions.cancelAddFolderRequest();
    Actions.closePopover();
  };
  _onCreateNew = e => {
    e.stopPropagation();
    if (this.state.selectedAccount) {
      SidebarActions.addingNewFolderToAccount({ accountId: this.state.selectedAccount.id });
    }
    Actions.closePopover(() => {});
  };
  _onSelectAccount = account => {
    this.setState({ selectedAccount: account });
  };
  _renderSelected = () => {
    if (!this.state.selectedAccount) {
      return <div />;
    }
    return (
      <div className="primary-item item">
        <span>{this.state.selectedAccount.label || this.state.selectedAccount.emailAddress}</span>
        <RetinaImg name="down-arrow.svg" isIcon={true} mode={RetinaImg.Mode.ContentIsMask} />
      </div>
    );
  };
  renderAccounts() {
    const menu = (
      <Menu
        items={this.props.accounts}
        itemKey={account => account.id || account.pid}
        itemContent={account => account.label || account.emailAddress}
        onSelect={this._onSelectAccount}
      />
    );
    return (
      <div className="sidebar-add-folder-account-selector-container">
        <ButtonDropdown
          className="sidebar-add-folder-account-selector"
          closeOnMenuClick={true}
          primaryItem={this._renderSelected()}
          disableDropdownArrow={true}
          menu={menu}
        />
      </div>
    );
  }
  renderButtons() {
    return (
      <div className="button-row">
        <button className="create-folder-btn-cancel" title="Cancel" onClick={this._onCancel}>
          <span>Cancel</span>
        </button>
        <button className="create-folder-btn-create" title="Create New" onClick={this._onCreateNew}>
          Create New
        </button>
      </div>
    );
  }
  render() {
    let text = 'New Folder';
    let subtext = 'Where does this folder belong?';
    if (
      this.props.accounts.every(account => {
        return account && (account.provider === 'gmail' || account.provider === 'onmail');
      })
    ) {
      text = 'New Label';
      subtext = 'Where does this label belong?';
    }
    return (
      <div ref={el => (this.container = el)} className="create-folder-container">
        <div className={'header-row'}>
          <span className="close" onClick={this._onCancel}>
            <RetinaImg
              name="close_1.svg"
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
              style={{ width: 20, height: 20 }}
            />
          </span>
        </div>
        <div className="header-text-container">
          <div className="header-text">{text}</div>
          <div className="header-subtext">{subtext}</div>
        </div>
        {this.renderAccounts()}
        {this.renderButtons()}
      </div>
    );
  }
}

export default NewCategoryAccountSelectPopover;
