import React from 'react';
import { Actions, PropTypes, AccountStore, FocusedPerspectiveStore } from 'mailspring-exports';
import { LabelColorizer } from 'mailspring-component-kit';
import { Component } from 'react';

export default class AccountColor extends Component {
  static propTypes = {
    message: PropTypes.object,
  };
  componentDidMount() {
    this.unsubscribers = [];
    this.unsubscribers.push(
      Actions.changeAccountColor.listen(() => {
        if (this._mounted) {
          this.forceUpdate();
        }
      }, this)
    );
    this._mounted = true;
  }
  componentWillUnmount() {
    this.unsubscribers.map(unsubscribe => unsubscribe());
    this._mounted = false;
  }
  render() {
    if (!AppEnv.config.get('core.appearance.showAccountColor')) {
      return null;
    }
    const { message } = this.props;
    const current = FocusedPerspectiveStore.current();
    if (current.accountIds.length <= 1) {
      return null;
    }
    const accounts = AccountStore.accounts().map(account => account.id);
    const accountId = message.accountId;
    const account = AccountStore.accountForId(accountId);
    const color =
      account.color !== undefined
        ? account.color
        : accounts.findIndex(account => account === accountId) + 1;
    return (
      <div
        className={`account-color`}
        style={{ background: LabelColorizer.accountColors()[color] }}
      ></div>
    );
  }
}
