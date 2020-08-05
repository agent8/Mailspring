import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';
import { Actions } from 'mailspring-exports';
import ModeSwitch from './mode-switch';
import { remote } from 'electron';
import ConfigSchemaItem from './config-schema-item';

export class MyAccount extends React.Component {
  render() {
    return (
      <div className="container-mute">
        <div className="mute-note">
          Use this account to sync your mail and settings across all your devices.
        </div>
      </div>
    );
  }
}

export class AccountType extends React.Component {
  render() {
    return <div></div>;
  }
}

export class Devices extends React.Component {
  constructor() {
    super();
    this.state = {
      devices: [],
    };
    this.reloadState();
  }
  reloadState() {}
  render() {
    const { devices } = this.state;
    return <div></div>;
  }
}
