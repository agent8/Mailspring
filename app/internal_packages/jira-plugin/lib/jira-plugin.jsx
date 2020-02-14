import React, { Component } from "react";
import { ResizableRegion } from 'mailspring-component-kit';
import JiraDetail from './jira-detail';
import JiraApi from './jira-api';
import Login from './jira-login';
const CONFIG_KEY = 'core.plugins.jira';

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
            config: config ? config : {}
        }
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

    render() {
        return (
            <ResizableRegion className="jira-plugin" handle={ResizableRegion.Handle.Left} style={{ overflowY: 'auto' }}>
                {
                    !this.jira ?
                        <Login {...this.props} config={this.state.config} saveConfig={this.saveConfig} />
                        : <JiraDetail {...this.props} jira={this.jira} />
                }
            </ResizableRegion>
        )
    }
}