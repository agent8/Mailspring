import { React, ReactDOM, AccountStore, SignatureStore, Actions, Utils } from 'mailspring-exports';
import {
  RetinaImg,
  Flexbox,
  EditableList,
  ComposerEditor,
  ComposerSupport,
} from 'mailspring-component-kit';
import SignatureAccountDefaultPicker from './signature-account-default-picker';

const {
  Conversion: { convertFromHTML, convertToHTML },
} = ComposerSupport;

class SignatureEditor extends React.Component {
  constructor(props) {
    super(props);
    const signatureId = this.props.signature ? this.props.signature.id : '';
    const body = SignatureStore.getBodyById(signatureId);
    this.state = {
      editorState: convertFromHTML(body),
    };
  }

  _onBaseFieldChange = event => {
    const { id, value } = event.target;
    const sig = this.props.signature;
    Actions.upsertSignature(Object.assign({}, sig, { [id]: value }), sig.id);
  };

  _onSave = () => {
    const sig = Object.assign({}, this.props.signature);
    sig.body = convertToHTML(this.state.editorState);
    Actions.upsertSignature(sig, sig.id);
  };

  _onFocusEditor = e => {
    if (e.target === ReactDOM.findDOMNode(this._composer)) {
      this._composer.focusEndAbsolute();
    }
  };

  render() {
    const { accounts, defaults } = this.props;
    const { editorState } = this.state;

    let signature = this.props.signature;
    let empty = false;
    if (!signature) {
      signature = {};
      empty = true;
    }

    return (
      <div className={`signature-wrap ${empty && 'empty'}`}>
        <div className="section basic-info">
          <input
            className={signature.title && signature.title !== 'Untitled' ? 'black' : null}
            key="signatureName"
            type="text"
            id="title"
            placeholder="Name"
            value={signature.title || ''}
            onChange={this._onBaseFieldChange}
          />
        </div>

        <div className="section editor" onClick={this._onFocusEditor}>
          <ComposerEditor
            ref={c => (this._composer = c)}
            readOnly={false}
            value={editorState}
            propsForPlugins={{}}
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
    return {
      signatures: SignatureStore.getSignatures(),
      selectedSignature: SignatureStore.selectedSignature(),
      defaults: SignatureStore.getDefaults(),
      accounts: AccountStore.accounts(),
    };
  }

  _onAddSignature = () => {
    const id = Utils.generateTempId();
    const defaultTemplate = SignatureStore.getDefaultTemplate();

    Actions.upsertSignature(
      {
        id,
        title: 'Untitled',
        body: defaultTemplate.body,
      },
      id
    );
    Actions.selectSignature(id);
  };

  _onDeleteSignature = signature => {
    Actions.removeSignature(signature);
  };

  _onEditSignatureTitle = nextTitle => {
    const { title, ...rest } = this.state.selectedSignature;
    Actions.upsertSignature({ title: nextTitle, ...rest }, rest.id);
  };

  _onSelectSignature = sig => {
    Actions.selectSignature(sig.id);
  };

  _renderSig = sig => {
    let checkedAccountLength = 0;
    let checkedAliasLength = 0;
    this.state.accounts.forEach(account => {
      if (this.state.defaults[account.emailAddress] === sig.id) {
        checkedAccountLength += 1;
      }
      (account.aliases || []).forEach(aliase => {
        if (this.state.defaults[aliase] === sig.id) {
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
    const sigArr = Object.values(this.state.signatures);
    const footer = (
      <div className="btn-primary buttons-add" onClick={this._onAddSignature}>
        <RetinaImg
          name={`add.svg`}
          style={{ width: 19, height: 19 }}
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
            items={sigArr}
            showFooter
            itemContent={this._renderSig}
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
            defaults={this.state.defaults}
            key={this.state.selectedSignature ? this.state.selectedSignature.id : 'empty'}
            accounts={this.state.accounts}
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
