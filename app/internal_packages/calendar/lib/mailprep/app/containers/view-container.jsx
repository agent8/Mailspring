import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import View from '../components/view';
import axios from 'axios';
import {
  beginGoogleAuth,
  successGoogleAuth,
  expiredGoogleAuth,
  beginOutlookAuth,
  successOutlookAuth,
  expiredOutlookAuth,
  beginExchangeAuth,
  successExchangeAuth,
  beginCaldavAuth,
  successCaldavAuth
} from '../actions/auth';
import { retrieveStoreEvents } from '../actions/db/events';
import {
  beginGetGoogleEvents,
  beginDeleteEvent,
  clearAllEvents,
  beginPollingEvents,
  endPollingEvents,
  beginPendingActions,
  endPendingActions,
  beginDeleteRecurrenceSeries,
  beginDeleteFutureRecurrenceSeries
} from '../actions/events';
import { beginGetCaldavEvents } from '../actions/providers/caldav';
import { beginGetExchangeEvents } from '../actions/providers/exchange';
import { beginGetOutlookEvents } from '../actions/providers/outlook';
import getFilteredEvents from '../selectors/ui-selector';
import AccountStore from '../../../../../../src/flux/stores/account-store'
const dav = require('dav');

const mapStateToProps = (state) => {
  const calendarsList = [
    ...state.auth.providers.CALDAV.map((account) => ({
      email: account.email,
      type: 'CALDAV',
      caldavType: account.caldavType,
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal))
    })),
    ...state.auth.providers.EXCHANGE.map((account) => ({
      email: account.email,
      type: 'EXCHANGE',
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal))
    })),
    ...state.auth.providers.GOOGLE.map((account) => ({
      email: account.email,
      type: 'GOOGLE',
      provider: JSON.stringify(account),
      calendars: account.calendars !== undefined ? account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal)) : []
    })),
    ...state.auth.providers.OUTLOOK.map((account) => ({
      email: account.email,
      type: 'OUTLOOK',
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal))
    }))
  ];

  // const access_token = AppEnv.config.get('plugin.calendar.config').access_token;
  // const refresh_token = AppEnv.config.get('plugin.calendar.config').refresh_token;
  // METHOD 1: HTTP REQUEST DIRECTLY TO GOOGLE APIS (WORKING)


  // METHOD 2: VIA GAPI (NOT WORKING)
  // const gapi = window.gapi
  // gapi.load('client:auth2', function () {\
  //   console.log("init gapi");
  //   gapi.auth2.init({
  //     apiKey: 'AIzaSyCneMG33ninWiIcPO9qy6t0OS0-d15k_-g',
  //     cookie_policy: 'http://localhost:8000',
  //     client_id: '190108842853-2o3l63c3qlgjjg4pp2v9suoacrbfpgva.apps.googleusercontent.com',
  //     scope: `https://www.googleapis.com/auth/calendar`,
  //     'discoveryDocs': ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  //   }).then((() => {
  //     console.log("HELLO")
  //     console.log(auth2)
  //   }, () => console.log("GAPI ERROR")));
  //   console.log(gapi.auth2.GoogleAuth())
  // })

  // METHOD 3: VIA caldav dav.js
  // https://apidata.googleusercontent.com/caldav/v2/deminglindm%40gmail.com/user?key=AIzaSyAgA9vLu54Xpv6y93yptMDUFzZ8kXyvQnA
  // https://www.google.com/calendar/dav?key=AIzaSyAgA9vLu54Xpv6y93yptMDUFzZ8kXyvQnA
  // https://www.google.com/calendar/dav/deminglindm@gmail.com/user?key=AIzaSyAgA9vLu54Xpv6y93yptMDUFzZ8kXyvQnA
  // const caldavPayload = {
  //   server: 'https://www.google.com/calendar/dav?key=AIzaSyAgA9vLu54Xpv6y93yptMDUFzZ8kXyvQnA',
  //   xhr: new dav.transport.OAuth2(
  //     new dav.Credentials({
  //       accessToken: access_token,
  //       refreshToken: refresh_token,
  //       clientId: '190108842853-2o3l63c3qlgjjg4pp2v9suoacrbfpgva.apps.googleusercontent.com',
  //       clientSecret: 'atSqQBGyYhlJAba9NiZe47r6',
  //       // redirectUrl: 'https://mail.edison.tech/oauthsuccess.html',
  //       // username: 'deminglindm%40gmail.com',
  //       // password: 'N5B9RbCNpwZ8'
  //     }),
  //   ),
  //   loadObjects: true
  // };

  // console.log(caldavPayload)
  // dav.createAccount(caldavPayload)
  //   .then((caldavData) => {
  //     console.log("CALDAV SUCCESS!")
  //     console.log(caldavData)
  //   })
  //   .catch(error => {
  //     console.log("CALDAV FAILED!")
  //     console.log(error)
  //   })
  const filterMap = state.filter.filterMap;

  calendarsList.forEach((provider) => {
    provider.calendars.forEach((cal) => {
      // add calendars not in filter into the filterMap
      // if calendar is from first log in / not taken from db
      if (cal.id !== undefined) {
        cal.calendarUrl = cal.id;
        cal.url = cal.id;
      }
      if (cal.calendarUrl === undefined) {
        // if calendar not in filterMap
        if (filterMap[cal.url] === undefined) {
          filterMap[cal.url] = true;
          console.log(`added calendar to filter: ${cal.url}`);
        }
        // if calendar taken from db and not in filterMap
      } else if (filterMap[cal.calendarUrl] === undefined) {
        filterMap[cal.calendarUrl] = true;
        console.log(`added calendar to filter: ${cal.calendarUrl}`);
      }
    });
  });

  const events = getFilteredEvents(state);
  const visibleEvents = events.filter((event) => filterMap[event.calendarId]);

  return {
    events,
    initialSync: state.events.initialSync,
    isAuth: state.auth.isAuth,
    providers: state.auth.providers,
    expiredProviders: state.auth.expiredProviders,
    calendarsList,
    visibleEvents,
    filterMap
  };
};

const mapDispatchToProps = (dispatch) => ({
  // Google
  beginGetGoogleEvents: (user) => dispatch(beginGetGoogleEvents(user)),
  beginGoogleAuth: () => dispatch(beginGoogleAuth()),

  // Outlook
  beginGetOutlookEvents: (resp) => dispatch(beginGetOutlookEvents(resp)),
  beginOutlookAuth: () => dispatch(beginOutlookAuth()),

  // Exchange
  beginGetExchangeEvents: (resp) => dispatch(beginGetExchangeEvents(resp)),
  beginExchangeAuth: (user) => dispatch(beginExchangeAuth(user)),

  // Caldav
  beginGetCaldavEvents: (resp) => dispatch(beginGetCaldavEvents(resp)),
  beginCaldavAuth: (user) => dispatch(beginCaldavAuth(user)),

  // Get from database List of Events
  retrieveStoreEvents: (user) => dispatch(retrieveStoreEvents(user)),

  // CRUD - Delete Operations
  beginDeleteEvent: (id) => dispatch(beginDeleteEvent(id)),
  beginDeleteRecurrenceSeries: (id) => dispatch(beginDeleteRecurrenceSeries(id)),
  beginDeleteFutureRecurrenceSeries: (id) => dispatch(beginDeleteFutureRecurrenceSeries(id)),

  // Removes all events from local database only.
  clearAllEvents: () => dispatch(clearAllEvents()),

  // On Start, automatic login users if not expired.
  onStartGetGoogleAuth: (user) => dispatch(successGoogleAuth(user)),
  onStartGetOutlookAuth: (user) => dispatch(successOutlookAuth(user)),
  onStartGetExchangeAuth: (user) => dispatch(successExchangeAuth(user)),
  onStartGetCaldavAuth: (user) => dispatch(successCaldavAuth(user)),

  // On Start, if user is expired for some reason.
  onExpiredOutlook: (user) => dispatch(expiredOutlookAuth(user)),
  onExpiredGoogle: (user) => dispatch(expiredGoogleAuth(user)),

  // Start/End Polling actions for sync
  beginPollingEvents: (users) => dispatch(beginPollingEvents(users)),
  endPollingEvents: () => dispatch(endPollingEvents()),

  // Start/End Pending actions for offline actions
  beginPendingActions: (providers) => dispatch(beginPendingActions(providers)),
  endPendingActions: () => dispatch(endPendingActions())
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(View));
