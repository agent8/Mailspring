import React from 'react';
import SelectableCalendar from './components/selectable-calendar';
import { Actions, CalendarPluginStore, AccountStore } from 'mailspring-exports';
import { getCaldavAccount } from './components/fetch-event/utils/get-caldav-account';
import axios from 'axios';
import KeyManager from '../../../../src/key-manager';
const dav = require('dav');
const { google } = require('googleapis');

export default class Calendar extends React.Component {
  constructor(...args) {
    super(...args);
    this.mounted = false;
  }
  static displayName = 'Calendar';
  static containerRequired = false;

  componentDidMount = () => {
    dav.debug.enabled = true;
  };
  render() {
    return <SelectableCalendar />;
  }
}
