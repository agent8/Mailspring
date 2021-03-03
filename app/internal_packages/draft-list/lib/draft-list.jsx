import React from 'react';
import { Actions, DraftStore, Constant } from 'mailspring-exports';
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
    this.unsubscribers = [];
    this.unsubscribers.push(Actions.changeAccountColor.listen(this.forceUpdate, this));
    this._mounted = true;
  }
  componentWillUnmount() {
    this.unsubscribers.map(unsubscribe => unsubscribe());
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
    };
  };

  _onClick = draft => {
    if (this._isOpeningDraftCoolDown()) {
      return;
    }
    if (DraftStore.isSendingDraft(draft.id)) {
      AppEnv.showErrorDialog('Draft is sending, cannot edit', {
        showInMainWindow: true,
        async: true,
      });
      return;
    }
    if (!!draft.body || !!draft.snippet) {
      draft.missingAttachments().then(ret => {
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
        if (inLines.length > 0) {
          Actions.fetchAttachments({
            accountId: draft.accountId,
            missingItems: inLines,
            needProgress: false,
            source: 'Click',
          });
        }
        if (normal.length > 0) {
          Actions.fetchAttachments({
            accountId: draft.accountId,
            missingItems: normal,
            needProgress: true,
            source: 'Click',
          });
        }
        if (inLines.length > 0 || normal.length > 0) {
          AppEnv.showMessageBox({
            title: 'Attachments still downloading',
            detail:
              "Attachments still downloading, opening draft now will cause draft to loose it's attachments",
            buttons: ['Cancel', 'Open'],
            cancelId: 0,
            defaultId: 0,
          }).then(({ response } = {}) => {
            if (response === 1) {
              Actions.composePopoutDraft(draft.id, { ignoreMissingAttachments: true });
              AppEnv.logDebug(`User opened draft ${draft.id} while attachments are missing`);
            }
          });
        } else {
          Actions.composePopoutDraft(draft.id);
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
    if (this._isOpeningTimer) {
      return true;
    }
    this._isOpeningTimer = setTimeout(() => {
      this._isOpeningTimer = false;
    }, buttonTimer);
    return false;
  };

  _onRemoveFromView = () => {
    if (!this.state.isDeleting && !this._deletingTimer) {
      this._changeBackToNotDeleting();
      this.setState({ isDeleting: true });
      Actions.destroyDraft(DraftListStore.dataSource().selection.items(), {
        source: 'DraftList:_onRemoveFromView',
      });
    }
  };
}

module.exports = DraftList;
