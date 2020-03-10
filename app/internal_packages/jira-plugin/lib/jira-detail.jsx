import React, { Component } from "react";
import fs from 'fs';
import path from 'path';
import Select, { Option } from 'rc-select';
import { remote } from 'electron';
import JiraApi from './jira-api';
import Watcher from './jira-watcher';
import Status from './jira-status';
import Priority from './jira-priority';
import { JiraComments, CommentSubmit } from './jira-comments';
const cheerio = require('cheerio');
const { RetinaImg, LottieImg } = require('mailspring-component-kit');
const configDirPath = AppEnv.getConfigDirPath();
const jiraDirPath = path.join(configDirPath, 'jira_cache');
const { Menu, MenuItem } = remote;
const CONFIG_KEY = 'plugin.jira.config';

export default class JiraDetail extends Component {
    constructor(props) {
        super(props);
        this.state = { allUsers: [] };
    }
    componentDidMount = async () => {
        this.mounted = true;
        this.login(this.props.config);
        this.findIssue(this.props);
        this.getCurrentUserInfo(this.props.config);
    }
    componentWillUnmount() {
        this.mounted = false;
    }
    login = config => {
        if (config && Object.keys(config).length > 0) {
            const apiVersion = '3';
            if (config.access_token) {
                this.jira = new JiraApi({
                    protocol: 'https',
                    host: 'api.atlassian.com',
                    base: `/ex/jira/${config.resource.id}`,
                    bearer: config.access_token,
                    refreshToken: config.refresh_token,
                    method: 'POST',
                    apiVersion,
                    strictSSL: true
                });
            } else {
                this.jira = new JiraApi({
                    protocol: 'https',
                    host: config.host,
                    username: config.username,
                    password: config.password,
                    apiVersion,
                    strictSSL: true
                });
            }
        }
    }
    logout() {
        AppEnv.config.set(CONFIG_KEY, {});
    }
    getCurrentUserInfo = async (config) => {
        if (!config.currentUser) {
            try {
                const currentUser = await this.jira.getCurrentUser();
                console.log('****currentUser', currentUser);
                config.currentUser = currentUser;
                AppEnv.config.set(CONFIG_KEY, config);
            } catch (err) {
                console.log('****getCurrentUserInfo failed', err);
                return;
            }
        }
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    componentWillReceiveProps(nextProps) {
        this.findIssue(nextProps);
    }
    _findIssueKey(messages) {
        for (const m of messages) {
            const $ = cheerio.load(m.body);
            let a = $('.breadcrumbs-table a').last();
            if (a && a.attr('href')) {
                let href = a.attr('href');
                href = href.split('?')[0];
                return {
                    link: href,
                    issueKey: href.substr(href.lastIndexOf('/') + 1)
                }
            }
        }
        return {};
    }
    findIssue = async (props) => {
        const { thread, messages } = props;
        if (!thread) {
            return;
        }

        const { link, issueKey } = this._findIssueKey(messages);

        if (issueKey) {
            if (issueKey === this.issueKey) {
                return;
            }
            this.state
            let issue = null;
            this.safeSetState({
                issueKey,
                loading: true,
                assignProgress: null,
                attachments: {},
                originalFiles: {},
                issue: null,
                comments: [],
                commentLoading: true
            })
            this.issueKey = issueKey;
            try {
                issue = await this.jira.findIssue(issueKey, `renderedFields`);
                console.log('*****issue', issue);
                this.safeSetState({
                    loading: false,
                    issue,
                    link
                })
            } catch (err) {
                console.error(`****find issue error ${this.issueKey}`, err);
                AppEnv.reportError(new Error(`find issue error ${this.issueKey}`), { errorData: err });
                if (err.message && err.message.includes('invalid refresh token')) {
                    this.logout();
                }
                const errorMessage = err.error && err.error.errorMessages && err.error.errorMessages[0];
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
            // get users
            if (this.state.allUsers.length === 0) {
                const users = await this.jira.searchAssignableUsers({ issueKey: issueKey, maxResults: 500 });
                this.safeSetState({
                    allUsers: users
                })
            }
        }
    }
    downloadUri = async (attachments, isThumbnail = true) => {
        let downloadApi = isThumbnail ? this.jira.downloadThumbnail : this.jira.downloadAttachment;
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
            if (!isThumbnail) {
                originalFiles[attachment.id] = localPath;
            }
            attachments[attachment.id] = localPath;
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
        // replace image src
        html = html.replace(/<img\s+src=".*\/secure\/(attachment|thumbnail)\/.+?\/.+?"/g, function (str) {
            const matchs = /<img\s+src=".*\/secure\/(attachment|thumbnail)\/(.+?)\/.+?"/g.exec(str);
            // find if the image is downloaded.
            const attachmentId = matchs[2];
            if (matchs && attachmentId && attachments[attachmentId]) {
                return `<img src="${attachments[attachmentId]}"`;
            }
            return `<img style='display: none;' src="${jiraDirPath}/`;
        });
        // replace link href
        html = html.replace(/href="\/secure/g, `href="https://${this.jira.host}/secure`);
        return html;
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
        AppEnv.trackingEvent('Jira-Change-Assignee');
        try {
            this.safeSetState({
                assignProgress: 'loading'
            })
            await this.jira.updateAssignee(this.issueKey, item.key);
            this.safeSetState({
                assignProgress: 'success'
            })
            // this._showDialog('Change assignee successful.');
            AppEnv.trackingEvent('Jira-Change-Assignee-Success');
        } catch (err) {
            AppEnv.trackingEvent('Jira-Change-Assignee-Failed');
            console.error(`****Change assignee failed ${this.issueKey}`, err, this.assignee);
            AppEnv.reportError(new Error(`Change assignee failed ${this.issueKey}`), { errorData: err });
            if (err.message && err.message.includes('invalid refresh token')) {
                this.logout();
            }
            this.safeSetState({
                assignProgress: 'error'
            })
        }
    }
    openAttachment = id => {
        const { attachments, originalFiles } = this.state;
        const path = originalFiles[id] || attachments[id];
        const currentWin = AppEnv.getCurrentWindow();
        currentWin.previewFile(path);
    }
    _showDialog(message, type = 'info') {
        remote.dialog.showMessageBox({
            type,
            buttons: ['OK'],
            message
        });
    }
    _renderLoading = width => {
        return <LottieImg
            name="loading-spinner-blue"
            size={{ width, height: width }}
            style={{ margin: 'none', display: 'inline-block' }}
        />
    }
    _renderProgress = progress => {
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
                this.logout();
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
            assignProgress,
            attachments = {},
            allUsers,
            issueKey,
            errorMessage
        } = this.state;
        if (loading) {
            return <div className="large-loading">
                {this._renderLoading(40)}
            </div>
        }
        const { currentUser } = this.props.config;
        const userLogo = <div className="jira-current-user" onClick={this.showMore}>
            {
                currentUser && currentUser.avatarUrls ?
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
        const { renderedFields, fields } = issue;
        const userOptions = allUsers
            .filter(item => item.accountType === "atlassian")
            .map((item, idx) => (
                <Option
                    key={item.accountId}
                    displayname={item.displayName}
                    avatarurls={item.avatarUrls}
                    value={item.accountId}>
                    {this.renderUserNode(item)}
                </Option>
            ));
        if (userOptions.length === 0) {
            userOptions.push(<Option key={fields.assignee.accountId} displayname={fields.assignee.displayName} value={fields.assignee.accountId}>{this.renderUserNode(fields.assignee)}</Option>);
        }
        const watcerProps = {
            jira: this.jira,
            fields: issue.fields,
            issueKey,
            currentUser,
            userOptions
        }
        return (
            <div className="jira-detail">
                {userLogo}
                <div className="jira-title">
                    <a href={this.state.link}>{issueKey}</a>
                    <Watcher {...watcerProps} />
                </div>
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
                                >{userOptions}</Select>
                                {this._renderProgress(assignProgress)}
                            </div>
                        </div>
                        <div>
                            <span className="label">Reporter</span>
                            <span className="content">{this.renderUserNode(fields.reporter)}</span>
                        </div>
                        <Priority
                            priority={issue.fields.priority}
                            jira={this.jira}
                            issueKey={issueKey}
                            logout={this.logout}
                            renderProgress={this._renderProgress}
                        />
                        <Status
                            status={issue.fields.status}
                            jira={this.jira}
                            issueKey={issueKey}
                            logout={this.logout}
                            renderProgress={this._renderProgress}
                        />
                    </header>
                    <div className="jira-description" onClick={this.openOrignalImage} >
                        <span className="label">Description</span>
                        <div dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(renderedFields.description) }}></div>
                    </div>
                    <JiraComments
                        onClick={this.openOrignalImage}
                        jira={this.jira}
                        issueKey={issueKey}
                        renderUserNode={this.renderUserNode}
                        replaceImageSrc={this.replaceImageSrc}
                    />
                    <div className="jira-attachments">
                        <span className="label">Attachments</span>
                        <div className="attachments">
                            {
                                fields.attachment.map(item => (
                                    <div title={item.filename} key={item.id} onClick={() => this.openAttachment(item.id)}>
                                        {attachments[item.id] ? <img src={attachments[item.id]} /> : this._renderLoading(20)}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
                <CommentSubmit
                    jira={this.jira}
                    issueKey={issueKey}
                />
            </div >
        )
    }
}