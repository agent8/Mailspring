import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';
import { Actions } from 'mailspring-exports';
import ModeSwitch from './mode-switch';
import { remote } from 'electron';
import ConfigSchemaItem from './config-schema-item';

const { dialog } = remote;
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
      label: 'Full Screen',
      imgsrc: `appearance-mode-${'list'}.png`,
    },
    {
      value: 'split',
      label: 'Reading Pane Right',
      imgsrc: `appearance-mode-${'split'}.png`,
    },
    {
      value: 'split-v',
      label: 'Reading Pane Bottom',
      imgsrc: `appearance-mode-${'split-v'}.png`,
    },
  ];
  return (
    <ModeSwitch
      className="reading-pane-switch"
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

class ConfigSchemaItemForMessageView extends ConfigSchemaItem {
  constructor(props) {
    super(props);
  }

  _onChangeChecked = event => {
    this.props.onChange();
    event.target.blur();
  };
}

export class AppearanceViewOptions extends React.Component {
  static displayName = 'AppearanceThemeSwitch';

  static propTypes = {
    label: PropTypes.string,
    keyPath: PropTypes.string,
    config: PropTypes.object,
    configSchema: PropTypes.object,
  };

  constructor(props) {
    super(props);
  }

  onChange = () => {
    const { keyPath } = this.props;
    dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Okay', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        message:
          'All your messages will be re-downloaded. This might take some time. You can still use Edison Mail while the messages are downloaded. Do you want to proceed?',
      })
      .then(({ response }) => {
        if (response === 0) {
          this.props.config.toggle(keyPath);
          setImmediate(() => {
            Actions.forceKillAllClients('onToggleMessageView');
          });
        }
      });
  };

  render() {
    return (
      <ConfigSchemaItemForMessageView
        configSchema={this.props.configSchema}
        keyPath={this.props.keyPath}
        config={this.props.config}
        label={this.props.label}
        onChange={this.onChange}
      />
    );
  }
}
