import React, { Component } from "react";
import Select, { Option } from 'rc-select';
import _ from 'underscore';

export default class JiraLabels extends Component {
    constructor(props) {
        super(props);
        this.state = {
            labels: props.labels
        };
        this.jira = props.jira;
    }
    componentDidMount = async () => {
        this.mounted = true;
        this.listLabels(this.props);
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.issueKey !== this.props.issueKey) {
            this.safeSetState({
                labels: nextProps.labels
            })
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    onInput = () => {
        this.listLabels(this.select.inputRef.value);
    }
    listLabels = _.debounce(async (inputVal) => {
        this.safeSetState({
            progress: null,
        })
        const res = await this.jira.listLabels(inputVal);
        let allLabels = res.results.map(v => v.value);
        this.safeSetState({
            allLabels
        })
    }, 100)
    saveLabels = async values => {
        const lavelValues = values ? values.map(v => v.key) : [];
        if (_.isEqual(this.preValue, lavelValues)) {
            return;
        }
        AppEnv.trackingEvent('Jira-Save-Labels');
        const { issueKey } = this.props;
        try {
            this.safeSetState({
                progress: 'loading'
            })
            await this.jira.setIssueLabels(
                issueKey,
                lavelValues
            );
            this.safeSetState({
                progress: 'success'
            })
            AppEnv.trackingEvent('Jira-Save-Labels-Success');
        } catch (err) {
            AppEnv.trackingEvent('Jira-Save-Labels-Failed');
            console.error(`****Change Labels failed ${issueKey}`, err);
            AppEnv.reportError(new Error(`Change Labels failed ${issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.props.logout();
            }
            this.safeSetState({
                progress: 'error'
            })
        }
    }
    _renderOption(item) {
        return <Option key={item} value={item} data={item}>
            <span className="jira-version">{item}</span>
        </Option>
    }
    selectFilter = (inputVal, option) => {
        return option.props.data.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1;
    }
    _onFocus = () => {
        this.preValue = this.select.state.value;
    }
    render() {
        const {
            labels,
            progress,
            allLabels = [],
        } = this.state;
        const options = allLabels.length > 0 ?
            allLabels.map(this._renderOption) : labels.map(this._renderOption);
        const value = labels.map(v => ({ key: v, value: v }));
        return (
            <div>
                <span className="label">Labels</span>
                <div className="content with-progress labels">
                    <Select
                        ref={el => this.select = el}
                        className="jira-labels"
                        defaultValue={value}
                        filterOption={this.selectFilter}
                        optionLabelProp="children"
                        labelInValue={true}
                        notFoundContent=""
                        multiple
                        tags
                        onSearch={this.onInput}
                        onFocus={this._onFocus}
                        onBlur={this.saveLabels}
                        dropdownClassName="jira-dropdown"
                    >{options}</Select>
                    {this.props.renderProgress(progress)}
                </div>
            </div>
        )
    }
}