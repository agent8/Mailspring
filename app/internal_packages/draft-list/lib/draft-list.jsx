import React from 'react';
import { Actions, DraftStore } from 'mailspring-exports';
import {
  FluxContainer,
  FocusContainer,
  EmptyListState,
  MultiselectList,
} from 'mailspring-component-kit';
import DraftListStore from './draft-list-store';
import DraftListColumns from './draft-list-columns';

const buttonTimer = 500;
class DraftList extends React.Component {
  static displayName = 'DraftList';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = {
      isDeleting: false,
    };
    this._mounted = false;
    this._deletingTimer = false;
    this._isOpeningTimer = false;
  }
  componentDidMount() {
    this._mounted = true;
  }
  componentWillUnmount() {
    this._mounted = false;
    clearTimeout(this._deletingTimer);
    clearTimeout(this._isOpeningTimer);
  }

  render() {
    return (
      <FluxContainer
        stores={[DraftListStore]}
        getStateFromStores={() => {
          return { dataSource: DraftListStore.dataSource() };
        }}
      >
        <FocusContainer collection="draft">
          <MultiselectList
            className="draft-list"
            columns={DraftListColumns.Wide}
            onClick={this._onClick}
            EmptyComponent={EmptyListState}
            keymapHandlers={this._keymapHandlers()}
            itemPropsProvider={this._itemPropsProvider}
            itemHeight={55}
          />
        </FocusContainer>
      </FluxContainer>
    );
  }

  _itemPropsProvider = draft => {
    const props = {};
    if (draft.uploadTaskId) {
      props.className = 'sending';
    }
    return props;
  };

  _keymapHandlers = () => {
    return {
      'core:delete-item': this._onRemoveFromView,
      // 'core:gmail-remove-from-view': this._onRemoveFromView,
      'core:remove-from-view': this._onRemoveFromView,
    };
  };

  _onClick = draft => {
    if(this._isOpeningDraftCoolDown()){
      return;
    }
    if (DraftStore.isSendingDraft(draft.headerMessageId)) {
      AppEnv.showErrorDialog('Draft is sending, cannot edit', {
        showInMainWindow: true,
        async: true,
      });
      return;
    }
    if (!!draft.body || !!draft.snippet) {
      draft.missingAttachments().then(ret => {
        const totalMissing = ret.totalMissing().map(f => f.id);
        if (totalMissing.length === 0) {
          Actions.composePopoutDraft(draft.headerMessageId);
        } else {
          Actions.fetchAttachments({ accountId: draft.accountId, missingItems: totalMissing });
          AppEnv.showErrorDialog('Draft is still downloading, cannot edit', {
            showInMainWindow: true,
            async: true,
          });
        }
      });
    } else {
      Actions.fetchBodies({ messages: [draft], source: 'draft' });
      AppEnv.showErrorDialog('Draft is still downloading, cannot edit', {
        showInMainWindow: true,
        async: true,
      });
    }
  };
  _changeBackToNotDeleting = () => {
    if (this._deletingTimer) {
      return;
    }
    this._deletingTimer = setTimeout(() => {
      if (this._mounted) {
        this.setState({ isDeleting: false });
      }
      this._deletingTimer = null;
    }, buttonTimer);
  };
  _isOpeningDraftCoolDown = () => {
    if(this._isOpeningTimer){
      return true;
    }
    this._isOpeningTimer = setTimeout(()=>{
      this._isOpeningTimer = false;
    }, buttonTimer);
    return false;
  };

  _onRemoveFromView = () => {
    if (!this.state.isDeleting && !this._deletingTimer) {
      this._changeBackToNotDeleting();
      this.setState({ isDeleting: true });
      Actions.destroyDraft(DraftListStore.dataSource().selection.items());
    }
  };
}

module.exports = DraftList;
