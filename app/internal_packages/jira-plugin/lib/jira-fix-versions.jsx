import React, { Component } from "react";
import Select, { Option } from 'rc-select';
import _ from 'underscore';

export default class JiraFixVersions extends Component {
    constructor(props) {
        super(props);
        this.state = {
            fixVersions: props.fixVersions
        };
        this.jira = props.jira;
    }
    componentDidMount = async () => {
        this.mounted = true;
        this.listVersions(this.props);
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.issueKey !== this.props.issueKey) {
            this.safeSetState({
                fixVersions: nextProps.fixVersions
            })
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    listVersions = async (props) => {
        const { issueKey, projectKey } = props;
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
                progress: null,
            })
            const versions = await this.jira.listVersions(projectKey);
            this.safeSetState({
                versions
            })
        }
    }
    saveFixVersions = async values => {
        const versions = values ? values.map(v => ({ id: v.key })) : [];
        if (_.isEqual(this.preValue, versions.map(v => v.id))) {
            return;
        }
        AppEnv.trackingEvent('Jira-Save-FixVersion');
        try {
            this.safeSetState({
                progress: 'loading'
            })
            await this.jira.setIssueFixVersions(
                this.issueKey,
                values.map(v => ({ id: v.key }))
            );
            this.safeSetState({
                progress: 'success'
            })
            AppEnv.trackingEvent('Jira-Save-FixVersion-Success');
        } catch (err) {
            AppEnv.trackingEvent('Jira-Save-FixVersion-Failed');
            console.error(`****Change FixVersion failed ${this.issueKey}`, err);
            AppEnv.reportError(new Error(`Change FixVersion failed ${this.issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.props.logout();
            }
            this.safeSetState({
                progress: 'error'
            })
        }
    }
    _renderOption(item) {
        return <Option key={item.id} value={item.id} data={item}>
            <span className="jira-version">{item.name}</span>
        </Option>
    }
    selectFilter = (inputVal, option) => {
        return option.props.data.name.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1;
    }
    _onFocus = () => {
        this.preValue = this.select.state.value;
    }
    render() {
        const {
            fixVersions,
            progress,
            versions = [],
        } = this.state;
        const options = versions.length > 0 ?
            versions.map(this._renderOption) : fixVersions.map(this._renderOption);
        const value = fixVersions.map(v => ({ key: v.id, value: v.name }));
        return (
            <div>
                <span className="label">Fix versions</span>
                <div className="content with-progress fix-versions">
                    <Select
                        ref={el => this.select = el}
                        className="jira-fix-versions"
                        defaultValue={value}
                        filterOption={this.selectFilter}
                        optionLabelProp="children"
                        labelInValue={true}
                        notFoundContent=""
                        multiple
                        onFocus={this._onFocus}
                        onBlur={this.saveFixVersions}
                        dropdownClassName="jira-dropdown"
                    >{options}</Select>
                    {this.props.renderProgress(progress)}
                </div>
            </div>
        )
    }
}