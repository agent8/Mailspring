import {
  React,
  ReactDOM,
  AccountStore,
  SignatureStore,
  Actions,
  Utils,
  PropTypes,
} from 'mailspring-exports';
import {
  RetinaImg,
  Flexbox,
  EditableList,
  ComposerEditor,
  ComposerSupport,
} from 'mailspring-component-kit';
import SignatureAccountDefaultPicker from './signature-account-default-picker';
import { CodeBlockPlugin } from './code-block';

const {
  Conversion: { convertFromHTML, convertToHTML },
} = ComposerSupport;

class SignatureEditor extends React.Component {
  static propTypes = {
    signature: PropTypes.object,
    body: PropTypes.string,
    defaults: PropTypes.object,
    accounts: PropTypes.array,
    onEditTitle: PropTypes.func,
    onEditField: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { attachments } = props.signature || {};
    const body = props.body || '';
    this.state = {
      body,
      editorState: convertFromHTML(body),
      attachments: attachments || [],
      editCode: false,
      CodeEditor: () => {},
      readOnly: !props.signature,
    };
  }

  componentDidMount() {
    // lazy loader
    const CodeEditor = require('./code-editor').default;
    this.setState({ CodeEditor });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const body = nextProps.body || '';
    if (body !== this.props.body) {
      this.setState({
        body,
        editorState: convertFromHTML(body || ''),
      });
    }
  }

  _onSave = () => {
    if (this.state.readOnly) {
      return;
    }
    const sig = Object.assign({}, this.props.signature);
    sig.body = this.state.body;
    // if delete the inline, should filter it
    const filterAttachment = this.state.attachments.filter(
      a => !a.inline || this.state.body.indexOf(`src="${a.path}"`) >= 0
    );
    sig.attachments = filterAttachment;
    this.setState({ attachments: filterAttachment });
    Actions.updateSignature(sig);
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

  _onBlurEditor = () => {
    const { editorState } = this.state;
    this._updateBodyAndEditorHTMLByEditorHTML(convertToHTML(editorState));
  };

  _onToggleCodeBlockEditor = () => {
    this.setState({
      editCode: !this.state.editCode,
    });
  };

  _onSubmitEditHTML = html => {
    const value = html || '<br />';
    this._updateBodyAndEditorHTMLByBodyHTML(value);
    this._onToggleCodeBlockEditor();
  };

  _onCancelEditHTML = () => {
    this._onToggleCodeBlockEditor();
  };

  _updateBodyAndEditorHTMLByBodyHTML = value => {
    this.setState({ body: value, editorState: convertFromHTML(value) }, this._onSave);
  };

  _updateBodyAndEditorHTMLByEditorHTML = value => {
    const { body } = this.state;
    const bodyTransformByEditor = convertToHTML(convertFromHTML(body));
    // If the html of body that is converted by editor is different from the EditorHTML
    // update the body and editorState, otherwise skip it
    if (bodyTransformByEditor !== value) {
      this.setState({ body: value, editorState: convertFromHTML(value) }, this._onSave);
    }
  };

  render() {
    const { accounts, defaults, onEditTitle, signature = {} } = this.props;
    const { editorState, body, editCode, CodeEditor, readOnly } = this.state;

    return (
      <div className={`signature-wrap ${readOnly && 'empty'}`}>
        <div className="section basic-info">
          <input
            className={signature.title && signature.title !== 'Untitled' ? 'black' : null}
            key="signatureName"
            type="text"
            id="title"
            placeholder="Name"
            defaultValue={signature ? signature.title : ''}
            onBlur={e => onEditTitle(e.target.value)}
          />
        </div>

        {editCode ? (
          <CodeEditor
            value={body}
            onSubmit={this._onSubmitEditHTML}
            onCancel={this._onCancelEditHTML}
          />
        ) : (
          <div className="section editor" onClick={this._onFocusEditor}>
            <ComposerEditor
              ref={c => (this._composer = c)}
              readOnly={false}
              value={editorState}
              outerPlugin={CodeBlockPlugin(this._onToggleCodeBlockEditor)}
              onChange={change => {
                const changeHtml = convertToHTML(change.value);
                if (changeHtml) {
                  this.setState({ editorState: change.value });
                } else {
                  this.setState({ editorState: convertFromHTML('<br />') });
                }
              }}
              onBlur={this._onBlurEditor}
              onFileReceived={this._onFileReceived}
              onAddAttachments={this._onAddInlineImage}
            />
          </div>
        )}
        <SignatureAccountDefaultPicker
          signature={signature}
          accounts={accounts}
          defaults={defaults}
        />
        {/*TODO: edison feature disabled*/}
        {/*<SignaturePhotoPicker*/}
        {/*id={signature.id}*/}
        {/*data={data}*/}
        {/*resolvedURL={resolvedData.photoURL}*/}
        {/*onChange={this._onDataFieldChange}*/}
        {/*/>*/}
      </div>
    );
  }
}

export default class PreferencesSignatures extends React.Component {
  static displayName = 'PreferencesSignatures';

  constructor() {
    super();
    this.state = this._getStateFromStores();
  }

  componentDidMount() {
    this.unsubscribers = [SignatureStore.listen(this._onChange)];
  }

  componentWillUnmount() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
  }

  _onChange = () => {
    this.setState(this._getStateFromStores());
  };

  _getStateFromStores() {
    const selected = SignatureStore.selectedSignature();
    const body = selected.id ? SignatureStore.getBodyById(selected.id, true) : '';
    return {
      signatures: SignatureStore.getSignatures(),
      selectedSignature: selected,
      selectedBody: body,
      defaults: SignatureStore.getDefaults(),
      accounts: AccountStore.accounts(),
    };
  }

  _onAddSignature = () => {
    Actions.addSignature();
  };

  _onDeleteSignature = signature => {
    Actions.removeSignature(signature);
  };

  _onEditSignatureTitle = nextTitle => {
    if (!nextTitle) {
      return;
    }
    this._onChangeField('title', nextTitle);
  };

  _onChangeField = (field, value) => {
    const SignatureChangeFields = ['title', 'attachments'];
    if (!SignatureChangeFields.includes(field)) {
      return;
    }
    const sig = Object.assign({}, this.state.selectedSignature);
    sig[field] = value;
    Actions.updateSignature(sig);
  };

  _onSelectSignature = sig => {
    Actions.selectSignature(sig.id);
  };

  _renderSigItem = sig => {
    let checkedAccountLength = 0;
    let checkedAliasLength = 0;
    this.state.accounts.forEach(account => {
      let signatureId =
        typeof account.signatureId === 'function'
          ? account.signatureId()
          : `local-${account.id}-${account.emailAddress}-${account.name}`;
      if (this.state.defaults[signatureId] === sig.id) {
        checkedAccountLength += 1;
      }
      (account.getAllAliasContacts() || []).forEach(alias => {
        signatureId =
          typeof alias.signatureId === 'function'
            ? alias.signatureId()
            : `local-${alias.accountId}-${alias.email}-${alias.name}`;
        if (this.state.defaults[signatureId] === sig.id) {
          checkedAliasLength += 1;
        }
      });
    });

    const checkedAccountStr =
      checkedAccountLength === 0
        ? ''
        : `${checkedAccountLength} account${checkedAccountLength > 1 ? 's' : ''}`;
    const checkedAliasStr =
      checkedAliasLength === 0
        ? ''
        : `${checkedAliasLength} ${checkedAliasLength > 1 ? 'aliases' : 'alias'}`;

    let checkedStr = 'Not currently in use';
    if (checkedAccountStr && checkedAliasStr) {
      checkedStr = `${checkedAccountStr}，${checkedAliasStr}`;
    } else if (checkedAccountStr) {
      checkedStr = checkedAccountStr;
    } else if (checkedAliasStr) {
      checkedStr = checkedAliasStr;
    }
    return (
      <div className="signatures">
        <div className="title">{sig.title}</div>
        <div className={`use-account ${checkedAccountLength + checkedAliasLength ? 'inuse' : ''}`}>
          {checkedStr}
        </div>
      </div>
    );
  };

  _renderSignatures() {
    const { signatures } = this.state;
    const footer = (
      <div className="btn-primary buttons-add" onClick={this._onAddSignature}>
        <RetinaImg
          name={`add.svg`}
          style={{ width: 19, height: 19, fontSize: 19 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
        New Signature
      </div>
    );
    return (
      <div>
        <div className="config-group">
          <h6>SIGNATURES</h6>
          <div className="signatures-note">
            Create email signatures to automatically add to the end of your messages. You can format
            your message be adding images or changing the text style. Add a different signature for
            each account, or use the same one for several accounts.
          </div>
        </div>
        <Flexbox>
          <EditableList
            className="signature-list"
            items={signatures}
            showFooter
            itemContent={this._renderSigItem}
            onCreateItem={this._onAddSignature}
            onDeleteItem={this._onDeleteSignature}
            onItemEdited={this._onEditSignatureTitle}
            onSelectItem={this._onSelectSignature}
            selected={this.state.selectedSignature}
            footer={footer}
            showDelIcon
          />
          <SignatureEditor
            signature={this.state.selectedSignature}
            body={this.state.selectedBody}
            defaults={this.state.defaults}
            key={this.state.selectedSignature ? this.state.selectedSignature.id : 'empty'}
            accounts={this.state.accounts}
            onEditTitle={this._onEditSignatureTitle}
            onEditField={this._onChangeField}
          />
        </Flexbox>
      </div>
    );
  }

  render() {
    return (
      <div className="preferences-signatures-container">
        <section>{this._renderSignatures()}</section>
      </div>
    );
  }
}
