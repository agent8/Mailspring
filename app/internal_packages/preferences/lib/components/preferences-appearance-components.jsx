import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { Actions } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import ModeSwitch from './mode-switch';
import { remote } from 'electron';
import ConfigSchemaItem from './config-schema-item';

export class AppearanceScaleSlider extends React.Component {
  static displayName = 'AppearanceScaleSlider';

  static propTypes = {
    config: PropTypes.object.isRequired,
  };

  constructor(props) {
    super();
    this.kp = `core.workspace.interfaceZoom`;
    this.state = { value: props.config.get(this.kp) };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({ value: nextProps.config.get(this.kp) });
  }

  _onChangeConfig = () => {
    this.props.config.set(this.kp, this.state.value);
    setTimeout(() => ReactDOM.findDOMNode(this).scrollIntoView(false), 1);
  };

  render() {
    return (
      <div className="appearance-scale-slider">
        <div className="ruler">
          <div style={{ flex: 1.02 }}>
            <RetinaImg name="appearance-scale-small.png" mode={RetinaImg.Mode.ContentDark} />
          </div>
          <div className="midpoint" />
          <div style={{ flex: 2, textAlign: 'right' }}>
            <RetinaImg name="appearance-scale-big.png" mode={RetinaImg.Mode.ContentDark} />
          </div>
        </div>
        <input
          type="range"
          min={0.8}
          max={1.4}
          step={0.05}
          value={this.state.value}
          onMouseUp={this._onChangeConfig}
          onChange={e => this.setState({ value: e.target.value })}
        />
      </div>
    );
  }
}

export function AppearanceProfileOptions(props) {
  const activeValue = props.config.get('core.appearance.profile');
  const modeSwitchList = [
    {
      value: true,
      label: 'Profile Pictures',
      imgsrc: `profile-${'show'}.png`,
    },
    {
      value: false,
      label: 'No Profile Pictures',
      imgsrc: `profile-${'hide'}.png`,
    },
  ];
  return (
    <ModeSwitch
      className="profile-switch"
      modeSwitch={modeSwitchList}
      config={props.config}
      activeValue={activeValue}
      imgActive
      onSwitchOption={value => {
        AppEnv.config.set('core.appearance.profile', value);
      }}
    />
  );
}

export function AppearancePanelOptions(props) {
  const activeValue = props.config.get('core.workspace.mode');
  const modeSwitchList = [
    {
      value: 'list',
      label: 'Single Panel',
      imgsrc: `appearance-mode-${'list'}.png`,
    },
    {
      value: 'split',
      label: 'Two Panels',
      imgsrc: `appearance-mode-${'split'}.png`,
    },
  ];
  return (
    <ModeSwitch
      modeSwitch={modeSwitchList}
      config={props.config}
      activeValue={activeValue}
      imgActive
      onSwitchOption={value => {
        AppEnv.commands.dispatch(`navigation:select-${value}-mode`);
      }}
    />
  );
}

const THEME_MODE_KEY = 'core.themeMode';
export class AppearanceThemeSwitch extends React.Component {
  static displayName = 'AppearanceThemeSwitch';

  static propTypes = {
    config: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.themes = AppEnv.themes;
    this.state = this._getState();
  }

  componentDidMount() {
    this.disposable = this.themes.onDidChangeActiveThemes(() => {
      this.setState(this._getState());
    });
  }

  componentWillUnmount() {
    this.disposable.dispose();
  }

  _getState() {
    return {
      themes: this.themes.getAvailableThemes(),
      activeTheme: this.props.config.get(THEME_MODE_KEY) || this.themes.getActiveTheme().name,
    };
  }

  switchTheme = value => {
    this.props.config.set(THEME_MODE_KEY, value);
    if (value === 'auto') {
      value = remote.systemPreferences.isDarkMode() ? 'ui-dark' : 'ui-light';
    }
    this.themes.setActiveTheme(value);
  };

  render() {
    const internalThemes = ['ui-dark', 'ui-light'];
    let sortedThemes = [].concat(this.state.themes);
    sortedThemes.sort((a, b) => {
      return (internalThemes.indexOf(a.name) - internalThemes.indexOf(b.name)) * -1;
    });
    const labelMap = {
      light: 'Light Mode',
      dark: 'Dark Mode',
    };
    // only show light and dark mode
    sortedThemes = sortedThemes.filter(item => internalThemes.includes(item.name));
    const modeSwitchList = sortedThemes.map(theme => {
      const mode = theme.name.replace('ui-', '');
      return {
        value: theme.name,
        label: labelMap[mode],
        imgsrc: `prefs-appearance-${mode}.png`,
      };
    });
    modeSwitchList.push({
      value: 'auto',
      label: 'Use System Settings',
      imgsrc: `prefs-appearance-system.png`,
    });
    return (
      <ModeSwitch
        className="theme-switch"
        modeSwitch={modeSwitchList}
        config={this.props.config}
        activeValue={this.state.activeTheme}
        onSwitchOption={this.switchTheme}
      />
    );
  }
}

export class AppearanceViewOptions extends React.Component {
  static displayName = 'AppearanceThemeSwitch';

  static propTypes = {
    keyPath: PropTypes.string,
    config: PropTypes.object,
    configSchema: PropTypes.object,
  };

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    const { keyPath } = this.props;
    this.disposable = AppEnv.config.onDidChange(keyPath, this._onRelaunch);
  }

  componentWillUnmount() {
    this.disposable.dispose();
  }

  _onRelaunch = () => {
    Actions.forceRelaunchClients();
  };

  render() {
    return (
      <ConfigSchemaItem
        configSchema={this.props.configSchema}
        keyPath={this.props.keyPath}
        config={this.props.config}
        label={'disable thread'}
      />
    );
  }
}
