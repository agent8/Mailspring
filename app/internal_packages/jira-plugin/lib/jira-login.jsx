import React, { Component } from "react";
import JiraApi from './jira-api';
const { RetinaImg, LottieImg } = require('mailspring-component-kit');

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
        const { error, loading } = this.state;
        return (
            <div className="jira-login">
                <div className="jira-logo">
                    <RetinaImg
                        name={'jira.svg'}
                        isIcon
                        mode={RetinaImg.Mode.ContentIsMask}
                    />
                </div>
                {
                    error && <div className="error">{error}</div>
                }
                <div className="row">
                    <span className="label">Jira workspace domain</span>
                    <input type="text" defaultValue={'easilydo.atlassian.net'} ref={el => this.host = el} placeholder="eg. https://your-workspace.atlassian.net" />
                </div>
                <div className="row">
                    <span className="label">Email</span>
                    <input type="text" defaultValue={username} ref={el => this.email = el} />
                </div>
                <div className="row">
                    <span className="label">API token</span>
                    <input type="password" defaultValue={password} ref={el => this.password = el} />
                    <span><a href="https://id.atlassian.com/manage/api-tokens">Get API token from here.</a></span>
                </div>
                <div className="row">
                    {loading ?
                        <LottieImg
                            name="loading-spinner-blue"
                            size={{ width: 20, height: 20 }}
                            style={{ margin: 'none' }}
                        />
                        : <button className="btn btn-jira btn-jira-login" onClick={this.submit}>Login</button>
                    }
                </div>
            </div>
        )
    }
}