import {
  RetinaImg,
  Flexbox,
  EditableList,
  ComposerEditor,
  ComposerSupport,
  AttachmentItem,
} from 'mailspring-component-kit';
import { React, ReactDOM, Actions, Utils, PropTypes } from 'mailspring-exports';
import { shell, remote } from 'electron';
import path from 'path';
import TemplateStore from './template-store';
import TemplateActions from './template-actions';

const {
  Conversion: { convertFromHTML, convertToHTML },
} = ComposerSupport;

const TEMPLATEFIELDS = ['TO', 'CC', 'BCC', 'SUBJ'];

function fileIsImage(file) {
  const extensions = ['.jpg', '.bmp', '.gif', '.png', '.jpeg', '.heic'];
  const ext = path.extname(file).toLowerCase();
  return extensions.includes(ext);
}

class TemplateEditor extends React.Component {
  static propTypes = {
    template: PropTypes.object,
    body: PropTypes.string,
    onEditField: PropTypes.func,
    onEditTitle: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { TO, CC, BCC, SUBJ, attachments } = props.template || {};
    const body = props.body || '';
    this.state = {
      body,
      editorState: convertFromHTML(body),
      TO: TO || '',
      showTO: !!TO,
      CC: CC || '',
      showCC: !!CC,
      BCC: BCC || '',
      showBCC: !!BCC,
      SUBJ: SUBJ || '',
      showSUBJ: !!SUBJ,
      attachments: attachments || [],
      readOnly: !props.template,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const body = nextProps.body || '';
    if (body !== this.props.body) {
      this.setState({
        body,
        editorState: convertFromHTML(body),
      });
    }
  }

  _onSave = () => {
    if (this.state.readOnly) {
      return;
    }
    const outHTML = convertToHTML(this.state.editorState);
    const template = Object.assign({}, this.props.template);
    template.body = outHTML;
    // if delete the inline, should filter it
    const filterAttachment = this.state.attachments.filter(a => {
      if (!a.inline) {
        return true;
      }
      if (outHTML.indexOf(`src="${a.path}"`) >= 0) {
        return true;
      }
      if (outHTML.indexOf(`src="${Utils.filePathEncode(a.path)}"`) >= 0) {
        return true;
      }
      return false;
    });
    template.attachments = filterAttachment;
    this.setState({ attachments: filterAttachment });
    TemplateActions.updateTemplate(template);
  };

  _onAddInlineImage = ({ path, inline }) => {
    const newAttachments = [...this.state.attachments, { inline: inline, path: path }];
    this.setState(
      {
        attachments: newAttachments,
      },
      () => {
        this.props.onEditField('attachments', newAttachments);
      }
    );
  };

  _onFileReceived = filePath => {
    if (!Utils.fileIsImage(filePath)) {
      return;
    }
    const newFilePath = AppEnv.copyFileToPreferences(filePath);
    if (this._composer) {
      this._composer.insertInlineResizableImage(newFilePath);
      this._onAddInlineImage({ path: newFilePath, inline: true });
    }
  };

  _onFocusEditor = e => {
    if (e.target === ReactDOM.findDOMNode(this._composer)) {
      this._composer.focusEndAbsolute();
    }
  };

  _showField = field => {
    const state = {};
    state[`show${field}`] = true;
    this.setState(state);
  };

  _onChangeField = (field, value) => {
    const state = {};
    state[field] = value;
    this.setState(state, () => {
      this.props.onEditField(field, value);
    });
  };

  _onAddAttachment = () => {
    AppEnv.cachePreferenceFiles(paths => {
      if (!paths || !paths.length) {
        return;
      }
      const addAttachments = paths.map(p => {
        return {
          inline: false,
          path: p,
        };
      });
      const newAttachments = [...this.state.attachments, ...addAttachments];
      this.setState(
        {
          attachments: newAttachments,
        },
        () => {
          this.props.onEditField('attachments', newAttachments);
        }
      );
    });
  };

  _onRemoveAttachment = index => {
    const newAttachments = this.state.attachments.filter((attach, idx) => {
      return idx !== index;
    });
    this.setState(
      {
        attachments: newAttachments,
      },
      () => {
        this.props.onEditField('attachments', newAttachments);
      }
    );
  };

  _onForceSave = value => {
    this.setState({ editorState: value }, this._onSave);
  };

  _renderTemplateActions = () => {
    const buttons = [];
    TEMPLATEFIELDS.forEach(field => {
      if (!this.state[`show${field}`]) {
        buttons.push(
          <div className={'btn'} key={field} title={field} onClick={() => this._showField(field)}>
            {field}
          </div>
        );
      }
    });
    buttons.push(
      <RetinaImg
        key={'attachments'}
        name={'attachments.svg'}
        style={{ width: 24, height: 24, fontSize: 24 }}
        isIcon
        mode={RetinaImg.Mode.ContentIsMask}
        onClick={this._onAddAttachment}
      />
    );
    return <div className="template-action-btns">{buttons}</div>;
  };
  _renderTemplateFields = () => {
    const details = [];
    TEMPLATEFIELDS.forEach(field => {
      if (this.state[`show${field}`]) {
        details.push(
          <label className="template-field" key={field}>
            <div className="field-label">{field}</div>
            <input
              type="text"
              defaultValue={this.state[field]}
              onBlur={e => this._onChangeField(field, e.target.value)}
            />
          </label>
        );
      }
    });
    if (!details.length) {
      return null;
    }
    return <div className="template-action-fields">{details}</div>;
  };

  _renderTemplateFiles() {
    const { attachments = [] } = this.state;
    const fileComponents = attachments
      .filter(atta => !atta.inline)
      .map((file, index) => {
        const filePath = file.path;
        const fileName = path.basename(filePath);
        return (
          <AttachmentItem
            key={index}
            draggable={false}
            className="template-file"
            filePath={filePath}
            displayName={fileName}
            isImage={fileIsImage(fileName)}
            accountId={''}
            onRemoveAttachment={() => {
              this._onRemoveAttachment(index);
            }}
            onOpenAttachment={() => remote.shell.openPath(filePath)}
          />
        );
      });
    return <div className={'attachments'}>{fileComponents}</div>;
  }

  render() {
    const { onEditTitle, template = {} } = this.props;
    const { readOnly, editorState } = this.state;

    return (
      <div className={`template-wrap ${readOnly && 'empty'}`}>
        <div className="section basic-info">
          <input
            type="text"
            id="title"
            placeholder="Name"
            style={{ maxWidth: 400 }}
            defaultValue={template ? template.title : ''}
            onBlur={e => onEditTitle(e.target.value)}
          />
          {this._renderTemplateActions()}
        </div>
        {this._renderTemplateFields()}
        <div className="section editor" onClick={this._onFocusEditor}>
          <ComposerEditor
            ref={c => (this._composer = c)}
            readOnly={readOnly}
            value={editorState}
            propsForPlugins={{ inTemplateEditor: true, onForceSave: this._onForceSave }}
            onChange={change => {
              const changeHtml = convertToHTML(change.value);
              if (changeHtml) {
                this.setState({ editorState: change.value });
              } else {
                this.setState({ editorState: convertFromHTML('<br />') });
              }
            }}
            onBlur={this._onSave}
            onFileReceived={this._onFileReceived}
            onAddAttachments={this._onAddInlineImage}
          />
        </div>
        {this._renderTemplateFiles()}
        <div className="section note">
          Changes are saved automatically.
          {/* View the{' '}
          <a href="https://mailsupport.edison.tech/hc/en-us/articles/360037710531">
            Templates Guide
          </a>{' '}
          for tips and tricks. */}
        </div>
      </div>
    );
  }
}

export default class PreferencesTemplates extends React.Component {
  static displayName = 'PreferencesTemplates';

  constructor() {
    super();
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this.unsubscribers = [TemplateStore.listen(this._onChange)];
  }

  componentWillUnmount() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
  }

  _onChange = () => {
    this.setState(this._getStateFromStores());
  };

  _getStateFromStores() {
    const selected = TemplateStore.selectedTemplate();
    const selectedBody =
      selected && selected.id ? TemplateStore.getBodyById(selected.id, true) : '';
    return {
      templates: TemplateStore.getTemplates(),
      selected,
      selectedBody,
    };
  }

  _onAdd = () => {
    TemplateActions.addTemplate();
  };

  _onDelete = item => {
    TemplateActions.removeTemplate(item);
  };

  _onEditTitle = newTitle => {
    if (!newTitle) {
      return;
    }
    this._onChangeField('title', newTitle);
  };

  _onChangeField = (field, value) => {
    const templateChangeFields = [...TEMPLATEFIELDS, 'title', 'attachments'];
    if (!templateChangeFields.includes(field)) {
      return;
    }
    const template = Object.assign({}, this.state.selected);
    template[field] = value;
    TemplateActions.updateTemplate(template);
  };

  _onSelect = item => {
    Actions.selectTemplate(item.id);
  };

  _renderTemplates() {
    const { selected } = this.state;
    const footer = (
      <div className="btn-primary buttons-add" onClick={this._onAdd}>
        <RetinaImg
          name={`add.svg`}
          style={{ width: 19, height: 19, fontSize: 19 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
        New Template
      </div>
    );
    return (
      <div>
        <div className="config-group">
          <h6>TEMPLATES</h6>
          <Flexbox>
            <div className="template-note">
              Welcome to templates! A way to quickly reuse frequently sent replies in email.
              (Changes are saved automatically.)
            </div>
            <div
              className="btn-primary template-folder-btn"
              onClick={() => shell.showItemInFolder(TemplateStore.directory())}
            >
              Show templates folder
            </div>
          </Flexbox>
        </div>
        <Flexbox>
          <EditableList
            showDelIcon
            showFooter
            getConfirmMessage={() => ({
              message: 'Delete this template?',
              detail: `The template and its file will be permanently deleted.`,
            })}
            className="template-list"
            items={this.state.templates}
            itemContent={template => <div className="title">{template.title}</div>}
            onCreateItem={this._onAdd}
            onDeleteItem={this._onDelete}
            onItemEdited={this._onEditTitle}
            onSelectItem={this._onSelect}
            selected={this.state.selected}
            footer={footer}
          />

          <TemplateEditor
            onEditTitle={this._onEditTitle}
            key={selected ? selected.id : 'empty'}
            template={selected}
            body={this.state.selectedBody}
            onEditField={this._onChangeField}
          />
        </Flexbox>
      </div>
    );
  }

  render() {
    return <div className="preferences-templates-container">{this._renderTemplates()}</div>;
  }
}
