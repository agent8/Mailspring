import fs from 'fs';
import {
  RetinaImg,
  Flexbox,
  EditableList,
  ComposerEditor,
  ComposerSupport,
  AttachmentItem,
} from 'mailspring-component-kit';
import { React, ReactDOM, Actions } from 'mailspring-exports';
import { shell, remote } from 'electron';
import path from 'path';
import TemplateStore from './template-store';
import TemplateActions from './template-actions';

const {
  Conversion: { convertFromHTML, convertToHTML },
} = ComposerSupport;

const TEMPLATEFIELDS = ['CC', 'BCC'];

function fileIsImage(file) {
  const extensions = ['.jpg', '.bmp', '.gif', '.png', '.jpeg', '.heic'];
  const ext = path.extname(file).toLowerCase();
  return extensions.includes(ext);
}

class TemplateEditor extends React.Component {
  constructor(props) {
    super(props);

    const { path: templatePath, CC, BCC } = props.template || {};

    const state = {
      CC: CC || '',
      showCC: !!CC,
      BCC: BCC || '',
      showBCC: !!BCC,
    };

    if (templatePath) {
      const inHTML = fs.readFileSync(templatePath).toString();
      this.state = {
        editorState: convertFromHTML(inHTML),
        readOnly: false,
        ...state,
      };
    } else {
      this.state = {
        editorState: convertFromHTML(''),
        readOnly: true,
        ...state,
      };
    }
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
  }
  componentWillUnmount() {
    this._mounted = false;
  }

  _onSave = () => {
    if (this.state.readOnly) {
      return;
    }
    const { template } = this.props;
    const outHTML = convertToHTML(this.state.editorState);
    TemplateActions.updateTemplateBody(template.name, outHTML);
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
      if (!paths || !paths.length || !this._mounted) {
        return;
      }
      TemplateActions.addAttachmentsToTemplate(this.props.template.name, paths);
    });
  };

  _onRemoveAttachment = index => {
    TemplateActions.removeAttachmentsFromTemplate(this.props.template.name, [index]);
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
    const { template } = this.props;
    const files = template && template.files ? template.files : [];
    const fileComponents = files.map((file, index) => {
      const fileName = path.basename(file);
      return (
        <AttachmentItem
          key={index}
          draggable={false}
          className="template-file"
          filePath={file}
          displayName={fileName}
          isImage={fileIsImage(fileName)}
          accountId={''}
          onRemoveAttachment={() => {
            this._onRemoveAttachment(index);
          }}
          onOpenAttachment={() => remote.shell.openItem(file)}
        />
      );
    });
    return <div className={'attachments'}>{fileComponents}</div>;
  }

  render() {
    const { onEditTitle, template } = this.props;
    const { readOnly, editorState } = this.state;

    return (
      <div className={`template-wrap ${readOnly && 'empty'}`}>
        <div className="section basic-info">
          <input
            type="text"
            id="title"
            placeholder="Name"
            style={{ maxWidth: 400 }}
            defaultValue={template ? template.name : ''}
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
            propsForPlugins={{ inTemplateEditor: true }}
            onChange={change => {
              const changeHtml = convertToHTML(change.value);
              if (changeHtml) {
                this.setState({ editorState: change.value });
              } else {
                this.setState({ editorState: convertFromHTML('<br />') });
              }
            }}
            onBlur={this._onSave}
            onFileReceived={() => {
              // This method ensures that HTML can be pasted.
            }}
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
    this.unsubscribers = [
      TemplateStore.listen(() => {
        this.setState(this._getStateFromStores());
      }),
    ];
  }

  componentWillUnmount() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
  }

  _getStateFromStores() {
    const templates = TemplateStore.items().map(t => {
      const tConfig = TemplateStore.templateConfig(t.id);
      return {
        ...t,
        ...tConfig,
      };
    });

    const selectedName = TemplateStore.selectedTemplateName();
    let selected = templates.find(t => t.name === selectedName);
    if (!selected) {
      selected = templates[0];
    }
    return {
      templates,
      selected,
    };
  }

  _onAdd = () => {
    TemplateActions.createTemplate({ name: 'Untitled', contents: 'Insert content here!' });
  };

  _onDelete = item => {
    TemplateActions.deleteTemplate(item.name);
  };

  _onEditTitle = newName => {
    if (this.state.selected.name === newName) {
      return;
    }
    TemplateActions.renameTemplate(this.state.selected.name, newName);
  };

  _onChangeField = (field, value) => {
    TemplateActions.changeTemplateField(this.state.selected.name, field, value);
  };

  _onSelect = item => {
    Actions.selectTemplate(item);
  };

  render() {
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
      <div className="preferences-templates-container">
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
            itemContent={template => <div className="title">{template.name}</div>}
            onCreateItem={this._onAdd}
            onDeleteItem={this._onDelete}
            onItemEdited={this._onEditTitle}
            onSelectItem={this._onSelect}
            selected={this.state.selected}
            footer={footer}
          />

          <TemplateEditor
            onEditTitle={this._onEditTitle}
            key={selected ? selected.name : 'empty'}
            template={selected}
            onEditField={this._onChangeField}
          />
        </Flexbox>
      </div>
    );
  }
}
