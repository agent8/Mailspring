import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Flexbox, RetinaImg, Keystrokes } from 'mailspring-component-kit';
import fs from 'fs';
import displayedKeybindings from './displayed-keybindings';

import { keyAndModifiersForEvent } from './mousetrap-keybinding-helpers';

const commandMappingTitle = new Map();
displayedKeybindings.forEach(group => {
  group.items.forEach(item => {
    const [command, label] = item;
    commandMappingTitle.set(command, label);
  });
});
export default class CommandKeybinding extends React.Component {
  static propTypes = {
    label: PropTypes.string,
    command: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this.state = {
      editing: false,
      bindings: AppEnv.keymaps.getBindingsForCommand(props.command),
    };
  }

  componentDidMount() {
    this._disposable = AppEnv.keymaps.onDidReloadKeymap(() => {
      this.setState({ bindings: AppEnv.keymaps.getBindingsForCommand(this.props.command) });
    });
  }

  componentWillUnmount() {
    this._disposable.dispose();
  }

  componentDidUpdate() {
    const { modifiers, keys, editing } = this.state;
    if (editing) {
      const finished = (modifiers.length > 0 && keys.length > 0) || keys.length >= 2;
      if (finished) {
        ReactDOM.findDOMNode(this).blur();
      }
    }
  }

  _onEdit = () => {
    this.setState({ editing: true, editingBinding: null, keys: [], modifiers: [] });
    AppEnv.keymaps.suspendAllKeymaps();
  };

  _onFinishedEditing = () => {
    if (this.state.editingBinding) {
      const commands = AppEnv.keymaps.getCommandsForKeystroke(this.state.editingBinding) || [];
      const otherCommands = commands.filter(command => command !== this.props.command);
      if (otherCommands.length) {
        const otherTitle = [];
        otherCommands.forEach(command => {
          if (commandMappingTitle.get(command)) {
            otherTitle.push(commandMappingTitle.get(command));
          }
        });
        if (otherTitle.length === otherCommands.length) {
          AppEnv.showErrorDialog(
            `This shortcut is currently being used by "${[...new Set(otherTitle)].join('",and"')}".`
          );
        } else {
          AppEnv.showErrorDialog(
            `This shortcut conflicts with builtin shortcut(s), changes will be discarded.`
          );
        }

        this._afterFinishedEditing();
        return;
      }
      const keymapPath = AppEnv.keymaps.getUserKeymapPath();
      let keymaps = {};

      try {
        const exists = fs.existsSync(keymapPath);
        if (exists) {
          keymaps = JSON.parse(fs.readFileSync(keymapPath));
        }
      } catch (err) {
        AppEnv.reportError(err);
      }

      keymaps[this.props.command] = this.state.editingBinding;

      try {
        fs.writeFileSync(keymapPath, JSON.stringify(keymaps, null, 2));
      } catch (err) {
        AppEnv.showErrorDialog(
          `Nylas was unable to modify your keymaps at ${keymapPath}. ${err.toString()}`
        );
      }
    }
    this._afterFinishedEditing();
  };

  _afterFinishedEditing = () => {
    this.setState({ editing: false, editingBinding: null });
    AppEnv.keymaps.resumeAllKeymaps();
  };

  _clearBinding = () => {
    const keymapPath = AppEnv.keymaps.getUserKeymapPath();
    let keymaps = {};
    try {
      const exists = fs.existsSync(keymapPath);
      if (exists) {
        keymaps = JSON.parse(fs.readFileSync(keymapPath));
      }
    } catch (err) {
      AppEnv.reportError(err);
    }

    keymaps[this.props.command] = 'None';
    try {
      fs.writeFileSync(keymapPath, JSON.stringify(keymaps, null, 2));
    } catch (err) {
      AppEnv.showErrorDialog(
        `Nylas was unable to modify your keymaps at ${keymapPath}. ${err.toString()}`
      );
    }
    this._onEdit();
  };

  _onKey = event => {
    if (!this.state.editing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const [eventKey, eventMods] = keyAndModifiersForEvent(event);
    if (!eventKey || ['mod', 'meta', 'command', 'ctrl', 'alt', 'shift'].includes(eventKey)) {
      return;
    }

    let { keys, modifiers } = this.state;
    keys = keys.concat([eventKey]);
    modifiers = _.uniq(modifiers.concat(eventMods));

    let editingBinding = keys.join(' ');
    if (modifiers.length > 0) {
      editingBinding = [].concat(modifiers, keys).join('+');
      editingBinding = editingBinding.replace(/(meta|command|ctrl)/g, 'mod');
    }

    this.setState({ keys, modifiers, editingBinding });
  };

  render() {
    const { editing, editingBinding, bindings } = this.state;
    const showBindings = editingBinding ? [editingBinding] : bindings;

    let value = 'None';
    if (showBindings.length > 0) {
      value = _.uniq(showBindings).map((keystroke, index) => {
        return <Keystrokes key={index} keyString={keystroke} />;
      });
    }

    let classnames = 'shortcut';
    if (editing) {
      classnames += ' editing';
    }
    return (
      <Flexbox
        className={classnames}
        tabIndex={-1}
        onKeyDown={this._onKey}
        onKeyPress={this._onKey}
        onFocus={this._onEdit}
        onBlur={this._onFinishedEditing}
      >
        <div className="col-left shortcut-name">{this.props.label}</div>
        <div className="col-right">
          <div className="values">{value}</div>
          <RetinaImg
            isIcon
            name="close.svg"
            className="clear"
            mode={RetinaImg.Mode.ContentIsMask}
            style={{ width: 12, height: 12, fontSize: '12px' }}
            onClick={this._clearBinding}
          />
        </div>
      </Flexbox>
    );
  }
}
