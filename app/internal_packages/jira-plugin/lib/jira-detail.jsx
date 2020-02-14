import React, { Component } from "react";
import fs from 'fs';
import path from 'path';
import Select, { Option } from 'rc-select';
import { remote } from 'electron';
const configDirPath = AppEnv.getConfigDirPath();
const jiraDirPath = path.join(configDirPath, 'jira_cache');

export default class JiraDetail extends Component {
    constructor(props) {
        super(props);
        // let allUsers = window.localStorage.getItem('jira-users');
        // allUsers = this.allUsers ? JSON.parse(this.allUsers) : [];
        this.state = { allUsers: [] };
    }
    componentDidMount = async () => {
        this.findIssue(this.props);
    }
    componentWillReceiveProps(nextProps) {
        this.findIssue(this.props);
    }
    findIssue = async (props) => {
        const { thread } = props;
        if (!thread) {
            return;
        }
        const matchs = thread.subject.match(/\((.+?)\)/);
        if (matchs && matchs[1]) {
            const issueKey = matchs[1];
            if (issueKey === this.issueKey) {
                return;
            }
            this.state
            let issue = null;
            this.setState({
                issueKey,
                loading: true,
                attachments: {},
                originalFiles: {},
                issue: null,
                comments: []
            })
            this.issueKey = issueKey;
            issue = await props.jira.findIssue(issueKey, `renderedFields`);
            console.log('*****issue', issue);
            const status = await this.props.jira.listStatus();
            console.log('*****status', status);
            this.setState({
                loading: false,
                issue,
            })
            // download attachments
            if (issue && issue.fields.attachment) {
                this.downloadUri(issue.fields.attachment, true);
                this.downloadUri(issue.fields.attachment, false);
            }
            // get comments
            this.findComments(issueKey);
            // get users
            if (this.state.allUsers.length === 0) {
                const users = await this.props.jira.searchAssignableUsers({ issueKey: issueKey, maxResults: 500 });
                this.setState({
                    allUsers: users
                })
            }
        }
    }
    findComments = async (issueKey) => {
        let rst = await this.props.jira.findComments(issueKey);
        console.log('*****rst.comments', rst.comments);
        this.setState({
            comments: rst.comments
        })
    }
    downloadUri = async (attachments, isThumbnail = true) => {
        let downloadApi = isThumbnail ? this.props.jira.downloadThumbnail : this.props.jira.downloadAttachment;
        for (const attachment of attachments) {
            // Only download orginal image file
            if (!attachment.mimeType.includes('image') && !isThumbnail) {
                return;
            }
            const localPath = path.join(jiraDirPath, `${isThumbnail ? '' : 'origin_'}${attachment.id}_${attachment.filename}`);
            if (!fs.existsSync(localPath)) {
                const downloadAtt = await downloadApi(attachment);
                fs.writeFileSync(localPath, downloadAtt);
            }
            const { attachments = {}, originalFiles = {} } = this.state;
            if (isThumbnail) {
                attachments[attachment.id] = localPath;
            } else {
                originalFiles[attachment.id] = localPath;
            }
            this.setState({
                attachments,
                originalFiles
            });
        }
    }
    replaceImageSrc = html => {
        if (!html) {
            return '';
        }
        const { attachments, issue } = this.state;
        // all attachments download is over
        // console.log('****attachments', attachments, attachments.length);
        console.log('****issue.fields.attachment.length', issue.fields.attachment, issue.fields.attachment.length);
        if (attachments && issue.fields.attachment && Object.keys(attachments).length === issue.fields.attachment.length) {
            return html.replace(/<img src="\/secure\/attachment\/.+?\//g, `<img src="${jiraDirPath}/`);
        }
        return html.replace(/<img src="\/secure\/attachment\/.+?\//g, `<img style='visibility: hidden;' src="${jiraDirPath}/`);
    }
    _renderComments = comments => {
        return (
            <div>
                {
                    comments.map(item => (
                        <div key={item.id}>
                            <span>{this.renderUserNode(item.author)}</span>
                            <div dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(item.renderedBody) }}></div>
                        </div>
                    ))
                }
            </div>
        )
    }
    selectFilter = (inputVal, option) => {
        return option.props.displayname.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1;
    }
    renderUserNode(userInfo) {
        return <div className="jira-user">
            <img src={userInfo.avatarUrls['24x24']} />
            <span>{userInfo.displayName}</span>
        </div>
    }
    onSelectChange = async item => {
        try {
            await this.props.jira.updateAssignee(this.issueKey, item.key);
            remote.dialog.showMessageBox({
                buttons: ['OK'],
                message: 'Change assignee successful.'
            });
        } catch (err) {
            remote.dialog.showMessageBox({
                type: 'error',
                buttons: ['OK'],
                message: 'Change assignee failed.'
            });
        }
    }
    openAttachment = id => {
        const { attachments, originalFiles } = this.state;
        const path = originalFiles[id] || attachments[id];
        const currentWin = AppEnv.getCurrentWindow();
        currentWin.previewFile(path);
    }
    render() {
        const { issue, loading, attachments = {}, comments = [], allUsers, issueKey } = this.state;
        if (loading) {
            return <div>loading</div>
        }
        if (!issue) {
            return <div>not exists</div>;
        }
        const { renderedFields, fields } = issue;
        const children = allUsers
            .filter(item => item.accountType === "atlassian")
            .map((item, idx) => {
                return (
                    <Option key={item.accountId} displayname={item.displayName} value={item.accountId}>{this.renderUserNode(item)}</Option>
                )
            });
        if (children.length === 0) {
            children.push(<Option key={fields.assignee.accountId} displayname={fields.assignee.displayName} value={fields.assignee.accountId}>{this.renderUserNode(fields.assignee)}</Option>);
        }
        return (
            <div className="jira-detail">
                <header>
                    <h1>{issueKey}</h1>
                    <div>
                        <span className="label">Assignee</span>
                        <Select
                            className="content assign-users"
                            defaultValue={{ key: fields.assignee.accountId, value: this.renderUserNode(fields.assignee) }}
                            optionLabelProp="children"
                            filterOption={this.selectFilter}
                            labelInValue={true}
                            notFoundContent=""
                            showSearch={true}
                            onChange={this.onSelectChange}
                            dropdownClassName="jira-dropdown"
                        >{children}</Select>
                    </div>
                    <div>
                        <span className="label">Reporter</span>
                        <span className="content">{this.renderUserNode(fields.reporter)}</span>
                    </div>
                    <div>
                        <span className="label">Priority</span>
                        <span className="content">{fields.priority.name}</span>
                    </div>
                    <div>
                        <span className="label">Status</span>
                        <span className="content">{fields.status.name}</span>
                    </div>
                </header>
                <div>
                    <span className="label">Description</span>
                    <div dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(renderedFields.description) }}></div>
                </div>
                <div>
                    <span className="label">Comments</span>
                    {this._renderComments(comments)}
                </div>
                <div>
                    <span>Attachments</span>
                    {
                        fields.attachment.map(item => (
                            <div key={item.id} onClick={() => this.openAttachment(item.id)}>
                                {attachments[item.id] ? <img src={attachments[item.id]} /> : 'downloading'}
                            </div>
                        ))
                    }
                </div>
            </div >
        )
    }
}