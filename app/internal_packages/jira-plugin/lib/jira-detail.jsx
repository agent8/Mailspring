import React, { Component } from "react";
import fs from 'fs';
import path from 'path';
import Select, { Option } from 'rc-select';
import { remote } from 'electron';
import { DateUtils } from 'mailspring-exports';
const { RetinaImg, LottieImg } = require('mailspring-component-kit');
const configDirPath = AppEnv.getConfigDirPath();
const jiraDirPath = path.join(configDirPath, 'jira_cache');
const { Menu, MenuItem } = remote;

export default class JiraDetail extends Component {
    constructor(props) {
        super(props);
        let currentUser = window.localStorage.getItem('jira-current-user');
        currentUser = currentUser ? JSON.parse(currentUser) : {}
        this.state = { allUsers: [], currentUser };
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
                assignProgress: null,
                statusProgress: null,
                attachments: {},
                originalFiles: {},
                issue: null,
                comments: []
            })
            this.issueKey = issueKey;
            try {
                issue = await props.jira.findIssue(issueKey, `renderedFields`);
                console.log('*****issue', issue);
                this.safeSetState({
                    loading: false,
                    issue
                })
            } catch (err) {
                console.error(`****find issue error ${this.issueKey}`, err);
                AppEnv.reportError(new Error(`find issue error ${this.issueKey}`), { errorData: err });
                const errorMessage = err.error.errorMessages && err.error.errorMessages[0];
                this.safeSetState({
                    loading: false,
                    issue: null,
                    errorMessage
                })
                return;
            }
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
            comments: rst.comments,
            commentLoading: false
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
        const { attachments } = this.state;
        return html.replace(/<img src="\/secure\/attachment\/.+?\//g, function (str) {
            const matchs = /<img src="\/secure\/attachment\/(.+?)\//g.exec(str);
            // find if the image is downloaded.
            if (matchs && matchs[1] && attachments[matchs[1]]) {
                return `<img src="${jiraDirPath}/`;
            }
            return `<img style='display: none;' src="${jiraDirPath}/`;
        });
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
            this.safeSetState({
                assignProgress: 'loading'
            })
            await this.props.jira.updateAssignee(this.issueKey, item.key);
            this.safeSetState({
                assignProgress: 'success'
            })
            // this._showDialog('Change assignee successful.');
        } catch (err) {
            console.error(`****Change assignee failed ${this.issueKey}`, err, this.assignee);
            AppEnv.reportError(new Error(`Change assignee failed ${this.issueKey}`), { errorData: err });
            this.safeSetState({
                assignProgress: 'error'
            })
        }
    }
    onStatusChange = async item => {
        try {
            let { transitions: oldTransitions, issue } = this.state;
            for (const t of oldTransitions) {
                if (t.id === item.key) {
                    issue.fields.status = t.to;
                    this.safeSetState({
                        issue,
                        statusProgress: 'loading'
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
                transitions,
                statusProgress: 'success'
            })
            // this._showDialog('Change status successful.');
        } catch (err) {
            console.error(`****Change assignee failed ${this.issueKey}`, err);
            AppEnv.reportError(new Error(`Change assignee failed ${this.issueKey}`), { errorData: err });
            this.safeSetState({
                statusProgress: 'error'
            })
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
            this.safeSetState({
                commentLoading: true
            });
            await this.props.jira.addComment(this.issueKey, comment);
            this.findComments(this.issueKey);
            this._showDialog('Add comment successful.');
        } catch (err) {
            console.error('****err', err);
            this._showDialog('Add comment failed.');
        }
    }
    _showDialog(message, type = 'info') {
        remote.dialog.showMessageBox({
            type,
            buttons: ['OK'],
            message
        });
    }
    _renderLoading(width) {
        return <LottieImg
            name="loading-spinner-blue"
            size={{ width, height: width }}
            style={{ margin: 'none', display: 'inline-block' }}
        />
    }
    _renderProgress(progress) {
        let p = null;
        if (progress === 'loading') {
            p = this._renderLoading(20);
        }
        else if (progress === 'success') {
            p = <RetinaImg
                className="jira-success"
                style={{ width: 24 }}
                name={'check-alone.svg'}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
            />
        }
        else if (progress === 'error') {
            p = <RetinaImg
                className="jira-error"
                style={{ width: 24 }}
                name={'close.svg'}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
            />
        }
        return <span className="jira-progress">{p}</span>;
    }
    showMore = () => {
        this.menu = new Menu();

        let menuItem;
        menuItem = new MenuItem({
            label: 'Logout',
            click: () => {
                this.props.logout();
                this.menu.closePopup();
            },
        });
        this.menu.append(menuItem);
        this.menu.popup({ x: event.clientX, y: event.clientY });
    }
    openOrignalImage = e => {
        const el = e.target;
        if (el.tagName === 'IMG') {
            if (el.src.includes('jira_cache')) {
                const { attachments } = this.state;
                for (const index in attachments) {
                    if (el.src.includes(encodeURI(attachments[index]))) {
                        this.openAttachment(index);
                        break;
                    }
                }
            }
        }
    }
    render() {
        const {
            issue,
            loading,
            commentLoading,
            assignProgress,
            statusProgress,
            attachments = {},
            comments = [],
            allUsers,
            issueKey,
            transitions = [],
            currentUser,
            errorMessage
        } = this.state;
        if (loading) {
            return <div className="large-loading">
                {this._renderLoading(40)}
            </div>
        }
        const userLogo = <div className="jira-current-user" onClick={this.showMore}>
            {
                currentUser.avatarUrls ?
                    <img src={currentUser.avatarUrls && currentUser.avatarUrls['48x48']} />
                    : <RetinaImg
                        name={'jira.svg'}
                        isIcon
                        mode={RetinaImg.Mode.ContentIsMask}
                    />
            }
        </div>;
        if (!issue) {
            return <div className="jira-detail">
                {userLogo}
                <div className="error">
                    {errorMessage}
                </div>
            </div>;
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
                {userLogo}
                <div className="jira-title"><a href={`${protocol}://${host}/browse/${issueKey}`}>{issueKey}</a></div>
                <div className="wrapper">
                    <header>
                        <div>
                            <span className="label">Assignee</span>
                            <div className="content with-progress">
                                <Select
                                    ref={el => this.assignee = el}
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
                                {this._renderProgress(assignProgress)}
                            </div>
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
                                {this._renderProgress(statusProgress)}
                            </div>
                        </div>
                    </header>
                    <div className="jira-description" onClick={this.openOrignalImage} >
                        <span className="label">Description</span>
                        <div dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(renderedFields.description) }}></div>
                    </div>
                    <div className="jira-comments" onClick={this.openOrignalImage} >
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
                    {
                        commentLoading ?
                            this._renderLoading(20)
                            : <button className="btn btn-jira" onClick={this.addComment}>Add Comment</button>
                    }
                </div>
            </div >
        )
    }
}