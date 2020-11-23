import {
  ExchangeService,
  WebCredentials,
  Uri,
  WellKnownFolderName,
  SearchFilter,
  FolderSchema,
  FolderView
} from 'ews-javascript-api';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_SCOPE, filterUser } from '../utils/client/google';
import { buildAuthUrl, testFunc } from '../utils/client/outlook';

import { filterExchangeUser } from '../utils/client/exchange';

import * as Providers from '../utils/constants';

import * as AuthActionTypes from '../actions/auth';
import * as DbActionTypes from '../actions/db/events';
import { filterCaldavUser } from '../utils/client/caldav';
import { findAccount } from '../sequelizeDB/operations/accounts';
import serverUrls from '../utils/serverUrls';
import axios from 'axios';
import { getAllCalendars } from '../utils/client/google';

const dav = require('dav');

let GoogleAuth = '';

const handleAuthClick = (auth) => {
  if (auth.isSignedIn.get()) {
    console.log('Signed In to Google!');
  } else {
    auth.signIn();
  }
};

export const authBeginMiddleware = (store) => (next) => async (action) => {
  if (action === undefined) {
    console.log('Action undefined, returning and doing nothing.');
    return;
  }

  if (action.type === AuthActionTypes.BEGIN_GOOGLE_AUTH) {
    if (AppEnv.config.get('plugin.calendar.config') !== null) {
      const {
        access_token,
        refresh_token,
        account
      } = AppEnv.config.get('plugin.calendar.config');
      getAllCalendars(access_token)
        .then(res => {
          next({
            type: AuthActionTypes.SUCCESS_GOOGLE_AUTH,
            payload: {
              user: filterUser(
                account,
                res.data.items,
                access_token
              ),
              calendars: res.data.items.length > 1 ? res.data.items : [],
            }
          })
        })
        .catch(err => console.log(err));
    } else {
      next({
        type: AuthActionTypes.RETRY_GOOGLE_AUTH,
      })
    }
  } else if (action.type === AuthActionTypes.BEGIN_OUTLOOK_AUTH) {
    const url = buildAuthUrl();
    console.log(url);
    // window.open(url,"_blank",false);
    window.location.href = url;
    // window.location.replace(url)
    // console.log("here");
    // testFunc();
  } else if (action.type === AuthActionTypes.BEGIN_EXCHANGE_AUTH) {
    const exch = new ExchangeService();
    exch.Credentials = new WebCredentials(action.payload.username, action.payload.password);
    exch.Url = new Uri('https://outlook.office365.com/Ews/Exchange.asmx');
    // This is just to check if you can login. It actually does nothing and there is no pseudo function to check login status.
    exch
      .FindFolders(
        WellKnownFolderName.Root,
        new SearchFilter.IsGreaterThan(FolderSchema.TotalCount, 0),
        new FolderView(10)
      )
      .then(
        () => {
          const user = filterExchangeUser(action.payload);

          next({
            type: AuthActionTypes.SUCCESS_EXCHANGE_AUTH,
            payload: {
              user
            }
          });
        },
        (error) => {
          console.log(error);
          next({
            type: AuthActionTypes.FAIL_EXCHANGE_AUTH
          });
        }
      );
  } else if (action.type === AuthActionTypes.BEGIN_CALDAV_AUTH) {
    // console.log(action.payload);
    // debugger;
    const caldavPayload = {
      server: action.payload.url,
      xhr: new dav.transport.Basic(
        new dav.Credentials({
          username: action.payload.username,
          password: action.payload.password
        })
      ),
      loadObjects: true
    };

    const user = await findAccount('CALDAV', action.payload.username);
    // console.log(user)
    // debugger;
    if (user === null) {
      dav
        .createAccount(caldavPayload)
        .then((caldavData) => {
          console.log(caldavData);
          // debugger;
          next({
            type: AuthActionTypes.SUCCESS_CALDAV_AUTH,
            payload: {
              user: filterCaldavUser(
                caldavData.credentials,
                caldavData.principalUrl,
                caldavData.homeUrl,
                action.payload.url,
                caldavData.calendars
                  .filter((cal) => cal.components.includes('VEVENT'))
                  .map((filteredCal) => {
                    // remove cyclic reference
                    delete filteredCal.account.calendars;
                    delete filteredCal.objects;
                    console.log(filteredCal);
                    // debugger;
                    return filteredCal;
                  })
              ),
              data: caldavData
            }
          });
        })
        .catch((error) => {
          console.log(error);
          next({
            type: AuthActionTypes.FAIL_CALDAV_AUTH
          });
        });
    } else {
      next({
        type: AuthActionTypes.SUCCESS_CALDAV_AUTH,
        payload: {
          user: filterCaldavUser(
            caldavPayload.xhr.credentials,
            user.principalUrl,
            user.homeUrl,
            action.payload.url
          ),
          data: user
        }
      });
    }
  }
  // debugger;
  console.log(`[authmiddleware] ${action.type}`);
  return next(action);
};

export const authSuccessMiddleware = (store) => (next) => (action) => {
  if (action.type === AuthActionTypes.SUCCESS_GOOGLE_AUTH) {
    next({
      type: DbActionTypes.RETRIEVE_STORED_EVENTS,
      payload: { providerType: Providers.GOOGLE, user: action.payload.user }
    });
  }
  if (action.type === AuthActionTypes.FAIL_GOOGLE_AUTH) {
    next({
      type: AuthActionTypes.RETRY_GOOGLE_AUTH
    });
  }

  // if (action.type === AuthActionTypes.SUCCESS_OUTLOOK_AUTH) {
  //   next({
  //     type: DbActionTypes.RETRIEVE_STORED_EVENTS,
  //     payload: { providerType: action.payload.user.providerType, user: action.payload.user }
  //   });
  // }
  // if (action.type === AuthActionTypes.FAIL_OUTLOOK_AUTH) {
  //   next({
  //     type: AuthActionTypes.RETRY_OUTLOOK_AUTH
  //   });
  // }

  if (action.type === AuthActionTypes.SUCCESS_EXCHANGE_AUTH) {
    next({
      type: DbActionTypes.RETRIEVE_STORED_EVENTS,
      payload: { providerType: action.payload.user.providerType, user: action.payload.user }
    });
  }
  if (action.type === AuthActionTypes.FAIL_EXCHANGE_AUTH) {
    next({
      type: AuthActionTypes.RETRY_EXCHANGE_AUTH
    });
  }

  if (action.type === AuthActionTypes.SUCCESS_CALDAV_AUTH) {
    next({
      type: DbActionTypes.RETRIEVE_STORED_EVENTS,
      payload: { providerType: action.payload.user.providerType, user: action.payload.user }
    });
  }
  if (action.type === AuthActionTypes.FAIL_CALDAV_AUTH) {
    next({
      type: AuthActionTypes.RETRY_CALDAV_AUTH
    });
  }
  return next(action);
};
