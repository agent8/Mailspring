/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import RetinaImg from '../../../src/components/retina-img';
import { Actions } from 'mailspring-exports';

import {
  Flexbox,
  ScrollRegion,
  KeyCommandsRegion,
  ListensToFluxStore,
  ConfigPropContainer,
  InputSearch,
} from 'mailspring-component-kit';
import { PreferencesUIStore } from 'mailspring-exports';
import PreferencesTabsBar from './preferences-tabs-bar';

class PreferencesRoot extends React.Component {
  static displayName = 'PreferencesRoot';

  static propTypes = {
    tab: PropTypes.object,
    tabs: PropTypes.array,
    selection: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {
      searchValue: '',
    };

    const stopPropagation = e => {
      e.stopPropagation();
    };

    // This prevents some basic commands from propagating to the threads list and
    // producing unexpected results

    // TODO This is a partial/temporary solution and should go away when we do the
    // Keymap/Commands/Menu refactor
    this._localHandlers = {
      'core:next-item': stopPropagation,
      'core:previous-item': stopPropagation,
      'core:select-up': stopPropagation,
      'core:select-down': stopPropagation,
      'core:select-item': stopPropagation,
      'core:messages-page-up': stopPropagation,
      'core:messages-page-down': stopPropagation,
      'core:list-page-up': stopPropagation,
      'core:list-page-down': stopPropagation,
      // 'core:remove-from-view': stopPropagation,
      // 'core:gmail-remove-from-view': stopPropagation,
      'core:remove-and-previous': stopPropagation,
      'core:remove-and-next': stopPropagation,
      'core:archive-item': stopPropagation,
      'core:delete-item': stopPropagation,
      'core:print-thread': stopPropagation,
    };
  }

  componentDidMount() {
    ReactDOM.findDOMNode(this).focus();
    this._focusContent();
  }

  componentDidUpdate(oldProps) {
    if (oldProps.tab !== this.props.tab) {
      const scrollRegion = document.querySelector('.preferences-content .scroll-region-content');
      scrollRegion.scrollTop = 0;
      // this._focusContent();
    }
  }

  // Focus the first thing with a tabindex when we update.
  // inside the content area. This makes it way easier to interact with prefs.
  _focusContent() {
    const node = ReactDOM.findDOMNode(this._contentComponent).querySelector('[tabindex]');
    if (node && !this.state.searchValue) {
      node.focus();
    }
  }
  onBack = () => {
    Actions.popSheet({ reason: 'PreferencesRoot:onBack' });
  };

  onInputChange = value => {
    this.setState({ searchValue: value });
    PreferencesUIStore.onSearch(value);
  };

  render() {
    const { tab, selection, tabs } = this.props;
    const TabComponent = tab && tab.componentClassFn();
    return (
      <KeyCommandsRegion
        className="preferences-wrap"
        tabIndex="1"
        localHandlers={this._localHandlers}
      >
        <Flexbox direction="row">
          <div className="item-back" onClick={this.onBack}>
            <RetinaImg
              name={'arrow.svg'}
              style={{ width: 24, height: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </div>
          <PreferencesTabsBar tabs={tabs} selection={selection} />
          <div style={{ flex: 1 }}>
            <Flexbox direction="column">
              <div className="searchBar">
                <div className="tabName">{tab.tabId}</div>
                <InputSearch
                  showPreIcon
                  showClearIcon
                  height={40}
                  placeholder="Search settings"
                  onChange={this.onInputChange}
                />
              </div>
              <ScrollRegion className="preferences-content">
                <ConfigPropContainer
                  ref={el => {
                    this._contentComponent = el;
                  }}
                >
                  {TabComponent ? (
                    <TabComponent
                      className={tab.className ? tab.className : ''}
                      configGroup={tab.configGroup ? tab.configGroup : null}
                    />
                  ) : (
                    false
                  )}
                </ConfigPropContainer>
              </ScrollRegion>
            </Flexbox>
          </div>
        </Flexbox>
      </KeyCommandsRegion>
    );
  }
}

export default ListensToFluxStore(PreferencesRoot, {
  stores: [PreferencesUIStore],
  getStateFromStores() {
    const tabs = PreferencesUIStore.tabs();
    const selection = PreferencesUIStore.selection();
    const tab = tabs.find(t => t.tabId === selection.tabId);
    return { tabs, selection, tab };
  },
});
