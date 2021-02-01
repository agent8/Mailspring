import { ipcRenderer } from 'electron';
const React = require('react');
const { Utils, AccountStore } = require('mailspring-exports');
const {
  OutlineView,
  ScrollRegion,
  Flexbox,
  KeyCommandsRegion,
} = require('mailspring-component-kit');
// const AccountSwitcher = require('./account-switcher');
const SidebarStore = require('../sidebar-store');

class AccountSidebar extends React.Component {
  static displayName = 'AccountSidebar';

  static containerRequired = false;
  static containerStyles = {
    minWidth: 125,
    maxWidth: 250,
    flexShrink: 0,
  };

  constructor(props) {
    super(props);
    this.state = this._getStateFromStores();
    this._mounted = false;
  }

  componentDidMount = () => {
    ipcRenderer.on('after-add-account', this._afterAddAccount);
    this._mounted = true;
    const pos = window.sessionStorage.getItem('sidebar_scroll_position');
    if (pos && this._accountSideBarWrapEl) {
      //DC-1130 Because chat account filler will interference with account-sidebar height, causing it to re-scroll, we wait until next frame to set scroll position.
      window.requestAnimationFrame(() => {
        this._accountSideBarWrapEl.scrollTop = pos;
      });
    }
    this.unsubscribers = [];
    this.unsubscribers.push(SidebarStore.listen(this._onStoreChange));
    this.unsubscribers.push(AccountStore.listen(this._onStoreChange));
  };

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) || !Utils.isEqualReact(nextState, this.state);
  }

  // when pop Thread sheet, should set root sheet's account-sidebar position
  _setScrollbarPosition = () => {
    const accountSidebar = document.querySelector(
      `[data-id='Threads'] .account-sidebar .scroll-region-content`
    );
    const siftSidebar = document.querySelector(
      `[data-id='Sift'] .account-sidebar .scroll-region-content`
    );
    const pos = window.sessionStorage.getItem('sidebar_scroll_position');
    if (accountSidebar && pos) {
      accountSidebar.scrollTop = pos;
    }
    if (siftSidebar && pos) {
      siftSidebar.scrollTop = pos;
    }
  };

  componentWillUnmount() {
    ipcRenderer.removeListener('after-add-account', this._afterAddAccount);
    this._setScrollbarPosition();
    return this.unsubscribers.map(unsubscribe => unsubscribe());
  }

  _afterAddAccount = () => {
    SidebarStore.setAllCollapsed();
    this._accountSideBarWrapEl.scrollTop = 0;
  };

  _onStoreChange = () => {
    if (this._mounted) {
      return this.setState(this._getStateFromStores());
    }
  };

  _getStateFromStores = () => {
    return {
      accounts: AccountStore.accounts(),
      isEditingMenu: SidebarStore.isEditingMenu(),
      sidebarAccountIds: SidebarStore.sidebarAccountIds(),
      userSections: SidebarStore.userSections(),
      standardSection: SidebarStore.standardSection(),
    };
  };

  _scrollToFocusItem = selectedItemKey => {
    const selectNode = document.querySelector(
      `.nylas-outline-view .item-container .item[id='${selectedItemKey}']`
    );
    if (selectNode && this._accountSideBarWrapEl) {
      this._accountSideBarWrapEl.scrollTo(selectNode);
    }
    // const { items } = this.state.standardSection;
    // let selectedItem = items.find(item => item.selected);
    // if (selectedItem && selectedItem.children && selectedItem.children.length) {
    //   selectedItem = selectedItem.children.find(item => item.selected) || selectedItem;
    // }
    // if (selectedItem && selectedItem.id && this._accountSideBarWrapEl) {
    //   const selectNode = document.querySelector(
    //     `.nylas-outline-view .item-container .item[id='${selectedItem.id}']`
    //   );
    //   if(selectNode){
    //     this._accountSideBarWrapEl.scrollTo(selectNode);
    //   }
    // }
  };

  _renderUserSections(sections) {
    return sections.map(section => <OutlineView key={section.title} {...section} />);
  }
  _onScroll = () => {
    if (!this._accountSideBarWrapEl) {
      return;
    }
    window.sessionStorage.setItem('sidebar_scroll_position', this._accountSideBarWrapEl.scrollTop);
  };

  _onShift = delta => {
    SidebarStore.onShift(delta, this._scrollToFocusItem);
  };

  _globalKeymapHandlers() {
    return {
      'core:next-folder': () => this._onShift(1),
      'core:previous-folder': () => this._onShift(-1),
    };
  }

  render() {
    const { standardSection } = this.state;

    return (
      <Flexbox direction="column" style={{ order: 1, flexShrink: 1, flex: 1 }}>
        <KeyCommandsRegion
          globalHandlers={this._globalKeymapHandlers()}
          tabIndex={-1}
          ref={el => {
            this._keyCommands = el;
          }}
        >
          <ScrollRegion
            onScrollEnd={this._onScroll}
            ref={el => {
              this._accountSideBarWrapEl = el;
            }}
            className="account-sidebar"
            style={{ order: 2 }}
          >
            {/*<AccountSwitcher accounts={accounts} sidebarAccountIds={sidebarAccountIds} />*/}
            <div className="account-sidebar-sections">
              <OutlineView {...standardSection} isEditingMenu={this.state.isEditingMenu} />
            </div>
          </ScrollRegion>
        </KeyCommandsRegion>
      </Flexbox>
    );
  }
}

module.exports = AccountSidebar;
