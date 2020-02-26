import React, { Component } from "react";
import { ResizableRegion } from 'mailspring-component-kit';
import JiraDetail from './jira-detail';
import Login from './jira-login';
import _ from 'underscore';
const { AccountStore } = require('mailspring-exports');
const CONFIG_KEY = 'plugin.jira.config';
const WIDTH_KEY = 'plugin.jira.width';
const JIRA_SHOW_KEY = 'plugin.jira.show';

export default class JiraPlugin extends Component {
    static displayName = 'JiraPlugin';
    constructor(props) {
        super(props);
        const config = AppEnv.config.get(CONFIG_KEY);
        this.state = {
            config: config ? config : {},
            width: AppEnv.config.get(WIDTH_KEY),
            active: !!AppEnv.config.get(JIRA_SHOW_KEY)
        }
    }
    componentDidMount() {
        this.disposables = [
            AppEnv.config.onDidChange(
                JIRA_SHOW_KEY,
                () => {
                    this.setState({
                        active: !!AppEnv.config.get(JIRA_SHOW_KEY)
                    })
                }
            ),
            AppEnv.config.onDidChange(
                CONFIG_KEY,
                () => {
                    const config = AppEnv.config.get(CONFIG_KEY);
                    this.setState({
                        config: AppEnv.config.get(CONFIG_KEY)
                    })
                }
            )
        ]
    }
    componentWillUnmount() {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
    _onColumnResize = _.debounce((w) => {
        AppEnv.config.set(WIDTH_KEY, w);
    }, 200);
    _isJIRA() {
        const { thread } = this.props;
        if (thread && thread.participants) {
            for (const att of thread.participants) {
                if (att.email && att.email.split('@')[1].includes('atlassian.net')) {
                    return true;
                }
            }
        }
        return false;
        // return this.props.thread.isJIRA;
    }
    render() {
        const { active, config } = this.state;
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
                className="jira-plugin"
                handle={ResizableRegion.Handle.Left}
                style={{ overflowY: 'auto' }}
                onResize={this._onColumnResize}
                initialWidth={this.state.width || 200}
            >
                {
                    needLogin ?
                        <Login {...this.props} config={this.state.config} />
                        : <JiraDetail {...this.props} config={this.state.config} />
                }
            </ResizableRegion>
        )
    }
}