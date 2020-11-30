import React, { Component } from 'react';
import { makeProvider } from './mention-provider';
const { LottieImg } = require('mailspring-component-kit');
const CONFIG_KEY = 'plugin.jira.config';

const _renderLoading = width => {
  return (
    <LottieImg
      name="loading-spinner-blue"
      size={{ width, height: width }}
      style={{ margin: 'none', display: 'inline-block' }}
    />
  );
};
const logout = () => {
  AppEnv.config.set(CONFIG_KEY, {});
};
const EmptyNode = function() {
  return <span></span>;
};
export default class JiraDescription extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.data,
      content: props.html,
    };
    this.mentionProvider = makeProvider(props.jira, props.issueKey);
  }
  componentDidMount = async () => {
    this.mounted = true;
  };
  componentWillUnmount = () => {
    this.mounted = false;
  };
  UNSAFE_componentWillReceiveProps(nexProps) {
    if (nexProps.issueKey !== this.props.issueKey) {
      this.mentionProvider = makeProvider(nexProps.jira, nexProps.issueKey);
      this.safeSetState({
        value: nexProps.data,
        content: nexProps.html,
      });
    }
  }
  safeSetState = data => {
    if (this.mounted) {
      this.setState(data);
    }
  };
  onSubmit = actions => async editorView => {
    const value = await actions.getValue();
    if (value != null) {
      AppEnv.trackingEvent('Jira-UpdateDescription');
      this.safeSetState({
        progress: 'loading',
      });
      const { issueKey, jira } = this.props;
      try {
        await jira.updateDescription(issueKey, value);
      } catch (err) {
        this.safeSetState({
          progress: 'error',
        });
        if (err.message && err.message.includes('invalid refresh token')) {
          logout();
        }
        AppEnv.trackingEvent('Jira-UpdateDescription-Failed');
        return;
      }
      const issue = await jira.findIssue(issueKey, `renderedFields`);
      this.safeSetState({
        content: issue && issue.renderedFields.description,
        progress: 'success',
      });
      AppEnv.trackingEvent('Jira-UpdateDescription-Success');
    }
    this.hideEditor();
  };
  onChange = actions => editorView => {
    actions.getValue().then(value => {
      if (value != null) {
        this.safeSetState({
          value,
        });
      }
    });
  };
  hideEditor = () => {
    this.safeSetState({
      show: false,
    });
  };
  showEditor = () => {
    this.safeSetState({
      show: true,
    });
  };
  render() {
    const { show, value, progress, content } = this.state;
    const { Editor = EmptyNode, EditorContext = EmptyNode, WithEditorActions = EmptyNode } =
      this.props.editorCore || {};
    return (
      <div className="jira-description" onClickCapture={this.props.onClick}>
        <span className="label">Description</span>
        {show ? (
          <EditorContext>
            <WithEditorActions
              render={actions => (
                <Editor
                  defaultValue={value}
                  appearance="comment"
                  mentionProvider={this.mentionProvider}
                  onChange={this.onChange(actions)}
                  onSave={progress !== 'loading' && this.onSubmit(actions)}
                  onCancel={progress !== 'loading' && this.hideEditor}
                />
              )}
            />
          </EditorContext>
        ) : (
          <div
            className="editable"
            onClick={this.showEditor}
            dangerouslySetInnerHTML={{ __html: this.props.replaceImageSrc(content) }}
          ></div>
        )}
        {progress === 'loading' && <div className="loading">{_renderLoading(20)}</div>}
      </div>
    );
  }
}
