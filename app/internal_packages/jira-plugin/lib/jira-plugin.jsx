import React, { Component } from 'react';
import { ResizableRegion, RetinaImg } from 'mailspring-component-kit';
import Login from './jira-login';
import _ from 'underscore';
const { AccountStore, Actions } = require('mailspring-exports');
const CONFIG_KEY = 'plugin.jira.config';
const WIDTH_KEY = 'plugin.jira.width';

export default class JiraPlugin extends Component {
  static displayName = 'JiraPlugin';
  constructor(props) {
    super(props);
    const config = AppEnv.config.get(CONFIG_KEY);
    this.state = {
      config: config ? config : {},
      width: AppEnv.config.get(WIDTH_KEY),
      active: false,
      JiraDetail: function() {
        return (
          <div className="jira-login">
            <div className="jira-logo">
              <RetinaImg name={'jira.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
            </div>
          </div>
        );
      },
    };
  }
  componentDidMount = () => {
    this.disposables = [
      {
        dispose: Actions.toggleJiraPlugin.listen(active => {
          this.setState(
            {
              active,
            },
            this._loadJiraDetailComponent
          );
        }, this),
      },
      AppEnv.config.onDidChange(CONFIG_KEY, () => {
        const config = AppEnv.config.get(CONFIG_KEY);
        this.setState({
          config,
        });
        this._loadJiraDetailComponent();
      }),
    ];
    this._loadJiraDetailComponent();
  };

  _loadJiraDetailComponent = () => {
    const config = AppEnv.config.get(CONFIG_KEY);
    const needLogin = !config || Object.keys(config).length === 0;
    const active = this.state.active;
    if (!needLogin && active) {
      setTimeout(() => {
        const JiraDetail = require('./jira-detail').default;
        this.setState({
          JiraDetail,
        });
      }, 100);
    }
  };

  componentWillUnmount() {
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  _onColumnResize = _.debounce(w => {
    AppEnv.config.set(WIDTH_KEY, w);
  }, 200);

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
    const { active, config, JiraDetail } = this.state;
    const accounts = AccountStore.accounts();
    let isEdisonMail = false;
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true;
        break;
      }
    }
    if (!active || !this.props.thread || !this._isJIRA() || !isEdisonMail) {
      return null;
    }
    const needLogin = !config || Object.keys(config).length === 0;
    return (
      <ResizableRegion
        minWidth={200}
        className="jira-plugin"
        handle={ResizableRegion.Handle.Left}
        onResize={this._onColumnResize}
        initialWidth={this.state.width || 200}
      >
        {needLogin ? (
          <Login {...this.props} config={this.state.config} />
        ) : (
          <JiraDetail {...this.props} config={this.state.config} />
        )}
      </ResizableRegion>
    );
  }
}
