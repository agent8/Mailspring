import { mergeMap, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import { from, of } from 'rxjs';
import { successStoreAuth } from '../../actions/db/auth';
import { retrieveStoreEvents } from '../../actions/db/events';
import * as AuthActionTypes from '../../actions/auth';
import * as Providers from '../../utils/constants';

import * as dbUserActions from '../../sequelizeDB/operations/accounts';
import * as dbCalendarActions from '../../sequelizeDB/operations/calendars';

export const storeGoogleAuthEpic = (action$) =>
  action$.pipe(
    ofType(AuthActionTypes.SUCCESS_GOOGLE_AUTH),
    mergeMap((action) =>
      from(storeGoogleData(action.payload.user)).pipe(
        // mergeMap((resp) => of(successStoreAuth(), retrieveStoreEvents(action.payload.user))),
        mergeMap((resp) => of(successStoreAuth())),
        catchError((error) => {
          of(console.log(error));
        })
      )
    )
  );

export const storeOutLookAuthEpic = (action$) =>
  action$.pipe(
    ofType(AuthActionTypes.SUCCESS_OUTLOOK_AUTH),
    mergeMap((action) =>
      from(storeAccount(action.payload.user)).pipe(
        // mergeMap((resp) => of(successStoreAuth(), retrieveStoreEvents(action.payload.user))),
        mergeMap((resp) => of(successStoreAuth())),
        catchError((error) => {
          of(console.log(error));
        })
      )
    )
  );

export const storeExchangeAuthEpic = (action$) =>
  action$.pipe(
    ofType(AuthActionTypes.SUCCESS_EXCHANGE_AUTH),
    mergeMap((action) =>
      from(storeAccount(action.payload.user)).pipe(
        // mergeMap((resp) => of(successStoreAuth(), retrieveStoreEvents(action.payload.user))),
        mergeMap((resp) => of(successStoreAuth())),
        catchError((error) => {
          of(console.log(error));
        })
      )
    )
  );

export const storeCaldavAuthEpic = (action$) =>
  action$.pipe(
    ofType(AuthActionTypes.SUCCESS_CALDAV_AUTH),
    mergeMap((action) =>
      from(storeCaldavData(action.payload)).pipe(
        // mergeMap((resp) => of(successStoreAuth(), retrieveStoreEvents(action.payload.user))),
        mergeMap((resp) => of(successStoreAuth())),
        catchError((error) => {
          of(console.log(error));
        })
      )
    )
  );

// payload = { user, data }
const storeCaldavData = async (payload) => {
  console.log(payload);
  // debugger;
  // db actions are async. Needed user to be stored successfully in order for calendars to be stored in db due to FK constraints
  const storeUser = await dbUserActions.insertAccountIntoDatabase(payload.user);
  // debugger;
  let storeCalendar = [];
  // check to make sure payload.data is defined
  // console.log(payload)
  // debugger;

  // autologin have no payload.data, also not required to stored calendars again for autologin as calendars area already stored.
  if (payload.data && payload.user.calendars) {
    storeCalendar = payload.user.calendars
      .filter((cal) => cal.components.includes('VEVENT'))
      .map((filteredCal) => dbCalendarActions.insertCalendar(payload.user, filteredCal));
  }
  return Promise.all([storeUser, ...storeCalendar]);
};

const storeGoogleData = async (payload) => {
  console.log(payload);
  // debugger;
  // db actions are async. Needed user to be stored successfully in order for calendars to be stored in db due to FK constraints
  const storeUser = await dbUserActions.insertAccountIntoDatabase(payload);
  // debugger;
  let storeCalendar = [];
  // check to make sure payload.data is defined
  // console.log(payload)
  // debugger;

  // autologin have no payload.data, also not required to stored calendars again for autologin as calendars area already stored.
  if (payload.calendars) {
    storeCalendar = payload.calendars
      .map((cal) => {
        cal.ctag = cal.etag
        cal.displayName = cal.summary
        cal.timezone = cal.timeZone
        cal.account = payload
        cal.objects = {}
        dbCalendarActions.insertCalendar(payload, cal)
      });
  }
  return Promise.all([storeUser, ...storeCalendar]);
};

const storeAccount = async (account) => {
  try {
    await dbUserActions.insertAccountIntoDatabase(account);
  } catch (e) {
    console.log('Store User err: ', e);
    return e;
  }
  return account;
};
