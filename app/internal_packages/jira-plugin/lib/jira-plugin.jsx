import React, { Component } from "react";
import { ResizableRegion } from 'mailspring-component-kit';
import JiraDetail from './jira-detail';
import JiraApi from './jira-api';
import Login from './jira-login';
import _ from 'underscore';
const CONFIG_KEY = 'plugin.jira.config';
const WIDTH_KEY = 'plugin.jira.width';
const JIRA_SHOW_KEY = 'plugin.jira.show';

export default class JiraPlugin extends Component {
    static displayName = 'JiraPlugin';
    constructor(props) {
        super(props);
        const config = AppEnv.config.get(CONFIG_KEY);
        if (config) {
            this.jira = new JiraApi({
                protocol: 'https',
                host: config.host,
                username: config.username,
                password: config.password,
                apiVersion: '2',
                strictSSL: true
            });
        }
        this.state = {
            config: config ? config : {},
            width: AppEnv.config.get(WIDTH_KEY),
            active: !!AppEnv.config.get(JIRA_SHOW_KEY)
        }
    }
    componentDidMount() {
        this.disposable = AppEnv.config.onDidChange(
            JIRA_SHOW_KEY,
            () => {
                this.setState({
                    active: !!AppEnv.config.get(JIRA_SHOW_KEY)
                })
            }
        );
    }
    componentWillUnmount() {
        this.disposable.dispose();
    }
    saveConfig = config => {
        this.jira = new JiraApi({
            protocol: 'https',
            host: config.host,
            username: config.username,
            password: config.password,
            apiVersion: '2',
            strictSSL: true
        });
        AppEnv.config.set(CONFIG_KEY, config);
        this.setState({
            config
        })
    }
    _onColumnResize = _.debounce((w) => {
        AppEnv.config.set(WIDTH_KEY, w);
    }, 200);

    render() {
        if (!this.state.active) {
            return null;
        }
        return (
            <ResizableRegion
                className="jira-plugin"
                handle={ResizableRegion.Handle.Left}
                style={{ overflowY: 'auto' }}
                onResize={this._onColumnResize}
                initialWidth={this.state.width || 200}
            >
                {
                    !this.jira ?
                        <Login {...this.props} config={this.state.config} saveConfig={this.saveConfig} />
                        : <JiraDetail {...this.props} jira={this.jira} />
                }
            </ResizableRegion>
        )
    }
}