import React, { Component } from 'react';
import util from 'util';
import fs from 'fs';
import path from 'path';
import Select, { Option } from 'rc-select';
import { remote } from 'electron';
import JiraApi from './jira-api';
import Watcher from './jira-watcher';
import Status from './jira-status';
import Priority from './jira-priority';
import Description from './jira-description';
import { JiraComments, CommentSubmit } from './jira-comments';
import FixVersions from './jira-fix-versions';
import Labels from './jira-labels';
import { Actions, PropTypes } from 'mailspring-exports';
const cheerio = require('cheerio');
const { RetinaImg, LottieImg } = require('mailspring-component-kit');
const configDirPath = AppEnv.getConfigDirPath();
const jiraDirPath = path.join(configDirPath, 'jira_cache');
const { Menu, MenuItem } = remote;
const CONFIG_KEY = 'plugin.jira.config';
const exists = util.promisify(fs.exists);
const writeFile = util.promisify(fs.writeFile);

export default class JiraDetail extends Component {
  static propTypes = {
    config: PropTypes.object,
  };
  constructor(props) {
    super(props);
    this.state = { allUsers: [], EditorCore: {} };
  }
  componentDidMount = async () => {
    this.mounted = true;
    this.login(this.props.config);
    this.findIssue(this.props);
    this.getCurrentUserInfo(this.props.config);
    this.asyncLoadMoudles();
  };
  componentWillUnmount() {
    this.mounted = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
  asyncLoadMoudles = () => {
    this.timer = setTimeout(() => {
      const EditorCore = require('@atlaskit/editor-core');
      this.safeSetState({
        EditorCore,
      });
      this.timer = null;
    }, 1500);
  };
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
          strictSSL: true,
        });
      } else {
        this.jira = new JiraApi({
          protocol: 'https',
          host: config.host,
          username: config.username,
          password: config.password,
          apiVersion,
          strictSSL: true,
        });
      }
    }
  };
  logout() {
    AppEnv.config.set(CONFIG_KEY, {});
  }
  getCurrentUserInfo = async config => {
    if (!config.currentUser) {
      try {
        const currentUser = await this.jira.getCurrentUser();
        console.log('****currentUser', currentUser);
        config.currentUser = currentUser;
        const permissions = await this.jira.myPermissions(['ADMINISTER', 'ADMINISTER_PROJECTS']);
        console.log('****permissions', permissions);
        config.permissions = permissions;
        AppEnv.config.set(CONFIG_KEY, config);
      } catch (err) {
        console.log('****getCurrentUserInfo failed', err);
        return;
      }
    }
  };
  safeSetState = data => {
    if (this.mounted) {
      this.setState(data);
    }
  };
  UNSAFE_componentWillReceiveProps(nextProps) {
    this.findIssue(nextProps);
  }
  _findIssueKey(messages) {
    for (const m of messages) {
      if (!m || !m.body) {
        continue;
      }
      const $ = cheerio.load(m.body);
      let a = $('.breadcrumbs-table a').last();
      let b = $('.issue-breadcrumbs a').last();
      let href = (a && a.attr('href')) || (b && b.attr('href'));
      if (href) {
        href = href.split('?')[0];
        return {
          link: href,
          issueKey: href.substr(href.lastIndexOf('/') + 1),
        };
      }
    }
    return {};
  }
  findIssue = async props => {
    const { thread, messages } = props;
    if (!thread) {
      return;
    }
    const { link, issueKey } = this._findIssueKey(messages);
    if (issueKey) {
      if (issueKey === this.issueKey) {
        return;
      }
      let issue = null;
      this.safeSetState({
        issueKey,
        loading: true,
        assignProgress: null,
        attachments: {},
        originalFiles: {},
        issue: null,
        comments: [],
        commentLoading: true,
      });
      this.issueKey = issueKey;
      try {
        issue = await this.jira.findIssue(issueKey, `renderedFields`);
        // if user have already navigated to other issue, don't refresh the page
        if (issueKey !== this.issueKey) {
          return;
        }
        this.safeSetState({
          loading: false,
          issue,
          link,
        });
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
          errorMessage,
        });
        return;
      }
      // download attachments
      if (issue && issue.fields.attachment) {
        this.downloadUri(issue.fields.attachment, true);
        this.downloadUri(issue.fields.attachment, false);
      }
      // get users
      if (this.state.allUsers.length === 0) {
        const users = await this.jira.searchAssignableUsers({
          issueKey: issueKey,
          maxResults: 500,
        });
        this.safeSetState({
          allUsers: users,
        });
      }
    }
  };
  downloadUri = async (attachments, isThumbnail = true) => {
    let downloadApi = isThumbnail ? this.jira.downloadThumbnail : this.jira.downloadAttachment;
    for (const attachment of attachments) {
      // Only download orginal image and video file
      if (
        !isThumbnail &&
        !(attachment.mimeType.includes('image') || attachment.mimeType.includes('video'))
      ) {
        return;
      }
      const localPath = path.join(
        jiraDirPath,
        `${isThumbnail ? '' : 'origin_'}${attachment.id}_${attachment.filename}`
      );

      const exist = await exists(localPath);
      if (!exist) {
        const downloadAtt = await downloadApi(attachment);
        await writeFile(localPath, downloadAtt);
      }
      const { attachments = {}, originalFiles = {} } = this.state;
      if (!isThumbnail) {
        originalFiles[attachment.id] = localPath;
      } else {
        attachments[attachment.id] = localPath;
      }
      this.safeSetState({
        attachments,
        originalFiles,
      });
    }
  };
  replaceImageSrc = html => {
    if (!html) {
      return '';
    }
    const { attachments } = this.state;
    // replace image src
    html = html.replace(/<img\s+src=".*\/secure\/(attachment|thumbnail)\/.+?\/.+?"/g, function(
      str
    ) {
      const matchs = /<img\s+src=".*\/secure\/(attachment|thumbnail)\/(.+?)\/.+?"/g.exec(str);
      // find if the image is downloaded.
      const attachmentId = matchs[2];
      if (matchs && attachmentId && attachments[attachmentId]) {
        return `<img src="${attachments[attachmentId]}"`;
      }
      return `<img style='display: none;' src="${jiraDirPath}/`;
    });
    // replace link href
    html = html.replace(/href="\/secure\/.+?"/g, '');
    return html;
  };
  selectFilter = (inputVal, option) => {
    return (
      option.props.displayname.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1
    );
  };
  renderUserNode(userInfo) {
    return (
      <span className="jira-user">
        <img src={userInfo.avatarUrls['24x24']} alt="avatar" />
        <span>{userInfo.displayName}</span>
      </span>
    );
  }
  onAssigneeChange = async item => {
    AppEnv.trackingEvent('Jira-Change-Assignee');
    try {
      this.safeSetState({
        assignProgress: 'loading',
      });
      await this.jira.updateAssignee(this.issueKey, item.key);
      this.safeSetState({
        assignProgress: 'success',
      });
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
        assignProgress: 'error',
      });
    }
  };
  openAttachment = async id => {
    const { originalFiles } = this.state;
    const path = originalFiles[id];
    const exist = await exists(path);
    if (!exist) {
      this._showDialog('The attachment is downloading, please wait.');
      return;
    }
    const currentWin = AppEnv.getCurrentWindow();
    currentWin.previewFile(path);
  };
  _showDialog(message, type = 'info') {
    remote.dialog.showMessageBox({
      type,
      buttons: ['OK'],
      message,
    });
  }
  _renderLoading = width => {
    return (
      <LottieImg
        name="loading-spinner-blue"
        size={{ width, height: width }}
        style={{ margin: 'none', display: 'inline-block' }}
      />
    );
  };
  _renderProgress = progress => {
    let p = null;
    if (progress === 'loading') {
      p = this._renderLoading(20);
    } else if (progress === 'success') {
      p = (
        <RetinaImg
          className="jira-success"
          style={{ width: 24 }}
          name={'check-alone.svg'}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      );
    } else if (progress === 'error') {
      p = (
        <RetinaImg
          className="jira-error"
          style={{ width: 24 }}
          name={'close.svg'}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      );
    }
    return <span className="jira-progress">{p}</span>;
  };
  showMore = e => {
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
    Actions.closeContextMenu();
    this.menu.popup({ x: e.clientX, y: e.clientY });
  };
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
      e.stopPropagation();
      e.preventDefault();
      return false;
    }
  };
  render() {
    const {
      issue,
      loading,
      assignProgress,
      attachments = {},
      allUsers,
      issueKey,
      errorMessage,
      EditorCore,
    } = this.state;
    if (loading) {
      return <div className="large-loading">{this._renderLoading(40)}</div>;
    }
    const { currentUser } = this.props.config;
    const userLogo = (
      <div className="jira-current-user" onClick={this.showMore}>
        {currentUser && currentUser.avatarUrls ? (
          <img src={currentUser.avatarUrls && currentUser.avatarUrls['48x48']} alt="avatar" />
        ) : (
          <RetinaImg name={'jira.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
        )}
      </div>
    );
    if (!issue) {
      return (
        <div className="jira-detail">
          {userLogo}
          <div className="error">{errorMessage}</div>
        </div>
      );
    }
    const { renderedFields, fields } = issue;
    const userOptions = allUsers
      ? allUsers
          .filter(item => item.accountType === 'atlassian')
          .map((item, idx) => (
            <Option
              key={item.accountId}
              displayname={item.displayName}
              avatarurls={item.avatarUrls}
              value={item.accountId}
            >
              {this.renderUserNode(item)}
            </Option>
          ))
      : [];
    if (userOptions.length === 0) {
      userOptions.push(
        <Option
          key={fields.assignee.accountId}
          displayname={fields.assignee.displayName}
          value={fields.assignee.accountId}
        >
          {this.renderUserNode(fields.assignee)}
        </Option>
      );
    }
    const watcherProps = {
      jira: this.jira,
      fields: issue.fields,
      issueKey,
      currentUser,
      userOptions,
    };
    return (
      <div className="jira-detail">
        {userLogo}
        <div className="jira-title">
          <a href={this.state.link}>{issueKey}</a>
          <Watcher {...watcherProps} />
        </div>
        <div className="wrapper">
          <header>
            <div>
              <span className="label">Assignee</span>
              <div className="content with-progress">
                <Select
                  ref={el => (this.assignee = el)}
                  className="assign-users"
                  defaultValue={{
                    key: fields.assignee.accountId,
                    value: this.renderUserNode(fields.assignee),
                  }}
                  optionLabelProp="children"
                  filterOption={this.selectFilter}
                  labelInValue={true}
                  notFoundContent=""
                  showSearch={true}
                  onChange={this.onAssigneeChange}
                  dropdownClassName="jira-dropdown"
                >
                  {userOptions}
                </Select>
                {this._renderProgress(assignProgress)}
              </div>
            </div>
            <div>
              <span className="label">Reporter</span>
              <span className="content">{this.renderUserNode(fields.reporter)}</span>
            </div>
            <Priority
              priority={fields.priority}
              jira={this.jira}
              issueKey={issueKey}
              logout={this.logout}
              renderProgress={this._renderProgress}
            />
            <Status
              status={fields.status}
              jira={this.jira}
              issueKey={issueKey}
              logout={this.logout}
              renderProgress={this._renderProgress}
            />
            <Labels
              labels={fields.labels}
              jira={this.jira}
              issueKey={issueKey}
              logout={this.logout}
              renderProgress={this._renderProgress}
            />
            <FixVersions
              fixVersions={fields.fixVersions}
              jira={this.jira}
              issueKey={issueKey}
              projectKey={fields.project && fields.project.key}
              logout={this.logout}
              renderProgress={this._renderProgress}
            />
          </header>
          <Description
            onClick={this.openOrignalImage}
            jira={this.jira}
            issueKey={issueKey}
            data={fields.description}
            replaceImageSrc={this.replaceImageSrc}
            html={renderedFields.description}
            editorCore={EditorCore}
          />
          <JiraComments
            onClick={this.openOrignalImage}
            jira={this.jira}
            issueKey={issueKey}
            renderUserNode={this.renderUserNode}
            replaceImageSrc={this.replaceImageSrc}
            editorCore={EditorCore}
          />
          <div className="jira-attachments">
            <span className="label">Attachments</span>
            <div className="attachments">
              {fields.attachment.map(item => (
                <div
                  title={item.filename}
                  key={item.id}
                  onClick={() => this.openAttachment(item.id)}
                >
                  {attachments[item.id] ? (
                    <img src={attachments[item.id]} alt="attachment" />
                  ) : (
                    this._renderLoading(20)
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <CommentSubmit jira={this.jira} issueKey={issueKey} editorCore={EditorCore} />
      </div>
    );
  }
}
