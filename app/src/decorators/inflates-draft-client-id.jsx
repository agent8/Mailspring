import React from 'react';
import PropTypes from 'prop-types';
import DraftStore from '../flux/stores/draft-store';
import Actions from '../flux/actions';
import Message from '../flux/models/message';
import Utils from '../flux/models/utils';

function InflatesDraftClientId(ComposedComponent) {
  return class extends React.Component {
    static displayName = `${ComposedComponent.displayName}-inflate`;

    static propTypes = {
      messageId: PropTypes.string,
      onDraftReady: PropTypes.func,
    };

    static defaultProps = {
      onDraftReady: () => {},
    };

    static containerRequired = false;

    constructor(props) {
      super(props);
      this.state = {
        session: null,
        draft: null,
      };
      if (AppEnv.isMainWindow()) {
        this._windowLevel = 1;
      } else if (AppEnv.isComposerWindow()) {
        this._windowLevel = 3;
      } else {
        this._windowLevel = 2;
      }
      this._sessionUnlisten = null;
    }

    componentDidMount() {
      this._mounted = true;
      if (
        this.props.draft &&
        this.props.draft.savedOnRemote &&
        !Message.compareMessageState(this.props.draft.state, Message.messageSyncState.sending) &&
        !Message.compareMessageState(this.props.draft.state, Message.messageSyncState.failing) &&
        !Message.compareMessageState((this.props.draft.state, Message.messageSyncState.failed))
      ) {
        this._prepareServerDraftForEdit(this.props.draft);
      } else {
        if (
          this.props.draft &&
          (Message.compareMessageState(this.props.draft.state, Message.messageSyncState.sending) ||
            Message.compareMessageState(this.props.draft.state, Message.messageSyncState.failing))
        ) {
          AppEnv.reportError(
            new Error('Draft editing session should not have sending/failing state drafts'),
            { errorData: this.props.draft }
          );
        } else {
          this._prepareForDraft(this.props.messageId);
        }
      }
    }

    componentWillUnmount() {
      this._mounted = false;
      this._teardownForDraft({ messageId: this.props.messageId });
    }

    UNSAFE_componentWillReceiveProps(newProps) {
      if (newProps.messageId !== this.props.messageId) {
        // console.log(`new props: ${JSON.stringify(newProps)}`);
        this._teardownForDraft({ messageId: this.props.messageId });
        if (
          newProps.draft &&
          newProps.draft.savedOnRemote &&
          !Message.compareMessageState(newProps.draft.state, Message.messageSyncState.sending) &&
          !Message.compareMessageState(newProps.draft.state, Message.messageSyncState.failing) &&
          !Message.compareMessageState(newProps.draft.state, Message.messageSyncState.failed)
        ) {
          this._prepareServerDraftForEdit(newProps.draft);
        } else {
          this._prepareForDraft(newProps.messageId);
        }
      }
    }

    _prepareServerDraftForEdit(draft) {
      if (draft.savedOnRemote) {
        DraftStore.sessionForServerDraft(draft).then(session => {
          const shouldSetState = () => {
            if (!session) {
              AppEnv.reportError(new Error('session not available'));
              return false;
            }
            const newDraft = session.draft();
            let sameDraftWithNewID = false; // account for when draft gets new id because of being from remote
            if (newDraft && newDraft.refOldDraftMessageId) {
              sameDraftWithNewID = newDraft.refOldDraftMessageId === this.props.messageId;
            }
            return (
              this._mounted &&
              (newDraft.refOldDraftMessageId === this.props.messageId || sameDraftWithNewID)
            );
          };
          if (!shouldSetState()) {
            return;
          }
          this._sessionUnlisten = session.listen(() => {
            // console.log('inflates, data change');
            if (!shouldSetState()) {
              console.log('-------------------inflate-draft-cilent-id--------------- ');
              console.log('did not update state');
              console.log('------------------------------------- ');
              return;
            }
            if (this._mounted) {
              this.setState({ draft: session.draft() });
            }
          });
          if (this._mounted) {
            this.setState({
              session: session,
              draft: session.draft(),
            });
            this.props.onDraftReady();
          }
        });
      }
    }

    _prepareForDraft(messageId) {
      if (!messageId) {
        return;
      }
      DraftStore.sessionForClientId(messageId).then(session => {
        const shouldSetState = () => {
          if (!session) {
            AppEnv.reportError(new Error('session not available'));
            return false;
          }
          const draft = session.draft();
          let sameDraftWithNewID = false; // account for when draft gets new id because of being from remote
          if (draft && draft.refOldDraftMessageId) {
            sameDraftWithNewID = draft.refOldDraftMessageId === messageId;
          }
          return (
            this._mounted && (session.messageId === this.props.messageId || sameDraftWithNewID)
          );
        };
        if (!shouldSetState()) {
          console.log('-------------------inflate-draft-cilent-id--------------- ');
          console.log('did not update state');
          console.log('------------------------------------- ');
          return;
        }
        // if (this._sessionUnlisten) {
        //   this._sessionUnlisten();
        // }
        this._sessionUnlisten = session.listen(() => {
          // console.log('inflates, data change');
          if (!shouldSetState()) {
            console.log('-------------------inflate-draft-cilent-id--------------- ');
            console.log('did not update state');
            console.log('------------------------------------- ');
            return;
          }
          if (this._mounted) {
            this.setState({ draft: session.draft() });
          } else {
            console.error(`component unmounted, session draft ${session.draft()}`);
          }
        });
        if (this._mounted) {
          this.setState({
            session: session,
            draft: session.draft(),
          });
          this.props.onDraftReady();
        } else {
          console.error(`component unmounted, session draft ${session.draft()}`);
        }
      });
    }

    _teardownForDraft({ messageId } = {}) {
      if (!messageId) {
        AppEnv.logError('headerMessageId is null');
        return;
      }
      if (this._sessionUnlisten) {
        this._sessionUnlisten();
      }
      if (this.state.draft) {
        if (messageId !== this.state.draft.id) {
          AppEnv.logWarning(
            `MessageId is inconsisstent, input: ${messageId}, state: ${this.state.draft.id}`
          );
        }
        Actions.draftWindowClosing({
          messageIds: [messageId],
          windowLevel: this._windowLevel,
          source: 'componentWillUnmount',
        });
      }
    }

    // Returns a promise for use in composer/main.es6, to show the window
    // once the composer is rendered and focused.
    focus() {
      return Utils.waitFor(() => this.refs.composed)
        .then(() => this.refs.composed.focus())
        .catch(() => {});
    }

    render() {
      if (!this.state.draft) {
        return <span />;
      }
      return (
        <ComposedComponent
          key={this.state.draft.id}
          ref="composed"
          {...this.props}
          {...this.state}
        />
      );
    }
  };
}

export default InflatesDraftClientId;
