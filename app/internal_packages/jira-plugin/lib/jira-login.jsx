import React, { Component } from "react";
import JiraApi from './jira-api';

export default class Login extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    submit = async () => {
        const fields = [this.host, this.email, this.password];
        let hasError = false;
        this.setState({
            error: null,
            loading: true
        })
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
        try {
            const users = await this.jira.searchUsers({ maxResults: 500 });
            console.log('****users', users);
            window.localStorage.setItem('jira-users', JSON.stringify(users));
        } catch (err) {
            console.log('****jira login failed', err);
            let message = 'Login failed, please check your Email and Api token.';
            if (err.statusCode === 404) {
                message = 'Login failed, please check your Jira workspace domain.';
            }
            this.setState({
                loading: false,
                error: message
            });
            return;
        }
        this.props.saveConfig(config);
    }
    render() {
        const { host, username, password } = this.props.config;
        const { error } = this.state;
        return (
            <div>
                {
                    error && <div className="error">{error}</div>
                }
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