import React, { Component } from 'react';
import { Actions } from 'mailspring-exports';

export default class AccountSidebarMask extends Component {
  static displayName = 'AccountSidebarMask';
  constructor(props) {
    super(props);
    this._mounted = false;
    this.state = {};
    this.state.inEditMode = false;
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
  _onClick = () => {
    Actions.setEditingMenu(false);
    Actions.saveCategoryMetaDataChange();
    this.setState({ inEditMode: false });
  };

  render() {
    if (this.state.inEditMode) {
      return <div className="account-sidebar-mask" onClick={this._onClick} />;
    } else {
      return null;
    }
  }
}
