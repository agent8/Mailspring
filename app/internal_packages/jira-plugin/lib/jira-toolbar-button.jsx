import React, { Component } from "react";
const { RetinaImg } = require('mailspring-component-kit');
const JIRA_SHOW_KEY = 'plugin.jira.show';
export default class JiraToolbarButton extends Component {
    static displayName = 'JiraToolbarButton';
    constructor(props) {
        super(props);
        this.state = {
            active: !!AppEnv.config.get(JIRA_SHOW_KEY)
        };
    }
    toggleJira = () => {
        const newStatus = !!!AppEnv.config.get(JIRA_SHOW_KEY);
        AppEnv.config.set(JIRA_SHOW_KEY, newStatus);
        this.setState({
            active: newStatus
        })
    }
    render() {
        console.log('*****props', this.props);
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
                        style={{ width: 24, height: 24 }}
                        isIcon
                        mode={RetinaImg.Mode.ContentIsMask}
                    />
                </div>
            </div>
        )
    }
}