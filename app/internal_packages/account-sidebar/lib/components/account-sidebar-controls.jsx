import React from 'react';
import { Actions } from 'mailspring-exports';

export default class AccountSidebarControls extends React.Component {
  static displayName = 'AccountSidebarControls';
  constructor(props) {
    super(props);
    this.state = { inEditMode: false };
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
    this._unlistener = [Actions.setEditingMenu.listen(this._onEditingMenuChange, this)];
  }
  componentWillUnmount() {
    this._mounted = false;
    for (let unlisten of this._unlistener) {
      unlisten();
    }
  }

  _onEditingMenuChange = inEditMode => {
    if (!this._mounted) {
      return;
    }
    if (inEditMode !== this.state.inEditMode) {
      this.setState({ inEditMode });
    }
  };

  _cancelEditMenu = () => {
    Actions.setEditingMenu(false);
    Actions.cancelCategoryMeteDataChange();
  };
  _saveMenuEdit = () => {
    Actions.setEditingMenu(false);
    Actions.saveCategoryMetaDataChange();
  };
  render() {
    if (!this.state.inEditMode) {
      return null;
    }
    return (
      <div className="sheet-toolbar account-sidebar-controls">
        <button className="btn modal-btn-disable" onClick={this._cancelEditMenu}>
          Cancel
        </button>
        <button className="btn modal-btn-enable" onClick={this._saveMenuEdit}>
          Done
        </button>
      </div>
    );
  }
}
