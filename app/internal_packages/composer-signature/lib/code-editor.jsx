import React from 'react';
import AceEditor from 'react-ace';
import { FsUtils } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import '../static/mode-html';
import '../static/theme-twilight';
import '../static/theme-textmate';

const { styleHtml } = FsUtils;
export default class CodeEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: styleHtml(props.value, 2),
    };
    this.theme = AppEnv.isDarkTheme() ? 'twilight' : 'textmate';
  }

  _onChange = value => {
    this.setState({
      value,
    });
  };

  _onCancel = () => {
    const { onCancel } = this.props;
    if (onCancel && typeof onCancel === 'function') {
      onCancel();
    }
  };

  _onSubmit = () => {
    const { onSubmit } = this.props;
    if (onSubmit && typeof onSubmit === 'function') {
      onSubmit(this.state.value);
    }
  };

  onLoad = el => {
    el.focus();
  };

  render() {
    return (
      <div className="CodeEditor">
        <div className="code-editor-header">
          <RetinaImg
            name="code.svg"
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
          <div className="title">HTML Code Editor</div>
          <div className="btn" onClick={this._onCancel}>
            Cancel
          </div>
          <div className="btn" onClick={this._onSubmit}>
            Save
          </div>
        </div>
        <AceEditor
          mode="html"
          theme={this.theme}
          name="signature-code-block"
          onLoad={this.onLoad}
          value={this.state.value}
          onChange={this._onChange}
          fontSize={14}
          width={'100%'}
          height="auto"
          showGutter={true}
          minLines={6}
          highlightActiveLine={true}
          showPrintMargin={false}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            tabSize: 2,
          }}
        />
      </div>
    );
  }
}
