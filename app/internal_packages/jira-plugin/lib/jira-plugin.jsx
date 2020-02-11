import React, { Component } from "react";
import JiraApi from 'jira-client';
const CONFIG_KEY = 'core.plugins.jira';

class Login extends Component {
    submit = async () => {
        const fields = [this.host, this.email, this.password];
        let hasError = false;
        for (const f of fields) {
            f.className = '';
            if (!f.value) {
                f.className = 'error';
                hasError = true;
            }
        }
        if (hasError) {
            return;
        }
        const config = {
            host: this.host.value,
            username: this.email.value,
            password: this.password.value,
        }
        this.jira = new JiraApi({
            protocol: 'https',
            host: config.host,
            username: config.username,
            password: config.password,
            apiVersion: '2',
            strictSSL: true
        });
        const issue = await this.jira.findIssue('DC-1316');
        console.log('****issue', issue);
        this.props.saveConfig(config);
    }
    render() {
        const { host, username, password } = this.props.config;
        return (
            <div>
                <div className="row">
                    <label htmlFor="jira-email">Jira workspace domain</label>
                    <input type="text" defaultValue={'easilydo.atlassian.net'} ref={el => this.host = el} placeholder="eg. https://your-workspace.atlassian.net" />
                </div>
                <div className="row">
                    <label htmlFor="jira-email">Email</label>
                    <input type="text" defaultValue={'zhansheng@edison.tech'} ref={el => this.email = el} />
                </div>
                <div className="row">
                    <label htmlFor="jira-password">Api token</label>
                    <input type="password" defaultValue={'q8N9fUofBVHWnl7YwWha775D'} ref={el => this.password = el} />
                    <span>Get API token from <a href="https://id.atlassian.com/manage/api-tokens">here</a></span>
                </div>
                <div className="row">
                    <button onClick={this.submit}>Login</button>
                </div>
            </div>
        )
    }
}

export default class JiraPlugin extends Component {
    static displayName = 'JiraPlugin';
    constructor(props) {
        super(props);
        const config = AppEnv.config.get(CONFIG_KEY);
        console.log('****config', config);
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
        console.log('*****jira', this.jira, this.props);
        if (!this.jira) {
            return <Login {...this.props} config={this.state.config} saveConfig={this.saveConfig} />
        }
        return (
            <div>
                Good
            </div>
        )
    }
}