import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'underscore';
import { Actions, PreferencesUIStore, ComponentRegistry } from 'mailspring-exports';
import { ResizableRegion, RetinaImg } from 'mailspring-component-kit';

const sidebarId = 'RootSidebar';

class PreferencesTabItem extends React.Component {
  static displayName = 'PreferencesTabItem';

  static propTypes = {
    selection: PropTypes.shape({
      accountId: PropTypes.string,
      tabId: PropTypes.string,
    }).isRequired,
    tabItem: PropTypes.instanceOf(PreferencesUIStore.TabItem).isRequired,
    sidebaricons: PropTypes.bool,
  };

  _onClick = () => {
    Actions.switchPreferencesTab(this.props.tabItem.tabId);
    AppEnv.trackingEvent(`Preferences-${this.props.tabItem.tabId}`);
  };

  _onClickAccount = (event, accountId) => {
    Actions.switchPreferencesTab(this.props.tabItem.tabId, { accountId });
    event.stopPropagation();
  };

  render() {
    const { selection, tabItem, sidebaricons } = this.props;
    const { tabId, displayName } = tabItem;
    const classes = classNames({
      item: true,
      active: tabId === selection.tabId,
      'name-only': !sidebaricons,
    });

    return (
      <div className={classes} onClick={this._onClick} title={displayName}>
        <div className="transition-box">
          <RetinaImg
            isIcon
            name={`preference-${displayName.replace(/[\s&]/g, '').toLocaleLowerCase()}.svg`}
            className="preferences-icon"
            mode={RetinaImg.Mode.ContentIsMask}
            style={{ height: 17, width: 17, fontSize: 17 }}
          />
        </div>
        <div className="name">{displayName}</div>
      </div>
    );
  }
}

class PreferencesTabsBar extends React.Component {
  static displayName = 'PreferencesTabsBar';

  static propTypes = {
    tabs: PropTypes.array.isRequired,
    selection: PropTypes.shape({
      accountId: PropTypes.string,
      tabId: PropTypes.string,
    }).isRequired,
  };

  constructor() {
    super();
    this.CONFIG_KEY = 'core.appearance.sidebaricons';
    this.state = {
      sidebaricons: AppEnv.config.get(this.CONFIG_KEY),
    };
    const AccountSidebar = ComponentRegistry.findComponentByName('AccountSidebar');
    const containerStyles =
      AccountSidebar && AccountSidebar.containerStyles
        ? AccountSidebar.containerStyles
        : {
            minWidth: 125,
            maxWidth: 250,
          };
    this.minWidth = containerStyles.minWidth;
    this.maxWidth = containerStyles.maxWidth;
  }

  componentDidMount() {
    this._mounted = true;
    this.disposable = AppEnv.config.onDidChange(this.CONFIG_KEY, () => {
      if (this._mounted) {
        this.setState({
          sidebaricons: AppEnv.config.get(this.CONFIG_KEY),
        });
      }
    });
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disposable.dispose();
  }

  _onColumnResize = _.debounce(w => {
    AppEnv.storeColumnWidth({ id: sidebarId, width: w });
  }, 200);

  renderTabs() {
    return this.props.tabs.map(tabItem => (
      <PreferencesTabItem
        key={tabItem.tabId}
        tabItem={tabItem}
        selection={this.props.selection}
        sidebaricons={this.state.sidebaricons}
      />
    ));
  }

  render() {
    return (
      <ResizableRegion
        minWidth={this.minWidth}
        maxWidth={this.maxWidth}
        className="container-preference-tabs"
        handle={ResizableRegion.Handle.right}
        onResize={this._onColumnResize}
        initialWidth={AppEnv.getColumnWidth(sidebarId) || this.maxWidth}
      >
        <div className="preference-tabs-scroll">{this.renderTabs()}</div>
      </ResizableRegion>
    );
  }
}

export default PreferencesTabsBar;
