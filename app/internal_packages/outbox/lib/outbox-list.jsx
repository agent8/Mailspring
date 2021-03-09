import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import { Actions, OutboxStore, Message, WorkspaceStore } from 'mailspring-exports';
import {
  FluxContainer,
  FocusContainer,
  EmptyListState,
  MultiselectList,
} from 'mailspring-component-kit';
import OutboxListColumns from './outbox-list-columns';

const buttonTimer = 500;
const PREVIEW_LINES_KEY = 'core.appearance.previewLines';

class OutboxList extends React.Component {
  static displayName = 'OutboxList';
  static containerRequired = true;

  static containerStyles = {
    minWidth: 375,
    maxWidth: 3000,
  };

  constructor(props) {
    super(props);
    this.state = {
      isDeleting: false,
      previewLines: AppEnv.config.get(PREVIEW_LINES_KEY),
    };
    this._mounted = false;
    this._deletingTimer = false;
  }

  componentDidMount() {
    this._mounted = true;
    window.addEventListener('resize', this._onResize, true);
    this._onResize();
    this.disposable = AppEnv.config.onDidChange(PREVIEW_LINES_KEY, () => {
      this.setState({
        previewLines: AppEnv.config.get(PREVIEW_LINES_KEY),
      });
    });
  }

  componentWillUnmount() {
    this._mounted = false;
    window.removeEventListener('resize', this._onResize, true);
    clearTimeout(this._deletingTimer);
    this.disposable.dispose();
  }

  _calcScrollPosition = _.throttle(scrollTop => {
    const toolbar = document.querySelector('.outbox-list .outbox-list-toolbar');
    if (toolbar) {
      if (scrollTop > 0) {
        if (toolbar.className.indexOf('has-shadow') === -1) {
          toolbar.className += ' has-shadow';
        }
      } else {
        toolbar.className = toolbar.className.replace(' has-shadow', '');
      }
    }
  }, 100);

  _onScroll = e => {
    if (e.target) {
      this._calcScrollPosition(e.target.scrollTop);
    }
  };

  _onResize = event => {
    const current = this.state.style;
    const layoutMode = WorkspaceStore.layoutMode();
    // const desired = ReactDOM.findDOMNode(this).offsetWidth < 540 ? 'narrow' : 'wide';
    const desired =
      ReactDOM.findDOMNode(this).offsetWidth < 3900 && layoutMode === 'split' ? 'narrow' : 'wide';
    if (current !== desired) {
      this.setState({ style: desired });
    }
  };
  render() {
    const { previewLines } = this.state;
    const itemHeight = 72 + previewLines * 18;
    return (
      <FluxContainer
        stores={[OutboxStore]}
        getStateFromStores={() => {
          return { dataSource: OutboxStore.dataSource() };
        }}
      >
        <FocusContainer collection="outbox">
          <MultiselectList
            className={`outbox-list outbox-list-narrow preview-${previewLines}`}
            columns={OutboxListColumns.Narrow}
            itemHeight={itemHeight}
            EmptyComponent={EmptyListState}
            keymapHandlers={this._keymapHandlers()}
            columnCheckProvider={this._itemCheckProvider}
            itemPropsProvider={this._itemPropsProvider}
            onScroll={this._onScroll}
          />
        </FocusContainer>
      </FluxContainer>
    );
  }

  _itemCheckProvider = (draft, onClick) => {
    if (Message.compareMessageState(draft.syncState, Message.messageSyncState.failing)) {
      const timeLapsed = draft.lastUpdateTimestamp
        ? Date.now() - draft.lastUpdateTimestamp.getTime()
        : 0;
      if (timeLapsed <= AppEnv.config.get('core.outbox.failingUnlockInMs')) {
        return null;
      }
    }
    const toggle = event => {
      onClick(event);
      event.stopPropagation();
    };
    return (
      <div className="checkmark" onClick={toggle}>
        <div className="inner" />
      </div>
    );
  };

  _itemPropsProvider = draft => {
    const props = {};
    if (Message.compareMessageState(draft.syncState, Message.messageSyncState.failing)) {
      props.className = 'sending';
    }
    return props;
  };

  _keymapHandlers = () => {
    return {
      'core:delete-item': this._onRemoveFromView,
    };
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

  _onRemoveFromView = () => {
    if (!this.state.isDeleting && !this._deletingTimer) {
      this._changeBackToNotDeleting();
      this.setState({ isDeleting: true });
      for (const draft of OutboxStore.dataSource().selection.items()) {
        Actions.destroyDraft([draft], { source: 'OutboxList:onRemoveFromView' });
      }
    }
  };
}

module.exports = OutboxList;
