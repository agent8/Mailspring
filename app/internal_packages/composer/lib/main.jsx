/* eslint react/sort-comp: 0 */
import _ from 'underscore';
import React from 'react';
import { ipcRenderer } from 'electron';
import {
  Message,
  DraftStore,
  WorkspaceStore,
  ComponentRegistry,
  InflatesDraftClientId,
  Actions,
} from 'mailspring-exports';
import ComposeButton from './compose-button';
import RefreshButton from './refresh-button';
import ComposerView from './composer-view';

const ComposerViewForDraftClientId = InflatesDraftClientId(ComposerView);

class ComposerWithWindowProps extends React.Component {
  static displayName = 'ComposerWithWindowProps';
  static containerRequired = false;

  constructor(props) {
    super(props);

    // We'll now always have windowProps by the time we construct this.
    const windowProps = AppEnv.getWindowProps();
    const { draftJSON, messageId } = windowProps;
    if (!draftJSON) {
      throw new Error('Initialize popout composer windows with valid draftJSON');
    }
    const draft = new Message().fromJSON(draftJSON);
    this.state = windowProps;
    this._mounted = false;
    this._unlisten = Actions.changeDraftAccountComplete.listen(
      this._onDraftChangeAccountComplete,
      this
    );
    if (draft.savedOnRemote) {
      console.log('savedOnRemote');
      DraftStore.sessionForServerDraft(draft).then(session => {
        const newDraft = session.draft();
        if (!this._mounted) {
          console.log('changed messageId');
          this.state.messageId = newDraft.id;
        } else {
          console.log('changing messageId');
          this.setState({ messageId: newDraft.id });
        }
      });
    } else {
      DraftStore._createSession(messageId, draft);
      this.state.messageId = draft.id;
    }
  }
  UNSAFE_componentWillMount() {
    ipcRenderer.on('draft-got-new-id', this._onDraftGotNewId);
  }
  componentDidMount() {
    this._mounted = true;
  }

  _onDraftChangeAccountComplete = ({ newDraftJSON, originalMessageId }) => {
    // Because we transform in action-bridge, this is actually message model.
    if (!this._mounted) {
      return;
    }
    if (!originalMessageId) {
      AppEnv.logError(`originalMessageId not found`);
      return;
    }
    if (!this.state.messageId || this.state.messageId !== originalMessageId) {
      AppEnv.logDebug(`Not for this message ${originalMessageId}, ${this.state.messageId}`);
      return;
    }
    const draft = new Message(newDraftJSON);
    if (draft.savedOnRemote) {
      DraftStore.sessionForServerDraft(draft).then(session => {
        const newDraft = session.draft();
        if (newDraft) {
          this.setState({ messageId: newDraft.id });
        }
      });
    } else {
      DraftStore._createSession(draft.id, draft);
      this.setState({ messageId: draft.id });
    }
  };

  _onDraftGotNewId = (event, options) => {
    if (
      options.oldMessageId &&
      options.newMessageId &&
      options.oldMessageId === this.state.messageId
    ) {
      this.setState({
        messageId: options.newMessageId,
      });
    }
  };

  componentWillUnmount() {
    this._mounted = false;
    if (this._usub) {
      this._usub();
    }
    this._unlisten();
    ipcRenderer.removeListener('draft-got-new-id', this._onDraftGotNewId);
  }

  componentDidUpdate() {
    this._composerComponent.focus();
  }

  _onDraftReady = () => {
    this._composerComponent.focus().then(() => {
      AppEnv.displayWindow();

      if (this.state.errorMessage) {
        this._showInitialErrorDialog(this.state.errorMessage, this.state.errorDetail);
      }
    });
  };

  render() {
    return (
      <ComposerViewForDraftClientId
        ref={cm => {
          this._composerComponent = cm;
        }}
        onDraftReady={this._onDraftReady}
        messageId={this.state.messageId}
        className="composer-full-window"
      />
    );
  }

  _showInitialErrorDialog(msg, detail) {
    // We delay so the view has time to update the restored draft. If we
    // don't delay the modal may come up in a state where the draft looks
    // like it hasn't been restored or has been lost.
    _.delay(() => {
      AppEnv.showErrorDialog({ title: 'Error', message: msg }, { detail: detail });
    }, 100);
  }
}

export function activate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.register(ComposerViewForDraftClientId, {
      role: 'Composer',
    });
    ComponentRegistry.register(ComposeButton, {
      location: WorkspaceStore.Location.RootSidebar,
    });
    ComponentRegistry.register(RefreshButton, {
      location: WorkspaceStore.Location.RootSidebar,
    });
  } else if (AppEnv.isThreadWindow()) {
    ComponentRegistry.register(ComposerViewForDraftClientId, {
      role: 'Composer',
    });
  } else {
    AppEnv.getCurrentWindow().setMinimumSize(480, 250);
    ComponentRegistry.register(ComposerWithWindowProps, {
      location: WorkspaceStore.Location.Center,
    });
  }

  setTimeout(() => {
    // preload the font awesome icons used in the composer after a short delay.
    // unfortunately, the icon set takes enough time to load that it introduces jank
    const i = document.createElement('i');
    i.className = 'fa fa-list';
    i.style.position = 'absolute';
    i.style.opacity = 0;
    i.style.top = 0;
    document.body.appendChild(i);
  }, 1000);
}

export function deactivate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.unregister(ComposerViewForDraftClientId);
    ComponentRegistry.unregister(ComposeButton);
    ComponentRegistry.unregister(RefreshButton);
  } else {
    ComponentRegistry.unregister(ComposerWithWindowProps);
  }
}

export function serialize() {
  return this.state;
}
