import md5 from 'md5';
import * as ProviderTypes from '../constants';

export const GOOGLE_CLIENT_ID =
  '65724758895-gc7lubjkjsqqddfhlb7jcme80i3mjqn0.apps.googleusercontent.com';
export const GOOGLE_API_KEY = 'AIzaSyCTYXWtoRKnXeZkPCcZwYOXm0Qz3Lz9F9g';
export const GOOGLE_SCOPE = `https://www.googleapis.com/auth/calendar.events`;

export const loadClient = async () => {
  const result = new Promise((resolve, reject) => {
    if (window.gapi.client === undefined) {
      reject(new Error('Client undefined!'));
    }

    resolve(window.gapi.client.load('calendar', 'v3'));
  });
  return result;
};

export const loadFullCalendar = async () =>
  new Promise((resolve) => {
    resolve(
      window.gapi.client.calendar.events.list({
        calendarId: 'primary'
      })
    );
  });

export const loadSyncCalendar = async (syncToken) =>
  new Promise((resolve) => {
    resolve(
      window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        syncToken
      })
    );
  });

export const postGoogleEvent = async (calendarObject) =>
  new Promise((resolve) => {
    resolve(window.gapi.client.calendar.events.insert(calendarObject));
  });

export const editGoogleEvent = async (eventId, eventObject) =>
  new Promise((resolve) => {
    resolve(
      window.gapi.client.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        resource: eventObject
      })
    );
  });

export const deleteGoogleEvent = async (eventId) =>
  new Promise((resolve) => {
    resolve(
      window.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId
      })
    );
  });

export const loadNextPage = async (pageToken) =>
  new Promise((resolve) => {
    resolve(
      window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        pageToken
      })
    );
  });

export const filterUser = (account, calendars, accessToken, accessTokenExpiry = '') => ({
  personId: md5(account.pid),
  originalId: account.pid,
  email: account.emailAddress,
  providerType: ProviderTypes.GOOGLE,
  calendars: calendars.length > 0 ? calendars : [],
  accessToken,
  accessTokenExpiry
});