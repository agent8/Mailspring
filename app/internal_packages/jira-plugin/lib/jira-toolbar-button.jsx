import React, { Component } from 'react';
const { RetinaImg } = require('mailspring-component-kit');
const { AccountStore, Actions } = require('mailspring-exports');
export default class JiraToolbarButton extends Component {
  static displayName = 'JiraToolbarButton';
  constructor(props) {
    super(props);
    this.state = {
      active: false,
    };
  }
  toggleJira = () => {
    Actions.toggleJiraPlugin(!this.state.active);
    this.setState({
      active: !this.state.active,
    });
  };
  _isJIRA() {
    const { thread } = this.props;
    // if (thread && thread.participants) {
    //   for (const att of thread.participants) {
    //     if (att.email && (att.email.split('@')[1] || '').includes('atlassian.net')) {
    //       return true;
    //     }
    //   }
    // }
    if (thread && thread.__messages) {
      for (const message of thread.__messages) {
        const from = message.from && message.from[0];
        if (from && (from.email.split('@')[1] || '').includes('atlassian.net')) {
          return true;
        }
      }
    }
    // return false;
    return this.props.thread.isJIRA;
  }
  render() {
    const accounts = AccountStore.accounts();
    let isEdisonMail = false;
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true;
        break;
      }
    }
    if (!this.props.thread || !this._isJIRA() || !isEdisonMail) {
      return null;
    }
    return (
      <div className="button-group" style={{ order: -1 }}>
        <div
          className={`btn-toolbar message-toolbar-jira ${this.state.active ? 'active' : ''}`}
          key="jira-plugin"
          title="jira plugin"
          onClick={this.toggleJira}
        >
          <RetinaImg
            name={'jira.svg'}
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      </div>
    );
  }
}
