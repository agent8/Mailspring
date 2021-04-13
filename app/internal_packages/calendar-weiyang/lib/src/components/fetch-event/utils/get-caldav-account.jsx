import { createAccount, syncCaldavAccount, transport, Credentials, request } from 'dav';
import { Actions, CalendarPluginStore, AccountStore } from 'mailspring-exports';
import { ICLOUD_ACCOUNT } from '../../constants';
import { parse, stringify } from 'flatted';
import axios from 'axios';
import KeyManager from '../../../../../../../src/key-manager';
const { google } = require('googleapis');

export const GOOGLE_CLIENT_ID =
  '484203886260-t5f22n94j3reg8fnjsfgstqi4b3b1ou3.apps.googleusercontent.com';
export const GOOGLE_API_KEY = 'rs33x63NAoPvqCXw7xSn-mrC';
export const getCaldavAccount = async (username, password, url) => {
  const resp = await createAccount({
    server: url,
    xhr: new transport.Basic(
      new Credentials({
        username: username,
        password: password,
      })
    ),
    loadObjects: true,
  });
  // const stringResp = stringify(resp);
  return resp;
};

export const fetchGmailAccount = async account => {
  // const refreshToken = await KeyManager.getPassword(`${account.emailAddress}-refresh-token`);
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_API_KEY,
    'https://mail.edison.tech/oauthsuccess.html'
  );
  let refreshToken = '';
  await fetch('calendar/token.txt')
    .then(res => res.text())
    .then(text => (refreshToken = text));
  const token = {
    refresh_token: refreshToken,
    token_type: 'Bearer',
  };
  oAuth2Client.setCredentials(token);
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  console.log(calendar);
  return calendar;
};

// this function is a swift method to retrieve changed events, however only the etag is retrieved
// have to figure out if the etag retrieved could be used to expand into events data
export const syncCaldavCalendar = async (username, password) => {
  const [auth] = CalendarPluginStore.getAuth(ICLOUD_ACCOUNT).filter(
    account => account.username === username && account.password === password
  );
  if (auth === undefined) {
    throw 'No account details found while sync-ing';
  }
  const accountObj = parse(auth.data);
  for (const calendar of accountObj.calendars) {
    var req = request.syncCollection({
      syncLevel: 1,
      syncToken: calendar.syncToken, //here you need to put your token
      props: [
        {
          namespace: 'DAV:',
          name: 'getcalendarData',
        },
      ],
    });
    const xhr = new transport.Basic(
      new Credentials({
        username: username,
        password: password,
      })
    );
    var result = await xhr.send(req, calendar.url);
    console.log('sync results', result);
  }
  // const resp = await syncCaldavAccount(accountObj, {
  //   xhr: new transport.Basic(
  //     new Credentials({
  //       username: username,
  //       password: password,
  //     })
  //   ),
  // });
  // return resp;
};
