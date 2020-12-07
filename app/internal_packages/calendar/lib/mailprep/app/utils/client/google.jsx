import md5 from 'md5';
import * as ProviderTypes from '../constants';
import axios from 'axios'
import moment from 'moment';
import uuidv4 from 'uuid';

export const GOOGLE_CLIENT_ID =
  '65724758895-gc7lubjkjsqqddfhlb7jcme80i3mjqn0.apps.googleusercontent.com';
export const GOOGLE_API_KEY = 'AIzaSyAgA9vLu54Xpv6y93yptMDUFzZ8kXyvQnA';

// export const loadClient = async () => {
//   const result = new Promise((resolve, reject) => {
//     if (window.gapi.client === undefined) {
//       reject(new Error('Client undefined!'));
//     }

//     resolve(window.gapi.client.load('calendar', 'v3'));
//   });
//   return result;
// };

// export const loadFullCalendar = async () =>
//   new Promise((resolve) => {
//     resolve(
//       window.gapi.client.calendar.events.list({
//         calendarId: 'primary'
//       })
//     );
//   });

// export const loadSyncCalendar = async (syncToken) =>
//   new Promise((resolve) => {
//     resolve(
//       window.gapi.client.calendar.events.list({
//         calendarId: 'primary',
//         syncToken
//       })
//     );
//   });

// export const postGoogleEvent = async (calendarObject) =>
//   new Promise((resolve) => {
//     resolve(window.gapi.client.calendar.events.insert(calendarObject));
//   });

// export const editGoogleEvent = async (eventId, eventObject) =>
//   new Promise((resolve) => {
//     resolve(
//       window.gapi.client.calendar.events.patch({
//         calendarId: 'primary',
//         eventId,
//         resource: eventObject
//       })
//     );
//   });

// export const deleteGoogleEvent = async (eventId) =>
//   new Promise((resolve) => {
//     resolve(
//       window.gapi.client.calendar.events.delete({
//         calendarId: 'primary',
//         eventId
//       })
//     );
//   });

// export const loadNextPage = async (pageToken) =>
//   new Promise((resolve) => {
//     resolve(
//       window.gapi.client.calendar.events.list({
//         calendarId: 'primary',
//         pageToken
//       })
//     );
//   });

export const getAllCalendars = (accessToken) => {
  return axios.get(
    `https://www.googleapis.com/calendar/v3/users/me/calendarList?key=${GOOGLE_API_KEY}`,
    {
      headers: {
        Authorization: 'Bearer '.concat(accessToken),
        Accept: 'application/json'
      }
    }
  );
}

export const getCalendarEvents = async (calendarId, accessToken) => {
  calendarId = calendarId.replace('#', '%23')
  return await axios.get(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${GOOGLE_API_KEY}`,
    {
      headers: {
        Authorization: 'Bearer '.concat(accessToken),
        Accept: 'application/json'
      }
    }
  )
}

export const addGoogleEvent = (calendarId, accessToken, event) => {
  return axios.post(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${GOOGLE_API_KEY}`,
    event,
    {
      headers: {
        Authorization: 'Bearer '.concat(accessToken),
        Accept: 'application/json',
        "Content-Type": 'application/json',
      }
    },
  )
}

export const editGoogleEvent = (calendarId, eventId, accessToken, event) => {
  return axios.put(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?key=${GOOGLE_API_KEY}`,
    event,
    {
      headers: {
        Authorization: 'Bearer '.concat(accessToken),
        Accept: 'application/json',
        "Content-Type": 'application/json',
      }
    },
  )
}

export const deleteGoogleEvent = (calendarId, eventId, accessToken) => {
  return axios.delete(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?key=${GOOGLE_API_KEY}`,
    {
      headers: {
        Authorization: 'Bearer '.concat(accessToken),
        Accept: 'application/json',
      }
    },
  )
}

export const filterUser = (account, calendars, accessToken, accessTokenExpiry = '') => {
  return ({
    personId: md5(account.pid),
    originalId: account.pid,
    email: account.emailAddress,
    providerType: ProviderTypes.GOOGLE,
    calendars: calendars.length > 0 ? calendars : [],
    accessToken,
    accessTokenExpiry
  })
};

export const asyncGetAllGoogleEvents = async (email, accessToken) => {
  // 1. get the list of calendars
  // 2. For each calendar retrieve the events
  // 3. Parse the events

  let res = await getAllCalendars(accessToken);
  const calendars = res.data.items;

  try {
    let finalResult = []
    for (const calendar of calendars) {
      let resp = await getCalendarEvents(calendar.id, accessToken);
      const events = resp.data;

      for (const event of events.items) {
        if (event.end) {
          finalResult.push({
            attendee: event.attendees ? JSON.stringify({
              ...event.attendees.map(attendee => {
                let partstat = 'NEEDS-ACTION'
                if (attendee.responseStatus === 'accepted') partstat = 'APPROVED'
                if (attendee.responseStatus === 'declined') partstat = 'DECLINED'
                return {
                  email: attendee.email,
                  partstat
                }
              })
            }) : '',
            calendarId: calendar.id,
            colorId: 'blue', // TODO the color logic
            created: moment(event.created).unix(),
            description: event.description ? event.description : '',
            end: {
              dateTime: moment(event.end.dateTime ? event.end.dateTime : event.end.date).unix()
            },
            etag: event.etag,
            iCalUID: event.iCalUID,
            id: uuidv4(),
            isAllDay: event.date,
            // isMaster: true,
            isRecurring: event.recurringEventId ? true : false,
            location: event.location,
            organizer: event.organizer ? event.organizer.email : '',
            originalId: event.iCalUID,
            originalStartTime: {
              dateTime: moment(event.start.dateTime ? event.start.dateTime : event.start.date).unix()
            },
            owner: event.creator ? event.creator.email : '',
            providerType: 'GOOGLE',
            recurringEventId: event.recurringEventId ? event.recurringEventId : '',
            start: {
              dateTime: moment(event.start.dateTime ? event.start.dateTime : event.start.date).unix()
            },
            summary: event.summary,
            updated: 0,
            // CALDAV Fields: Not relevant
            iCALString: '',
            caldavType: '',
            caldavUrl: '',
          })
        }
      }
    }
    return finalResult;
  } catch (e) {
    console.log(e)
  }
}