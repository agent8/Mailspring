import React from 'react';
import SelectableCalendar from './components/selectable-calendar';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { getCaldavAccount } from './components/fetch-event/utils/get-caldav-account';
const dav = require('dav');

export default class Calendar extends React.Component {
  constructor(...args) {
    super(...args);
    this.mounted = false;
  }
  static displayName = 'Calendar';
  static containerRequired = false;

  componentDidMount = () => {
    dav.debug.enabled = true;
    const xhr = new dav.transport.OAuth2(
      new dav.Credentials({
        clientId: '',
        clientSecret: '',
        tokenUrl:"https://accounts.google.com/o/oauth2/token",
        username: '',
        password: '',
      })
    );
    dav
      .createAccount({ server: 'https://apidata.googleusercontent.com/caldav/v2/', xhr: xhr })
      .then(account => {
        console.log(account);
      });
  };
  render() {
    return <SelectableCalendar />;
  }
}
