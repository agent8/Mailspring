import React from 'react';
import fs from 'fs';
import PropTypes from 'prop-types';
import _ from 'underscore';
import _str from 'underscore.string';
import { Menu, ButtonDropdown } from 'mailspring-component-kit';

/*
This component renders input controls for a subtree of the Mailspring config-schema
and reads/writes current values using the `config` prop, which is expected to
be an instance of the config provided by `ConfigPropContainer`.

The config schema follows the JSON Schema standard: http://json-schema.org/
*/
class ConfigSchemaItem extends React.Component {
  static displayName = 'ConfigSchemaItem';

  static propTypes = {
    config: PropTypes.object,
    configSchema: PropTypes.object,
    keyName: PropTypes.string,
    keyPath: PropTypes.string,
  };

  _appliesToPlatform() {
    if (!this.props.configSchema.platform) {
      return true;
    } else if (this.props.configSchema.platforms.indexOf(process.platform) !== -1) {
      return true;
    }
    return false;
  }

  _onChangeChecked = event => {
    this.props.config.toggle(this.props.keyPath);
    event.target.blur();
  };

  _onChangeValue = ([value, label]) => {
    this.props.config.set(this.props.keyPath, value);
    // **** process for quick acions setting --- start ****
    // should not be allowed to set same quick actions
    const QUICK_ACTION_KEY = 'core.quickActions.quickAction';
    if (this.props.keyPath.includes(QUICK_ACTION_KEY)) {
      var quickActions = [
        `${QUICK_ACTION_KEY}1`,
        `${QUICK_ACTION_KEY}2`,
        `${QUICK_ACTION_KEY}3`,
        `${QUICK_ACTION_KEY}4`,
      ].filter(item => item !== this.props.keyPath);
      for (const key of quickActions) {
        if (this.props.config.get(key) === value) {
          AppEnv.config.set(key, '');
          break;
        }
      }
    }
    // **** process for quick acions setting --- end ****
    this._dropdownComponent.toggleDropdown();
  };

  _openFloder = keyPath => {
    const path = this.props.config.get(keyPath);
    const openDirOption = {
      properties: ['openDirectory'],
    };
    if (typeof path === 'string' && fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
      openDirOption['defaultPath'] = path;
    }

    AppEnv.showOpenDialog(openDirOption, newPaths => {
      if (newPaths && newPaths.length > 0) {
        this.props.config.set(keyPath, newPaths[0]);
      }
    });
  };

  _renderMenuItem = ([value, label]) => {
    return <span key={value}>{label}</span>;
  };

  getSelectedMenuItem(items) {
    const selected = this.props.config.get(this.props.keyPath);
    for (const item of items) {
      const [value, label] = item;
      if (value === selected) {
        return this._renderMenuItem(item);
      }
    }
    return null;
  }

  render() {
    if (!this._appliesToPlatform()) return false;

    // In the future, we may add an option to reveal "advanced settings"
    if (this.props.configSchema.advanced) return false;

    let note = this.props.configSchema.note ? (
      <div className="platform-note">{this.props.configSchema.note}</div>
    ) : null;

    if (this.props.configSchema.type === 'object') {
      return (
        <section className={`section-${this.props.keyName}`}>
          <h6>{(this.props.label || this.props.keyName).toUpperCase()}</h6>
          {Object.entries(this.props.configSchema.properties)
            .filter(([key]) => {
              const disableSchemas = this.props.disableSchemas || [];
              return disableSchemas.indexOf(key) < 0;
            })
            .map(([key, value]) => (
              <ConfigSchemaItem
                key={key}
                keyName={key}
                keyPath={`${this.props.keyPath}.${key}`}
                configSchema={value}
                config={this.props.config}
                injectedComponent={this.props.injectedComponent}
              />
            ))}
          {note}
        </section>
      );
    } else if (this.props.configSchema.enum) {
      const items = _.zip(this.props.configSchema.enum, this.props.configSchema.enumLabels);
      const menu = (
        <Menu
          items={items}
          itemKey={item => item}
          itemContent={this._renderMenuItem}
          onSelect={this._onChangeValue}
        />
      );

      return (
        <div className="item">
          <label htmlFor={this.props.keyPath}>{this.props.configSchema.title}:</label>
          <ButtonDropdown
            ref={cm => {
              this._dropdownComponent = cm;
            }}
            primaryItem={this.getSelectedMenuItem(items)}
            menu={menu}
          />
          {note}
        </div>
      );
    } else if (this.props.configSchema.type === 'boolean') {
      return (
        <div className="item">
          <input
            id={this.props.keyPath}
            type="checkbox"
            onChange={this._onChangeChecked}
            checked={this.props.config.get(this.props.keyPath)}
          />
          <label htmlFor={this.props.keyPath}>{this.props.configSchema.title}</label>
          {note}
        </div>
      );
    } else if (this.props.configSchema.type === 'component' && this.props.injectedComponent) {
      return this.props.injectedComponent;
    } else if (this.props.configSchema.type === 'floder') {
      return (
        <div className="item">
          <label htmlFor={this.props.keyPath}>{this.props.configSchema.title}:</label>
          <button onClick={() => this._openFloder(this.props.keyPath)}>
            {this.props.config.get(this.props.keyPath)}
          </button>
        </div>
      );
    }
    return <span />;
  }
}

export default ConfigSchemaItem;
