import fs from 'fs';
import {
  RetinaImg,
  Flexbox,
  EditableList,
  ComposerEditor,
  ComposerSupport,
} from 'mailspring-component-kit';
import { React, ReactDOM } from 'mailspring-exports';
import { shell } from 'electron';

import TemplateStore from './template-store';
import TemplateActions from './template-actions';

const {
  Conversion: { convertFromHTML, convertToHTML },
} = ComposerSupport;

const TEMPLATEFIELDS = ['CC', 'BCC'];

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
  }

  _onSave = () => {
    if (!this.state.readOnly) {
      const outHTML = convertToHTML(this.state.editorState);
      fs.writeFileSync(this.props.template.path, outHTML);
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
    let lastSelName = null;
    let lastSelIndex = null;
    if (this.state) {
      lastSelName = this.state.selected && this.state.selected.name;
      lastSelIndex = this.state.templates.findIndex(t => t.name === lastSelName);
    }

    const templates = TemplateStore.items().map(t => {
      const tConfig = TemplateStore.templateConfig(t.id);
      return {
        ...t,
        ...tConfig,
      };
    });
    let selected = templates.find(t => t.name === lastSelName) || templates[lastSelIndex] || null;
    if (!selected && templates.length > 0) {
      selected = templates[0];
    }

    return {
      templates,
      selected,
    };
  }

  _onAdd = () => {
    TemplateActions.createTemplate(
      { name: 'Untitled', contents: 'Insert content here!' },
      template => {
        if (template) {
          this.setState({ selected: template });
        }
      }
    );
  };

  _onDelete = item => {
    TemplateActions.deleteTemplate(item.name);
  };

  _onEditTitle = newName => {
    TemplateActions.renameTemplate(this.state.selected.name, newName);
  };

  _onChangeField = (field, value) => {
    TemplateActions.changeTemplateField(this.state.selected.name, field, value);
  };

  _onSelect = item => {
    this.setState({ selected: item });
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
