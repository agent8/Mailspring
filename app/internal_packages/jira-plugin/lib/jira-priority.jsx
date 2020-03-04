import React, { Component } from "react";
import Select, { Option } from 'rc-select';

export default class JiraPriority extends Component {
    constructor(props) {
        super(props);
        this.state = {
            priority: props.priority
        };
        this.jira = props.jira;
    }
    componentDidMount = async () => {
        this.mounted = true;
        this.listPriorities(this.props);
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.issueKey !== this.props.issueKey) {
            this.safeSetState({
                priority: nextProps.priority
            })
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    listPriorities = async (props) => {
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
                priorityProgress: null,
            })
            const priorities = await this.jira.listPriorities(issueKey);
            console.log('****priorities', priorities);
            this.safeSetState({
                priorities
            })
        }
    }
    onStatusChange = async (item, option) => {
        AppEnv.trackingEvent('Jira-Change-Status');
        console.log('*****onStatusChange', item, option);
        try {
            let priority = { id: item.key }
            this.safeSetState({
                priority,
                priorityProgress: 'loading'
            })
            await this.jira.setIssuePriority(this.issueKey, {
                id: item.key
            });
            this.safeSetState({
                priorityProgress: 'success'
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
                priorityProgress: 'error'
            })
        }
    }
    _renderOption(item) {
        return <Option key={item.id} value={item.id} data={item}>
            <span className="jira-priority"><img src={item.iconUrl} />{item.name}</span>
        </Option>
    }
    render() {
        const {
            priority,
            priorityProgress,
            priorities = [],
        } = this.state;
        const priorityOptions = priorities.length > 0 ?
            priorities.map(this._renderOption) : [this._renderOption(priority)];
        return (
            <div>
                <span className="label">Priority</span>
                <div className="content with-progress">
                    <Select
                        className="jira-priority"
                        value={{ key: priority.id, value: priority.name }}
                        optionLabelProp="children"
                        labelInValue={true}
                        notFoundContent=""
                        showSearch={false}
                        onChange={this.onStatusChange}
                        dropdownClassName="jira-dropdown"
                    >{priorityOptions}</Select>
                    {this.props.renderProgress(priorityProgress)}
                </div>
            </div>
        )
    }
}