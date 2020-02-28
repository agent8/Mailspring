import React, { Component } from "react";
import Select, { Option } from 'rc-select';

export default class JiraStatus extends Component {
    constructor(props) {
        super(props);
        this.state = {
            status: props.status
        };
        this.jira = props.jira;
    }
    componentDidMount = async () => {
        this.mounted = true;
        this.findTransitions(this.props);
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.issueKey !== this.props.issueKey) {
            this.safeSetState({
                status: nextProps.status
            })
            this.findTransitions(nextProps);
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    findTransitions = async (props) => {
        const { issueKey } = props;
        if (!issueKey) {
            return;
        }
        if (issueKey) {
            if (issueKey === this.issueKey) {
                return;
            }
            this.issueKey = issueKey;
            this.safeSetState({
                issueKey,
                statusProgress: null,
            })
            const { transitions } = await this.jira.listTransitions(issueKey);
            console.log('****transitions', transitions);
            this.safeSetState({
                transitions
            })
        }
    }
    onStatusChange = async item => {
        AppEnv.trackingEvent('Jira-Change-Status');
        try {
            let { status } = this.props;
            let { transitions: oldTransitions } = this.state;
            for (const t of oldTransitions) {
                if (t.id === item.key) {
                    status = t.to;
                    this.safeSetState({
                        statusProgress: 'loading'
                    })
                    break;
                }
            }
            await this.jira.transitionIssue(this.issueKey, {
                transition: {
                    id: item.key
                }
            });
            let { transitions } = await this.jira.listTransitions(this.issueKey);
            this.safeSetState({
                status,
                transitions,
                statusProgress: 'success'
            })
            AppEnv.trackingEvent('Jira-Change-Status-Success');
        } catch (err) {
            AppEnv.trackingEvent('Jira-Change-Status-Failed');
            console.error(`****Change assignee failed ${this.issueKey}`, err);
            AppEnv.reportError(new Error(`Change assignee failed ${this.issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.props.logout();
            }
            this.safeSetState({
                statusProgress: 'error'
            })
        }
    }
    render() {
        const {
            status,
            statusProgress,
            transitions = [],
        } = this.state;
        const transitionOptions = transitions
            .map(item => (
                <Option key={item.id} value={item.id}>{item.name}</Option>
            ));
        const statusKey = 'status:' + status.id;
        transitionOptions.push(
            <Option key={statusKey} value={statusKey}>{status.name}</Option>
        );
        return (
            <div>
                <span className="label">Status</span>
                <div className="content with-progress">
                    <Select
                        className="jira-status"
                        value={{ key: statusKey, value: status.name }}
                        optionLabelProp="children"
                        labelInValue={true}
                        notFoundContent=""
                        showSearch={false}
                        onChange={this.onStatusChange}
                        dropdownClassName="jira-dropdown"
                    >{transitionOptions}</Select>
                    {this.props.renderProgress(statusProgress)}
                </div>
            </div>
        )
    }
}