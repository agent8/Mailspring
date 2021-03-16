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
  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.shouldDisplayPlugin(nextProps)) {
      window
        .introJs()
        .setOptions({
          skipLabel: 'Skip',
          steps: [
            {
              element: document.querySelector('.btn-toolbar.message-toolbar-jira'),
              intro: 'Can assign, change status and add comments through Jira plugin.',
            },
            {
              element: document.querySelector('.account-sidebar-sections .jira-icon'),
              intro: 'All Jira are list here.',
            },
          ],
        })
        .start()
        .onexit(() => {
          console.log('***exit');
        });
    }
  }
  toggleJira = () => {
    Actions.toggleJiraPlugin(!this.state.active);
    this.setState({
      active: !this.state.active,
    });
  };
  _isJIRA(props) {
    const { thread } = props;
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
    return props.thread.isJIRA;
  }
  shouldDisplayPlugin = props => {
    const accounts = AccountStore.accounts();
    let isEdisonMail = false;
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true;
        break;
      }
    }
    if (!props.thread || !this._isJIRA(props) || !isEdisonMail) {
      return false;
    }
    return true;
  };
  render() {
    if (!this.shouldDisplayPlugin(this.props)) {
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
