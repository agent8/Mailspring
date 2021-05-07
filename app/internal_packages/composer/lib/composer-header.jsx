import { React, ReactDOM, PropTypes, Actions, AccountStore, Constant } from 'mailspring-exports';
import {
  KeyCommandsRegion,
  ParticipantsTextField,
  ListensToFluxStore,
} from 'mailspring-component-kit';
import AccountContactField from './account-contact-field';
import ComposerHeaderActions from './composer-header-actions';
import Fields from './fields';

const ScopedFromField = ListensToFluxStore(AccountContactField, {
  stores: [AccountStore],
  getStateFromStores: props => {
    // const savedOrReplyToThread = props.draft.savedOnRemote || props.draft.hasRefOldDraftOnRemote;
    // if (savedOrReplyToThread) {
    //   return { accounts: [AccountStore.accountForId(props.draft.accountId)] };
    // }
    return { accounts: AccountStore.accounts() };
  },
});

export default class ComposerHeader extends React.Component {
  static displayName = 'ComposerHeader';

  static propTypes = {
    draft: PropTypes.object.isRequired,
    session: PropTypes.object.isRequired,
    onClick: PropTypes.func.isRequired,
    onFocusBody: PropTypes.func.isRequired,
  };

  static contextTypes = {
    parentTabGroup: PropTypes.object,
  };

  constructor(props = {}) {
    super(props);
    this._els = {};
    this.state = this._initialStateForDraft(this.props.draft, props);
    this.state.missingAttachments = false;
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
    this._isDraftMissingAttachments(this.props);
  }
  componentWillUnmount() {
    this._mounted = false;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this._ensureFilledFieldsEnabled(nextProps.draft);
    this._isDraftMissingAttachments(nextProps);
  }

  _isDraftMissingAttachments = props => {
    if (!props.draft) {
      this.setState({ missingAttachments: false });
      return;
    }
    props.draft.missingAttachments().then(ret => {
      if (!this._mounted) {
        return;
      }
      const inLines = [];
      ret.inline.downloading.forEach(f => {
        if (f && f.size > Constant.AttachmentFileSizeIgnoreThreshold) {
          inLines.push(f.id);
        }
      });
      ret.inline.needToDownload.forEach(f => {
        if (f && f.size > Constant.AttachmentFileSizeIgnoreThreshold) {
          inLines.push(f.id);
        }
      });
      const normal = [];
      ret.normal.downloading.forEach(f => {
        if (f && f.size > Constant.AttachmentFileSizeIgnoreThreshold) {
          normal.push(f.id);
        }
      });
      ret.normal.needToDownload.map(f => {
        if (f && f.size > Constant.AttachmentFileSizeIgnoreThreshold) {
          normal.push(f.id);
        }
      });
      if (inLines.length > 0 || normal.length > 0) {
        if (!this.state.missingAttachments) {
          this.setState({ missingAttachments: true });
          if (inLines.length > 0) {
            Actions.pushToFetchAttachmentsQueue({
              accountId: props.draft.accountId,
              missingItems: inLines,
              needProgress: false,
              source: 'Click',
            });
          }
          if (normal.length > 0) {
            Actions.pushToFetchAttachmentsQueue({
              accountId: props.draft.accountId,
              missingItems: normal,
              needProgress: true,
              source: 'Click',
            });
          }
        }
      } else {
        this.setState({ missingAttachments: false });
      }
    });
  };

  focus() {
    if (this.props.draft.to.length === 0) {
      this.showAndFocusField(Fields.To);
    } else if (this._els[Fields.Subject]) {
      this._els[Fields.Subject].focus();
    }
  }

  showAndFocusField = fieldName => {
    this.setState(
      {
        enabledFields: this.state.enabledFields.filter(f => f !== fieldName).concat([fieldName]),
      },
      () => {
        this._els[fieldName].focus();
      }
    );
  };

  hideField = fieldName => {
    if (ReactDOM.findDOMNode(this._els[fieldName]).contains(document.activeElement)) {
      this.context.parentTabGroup.shiftFocus(-1);
    }

    const enabledFields = this.state.enabledFields.filter(n => n !== fieldName);
    this.setState({ enabledFields });
  };

  _ensureFilledFieldsEnabled(draft) {
    let enabledFields = this.state.enabledFields;
    if (draft.cc.length && !enabledFields.find(f => f === Fields.Cc)) {
      enabledFields = [Fields.Cc].concat(enabledFields);
    }
    if (draft.bcc.length && !enabledFields.find(f => f === Fields.Bcc)) {
      enabledFields = [Fields.Bcc].concat(enabledFields);
    }
    if (enabledFields !== this.state.enabledFields) {
      this.setState({ enabledFields });
    }
  }

  _initialStateForDraft(draft, props) {
    const enabledFields = [Fields.To];
    if (draft.cc.length > 0) enabledFields.push(Fields.Cc);
    if (draft.bcc.length > 0) enabledFields.push(Fields.Bcc);
    if (draft.isNewDraft() || draft.isForwardDraft()) {
      const showCCBCC = AppEnv.config.get('core.composing.showCcAndBcc');
      if (
        draft.cc.length === 0 &&
        (showCCBCC === Constant.showCC || showCCBCC === Constant.showCCAndBCC)
      ) {
        enabledFields.push(Fields.Cc);
      }
      if (draft.bcc.length === 0 && showCCBCC === Constant.showCCAndBCC) {
        enabledFields.push(Fields.Bcc);
      }
    }
    enabledFields.push(Fields.From);
    if (this._shouldEnableSubject()) {
      enabledFields.push(Fields.Subject);
    }
    return {
      enabledFields,
    };
  }

  _shouldEnableSubject = () => {
    if ((this.props.draft.subject || '').trim().length === 0) {
      return true;
    }
    if (this.props.draft.isForwarded()) {
      return true;
    }
    if (this.props.draft.replyToMessageId) {
      return false;
    }
    return true;
  };

  _getToName(participants) {
    if (!participants || !Array.isArray(participants.to) || participants.to.length === 0) {
      return '';
    }
    return participants.to[0].name;
  }
  _onHeaderClicked = () => {
    if (this.props.onClick) {
      this.props.onClick();
    }
  };

  _onChangeParticipants = changes => {
    this.props.session.changes.add(changes);
    Actions.draftParticipantsChanged(this.props.draft.id, changes);
    if (AppEnv.isComposerWindow()) {
      Actions.setCurrentWindowTitle(this._getToName(changes));
    }
  };
  _onSubjectKeyDown = event => {
    if (['Tab'].includes(event.key)) {
      this._onTab('subject');
    }
  };
  _onTab = field => {
    let focusBody = false;
    let checkFields = [];
    if (field === 'to') {
      checkFields = ['textFieldCc', 'textFieldBcc', 'textFieldSubject'];
    } else if (field === 'cc') {
      checkFields = ['textFieldBcc', 'textFieldSubject'];
    } else if (field === 'bcc') {
      checkFields = ['textFieldSubject'];
    } else if (field === 'subject') {
      focusBody = true;
    }
    const enableFields = Array.isArray(this.state.enabledFields) ? this.state.enabledFields : [];
    focusBody = focusBody || !enableFields.some(el => checkFields.includes(el));
    if (this.props.onFocusBody && focusBody) {
      this.props.onFocusBody();
    }
  };

  _onSubjectChange = event => {
    if (event.target.value === this.props.draft.subject) {
      return;
    }

    this.props.session.changes.add({ subject: event.target.value, subjectChanged: true });
  };

  _draftNotReady = () => {
    return this.props.session.isPopout();
  };

  _renderSubject = () => {
    const enabledFields = this.state.enabledFields || [];
    if (!enabledFields.includes(Fields.Subject)) {
      return false;
    }
    return (
      <KeyCommandsRegion tabIndex={-1} className="composer-subject subject-field">
        <input
          ref={el => {
            if (el) {
              this._els[Fields.Subject] = el;
            }
          }}
          type="text"
          name="subject"
          placeholder="Subject"
          value={this.props.draft.subject}
          onKeyDown={this._onSubjectKeyDown}
          onChange={this._onSubjectChange}
          onBlur={this._onSubjectChange}
          onClick={this._onSubjectChange}
          disabled={this._draftNotReady()}
        />
      </KeyCommandsRegion>
    );
  };

  _renderFields = () => {
    const { to, cc, bcc, from } = this.props.draft;

    // Note: We need to physically add and remove these elements, not just hide them.
    // If they're hidden, shift-tab between fields breaks.
    const fields = [];
    const enabledFields = this.state.enabledFields || [];
    fields.push(
      <ParticipantsTextField
        ref={el => {
          if (el) {
            this._els[Fields.To] = el;
          }
        }}
        key="to"
        field="to"
        change={this._onChangeParticipants}
        className="composer-participant-field to-field"
        participants={{ to, cc, bcc }}
        draft={this.props.draft}
        session={this.props.session}
        onTab={this._onTab}
        disabled={this._draftNotReady()}
      />
    );

    if (enabledFields.includes(Fields.Cc)) {
      fields.push(
        <ParticipantsTextField
          ref={el => {
            if (el) {
              this._els[Fields.Cc] = el;
            }
          }}
          key="cc"
          field="cc"
          change={this._onChangeParticipants}
          onEmptied={() => this.hideField(Fields.Cc)}
          className="composer-participant-field cc-field"
          participants={{ to, cc, bcc }}
          draft={this.props.draft}
          session={this.props.session}
          onTab={this._onTab}
          disabled={this._draftNotReady()}
        />
      );
    }

    if (enabledFields.includes(Fields.Bcc)) {
      fields.push(
        <ParticipantsTextField
          ref={el => {
            if (el) {
              this._els[Fields.Bcc] = el;
            }
          }}
          key="bcc"
          field="bcc"
          change={this._onChangeParticipants}
          onEmptied={() => this.hideField(Fields.Bcc)}
          className="composer-participant-field bcc-field"
          participants={{ to, cc, bcc }}
          draft={this.props.draft}
          session={this.props.session}
          onTab={this._onTab}
          disabled={this._draftNotReady()}
        />
      );
    }

    if (enabledFields.includes(Fields.From)) {
      fields.push(
        <ScopedFromField
          key="from"
          ref={el => {
            if (el) {
              this._els[Fields.From] = el;
            }
          }}
          value={from[0]}
          draft={this.props.draft}
          session={this.props.session}
          onChange={this._onChangeParticipants}
          disabled={this._draftNotReady()}
        />
      );
    }

    return fields;
  };

  render() {
    return (
      <div className="composer-header" onClick={this._onHeaderClicked}>
        <ComposerHeaderActions
          messageId={this.props.draft.id}
          enabledFields={this.state.enabledFields}
          onShowAndFocusField={this.showAndFocusField}
        />
        <KeyCommandsRegion
          tabIndex={-1}
          ref={el => {
            if (el) {
              this._els.participantsContainer = el;
            }
          }}
          className="expanded-participants"
        >
          {this._renderFields()}
        </KeyCommandsRegion>
        {this._renderSubject()}
      </div>
    );
  }
}
