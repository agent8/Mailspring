import React, { Component } from "react";
import fs from 'fs';
import path from 'path';
import Select, { Option } from 'rc-select';
import { remote } from 'electron';
import { DateUtils } from 'mailspring-exports';
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
        this.mounted = true;
        this.findIssue(this.props);
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
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
            this.safeSetState({
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
            this.safeSetState({
                loading: false,
                issue
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
                this.safeSetState({
                    allUsers: users
                })
            }
            const { transitions } = await this.props.jira.listTransitions(issueKey);
            console.log('****transitions', transitions);
            this.safeSetState({
                transitions
            })
        }
    }
    findComments = async (issueKey) => {
        let rst = await this.props.jira.findComments(issueKey);
        this.safeSetState({
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
            this.safeSetState({
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
                        <div key={item.id} className="row">
                            <div className="comment-header">
                                {this.renderUserNode(item.author)}
                                <span className="datetime">{DateUtils.mediumTimeString(item.created)}</span>
                            </div>
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
        return <span className="jira-user">
            <img src={userInfo.avatarUrls['24x24']} />
            <span>{userInfo.displayName}</span>
        </span>
    }
    onAssigneeChange = async item => {
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
    onStatusChange = async item => {
        console.log('****onStatusChange', item);
        try {
            let { transitions: oldTransitions, issue } = this.state;
            for (const t of oldTransitions) {
                if (t.id === item.key) {
                    issue.fields.status = t.to;
                    this.safeSetState({
                        issue
                    })
                    break;
                }
            }
            await this.props.jira.transitionIssue(this.issueKey, {
                transition: {
                    id: item.key
                }
            });
            let { transitions } = await this.props.jira.listTransitions(this.issueKey);
            this.safeSetState({
                transitions
            })
            remote.dialog.showMessageBox({
                buttons: ['OK'],
                message: 'Change status successful.'
            });
        } catch (err) {
            console.error('****err', err);
            remote.dialog.showMessageBox({
                type: 'error',
                buttons: ['OK'],
                message: 'Change status failed.'
            });
        }
    }
    openAttachment = id => {
        const { attachments, originalFiles } = this.state;
        const path = originalFiles[id] || attachments[id];
        const currentWin = AppEnv.getCurrentWindow();
        currentWin.previewFile(path);
    }
    addComment = async () => {
        const comment = this.commentInput.value;
        if (!comment) {
            return;
        }
        try {
            await this.props.jira.addComment(this.issueKey, comment);
            this.findComments(this.issueKey);
            remote.dialog.showMessageBox({
                buttons: ['OK'],
                message: 'Add comment successful.'
            });
        } catch (err) {
            console.error('****err', err);
            remote.dialog.showMessageBox({
                type: 'error',
                buttons: ['OK'],
                message: 'Add comment failed.'
            });
        }
    }
    render() {
        const { issue, loading, attachments = {}, comments = [], allUsers, issueKey, transitions = [] } = this.state;
        if (loading) {
            return <div>loading</div>
        }
        if (!issue) {
            return <div>not exists</div>;
        }
        const status = issue.fields.status;
        const { renderedFields, fields } = issue;
        const assgineeOptions = allUsers
            .filter(item => item.accountType === "atlassian")
            .map((item, idx) => (
                <Option key={item.accountId} displayname={item.displayName} value={item.accountId}>{this.renderUserNode(item)}</Option>
            ));
        if (assgineeOptions.length === 0) {
            assgineeOptions.push(<Option key={fields.assignee.accountId} displayname={fields.assignee.displayName} value={fields.assignee.accountId}>{this.renderUserNode(fields.assignee)}</Option>);
        }
        const transitionOptions = transitions
            .map(item => (
                <Option key={item.id} value={item.id}>{item.name}</Option>
            ));
        const statusKey = 'status:' + status.id;
        transitionOptions.push(
            <Option key={statusKey} value={statusKey}>{status.name}</Option>
        );
        const { protocol, host } = this.props.jira
        return (
            <div className="jira-detail">
                <div className="jira-title"><a href={`${protocol}://${host}/browse/${issueKey}`}>{issueKey}</a></div>
                <div className="wrapper">
                    <header>
                        <div>
                            <span className="label">Assignee</span>
                            <Select
                                className="assign-users"
                                defaultValue={{ key: fields.assignee.accountId, value: this.renderUserNode(fields.assignee) }}
                                optionLabelProp="children"
                                filterOption={this.selectFilter}
                                labelInValue={true}
                                notFoundContent=""
                                showSearch={true}
                                onChange={this.onAssigneeChange}
                                dropdownClassName="jira-dropdown"
                            >{assgineeOptions}</Select>
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
                        </div>
                    </header>
                    <div className="jira-description">
                        <span className="label">Description</span>
                        <div dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(renderedFields.description) }}></div>
                    </div>
                    <div className="jira-comments">
                        <span className="label">Comments</span>
                        {this._renderComments(comments)}
                    </div>
                    <div className="jira-attachments">
                        <span className="label">Attachments</span>
                        <div className="attachments">
                            {
                                fields.attachment.map(item => (
                                    <div title={item.filename} key={item.id} onClick={() => this.openAttachment(item.id)}>
                                        {attachments[item.id] ? <img src={attachments[item.id]} /> : 'downloading'}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
                <div className="jira-submit-comment">
                    <textarea ref={el => this.commentInput = el}></textarea>
                    <button className="btn btn-jira" onClick={this.addComment}>Add Comment</button>
                </div>
            </div >
        )
    }
}