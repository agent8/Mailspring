import { from, of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import { addGoogleEvent, editGoogleEvent, deleteGoogleEvent, asyncGetAllGoogleEvents } from '../../utils/client/google';

import { getEventsSuccess, getEventsFailure, postEventSuccess } from '../../actions/events';
import {
  CREATE_GOOGLE_EVENTS_BEGIN,
  EDIT_GOOGLE_SINGLE_EVENT_BEGIN,
  DELETE_GOOGLE_SINGLE_EVENT_BEGIN,
  EDIT_GOOGLE_ALL_EVENT_BEGIN,
} from '../../actions/providers/google';
import { retrieveStoreEvents } from '../../actions/db/events';

// export const beginGetCaldavEventsEpics = (action$) =>
//   action$.pipe(
//     ofType(GET_CALDAV_EVENTS_BEGIN),
//     mergeMap((action) =>
//       from(
//         new Promise(async (resolve, reject) => {
//           if (action.payload === undefined) {
//             reject(getEventsFailure('Caldav user undefined!!'));
//           }
//           try {
//             const allCalDavUserEventsPromise = action.payload.map((user) =>
//               asyncGetAllCalDavEvents(user.email, user.password, user.principalUrl, user.caldavType)
//             );
//             const allCalDavUserEvents = await Promise.all(allCalDavUserEventsPromise);
//             resolve(allCalDavUserEvents);
//           } catch (e) {
//             console.log(e);
//             throw e;
//           }
//         })
//       ).pipe(
//         map((resp) => getEventsSuccess(resp, Providers.CALDAV, action.payload)),
//         catchError((error) => of(error))
//       )
//     )
//   );

export const createGoogleEventEpics = (action$) =>
  action$.pipe(
    ofType(CREATE_GOOGLE_EVENTS_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.auth)); // auth may have issue for google
        }),
        createGoogleEvent(action.payload)
          .then((resp) =>
            postEventSuccess(
              [resp],
              [action.payload.auth],
              action.payload.providerType,
              action.payload.auth.email,
              action.payload.tempEvents
            )
          )
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const editGoogleSingleEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_GOOGLE_SINGLE_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        editGoogleSingle(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const editGoogleAllRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_GOOGLE_ALL_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        editGoogleAllRecurrenceEvents(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

// export const editCalDavFutureRecurrenceEventEpics = (action$) =>
//   action$.pipe(
//     ofType(EDIT_CALDAV_FUTURE_EVENT_BEGIN),
//     mergeMap((action) =>
//       from([
//         new Promise((resolve, reject) => {
//           resolve(retrieveStoreEvents(action.payload.user));
//         }),
//         editCalDavAllFutureRecurrenceEvents(action.payload)
//           .then(() => retrieveStoreEvents(action.payload.user))
//           .catch((err) => console.log(err))
//       ]).mergeAll()
//     )
//   );

export const deleteGoogleSingleEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_GOOGLE_SINGLE_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        deleteGoogleSingle(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

// export const deleteCalDavAllRecurrenceEventEpics = (action$) =>
//   action$.pipe(
//     ofType(DELETE_CALDAV_ALL_EVENT_BEGIN),
//     mergeMap((action) =>
//       from([
//         new Promise((resolve, reject) => {
//           resolve(retrieveStoreEvents(action.payload.user));
//         }),
//         deleteCalDavAllRecurrenceEvents(action.payload)
//           .then(() => retrieveStoreEvents(action.payload.user))
//           .catch((err) => console.log(err))
//       ]).mergeAll()
//     )
//   );

// export const deleteCalDavFutureRecurrenceEventEpics = (action$) =>
//   action$.pipe(
//     ofType(DELETE_CALDAV_FUTURE_EVENT_BEGIN),
//     mergeMap((action) =>
//       from([
//         new Promise((resolve, reject) => {
//           resolve(retrieveStoreEvents(action.payload.user));
//         }),
//         deleteCalDavAllFutureRecurrenceEvents(action.payload)
//           .then(() => retrieveStoreEvents(action.payload.user))
//           .catch((err) => console.log(err))
//       ]).mergeAll()
//     )
//   );

// TODO
const createGoogleEvent = async (payload) => {
  const { data, calendar, auth } = payload;
  const debug = false;
  if (payload.data.isRecurring) {
    await addGoogleEvent(
      calendar.id,
      auth.accessToken,
      {
        'summary': data.summary,
        'location': data.location,
        'description': data.description,
        'start': {
          'dateTime': data.start.dateTime.format(),
          'timeZone': data.start.timezone
        },
        'end': {
          "dateTime": data.end.dateTime.format(),
          "timeZone": data.end.timezone
        },
        'attendees': Object.keys(data.attendee).map(key => {
          return { 'email': data.attendee[key].email }
        }),
        'recurrence': ['RRULE:'.concat(payload.data.rrule)],

      }
    )
  } else {
    await addGoogleEvent(
      calendar.id,
      auth.accessToken,
      {
        'summary': data.summary,
        'location': data.location,
        'description': data.description,
        'start': {
          'dateTime': data.start.dateTime.format(),
          'timeZone': data.start.timezone
        },
        "end": {
          "dateTime": data.end.dateTime.format(),
          "timeZone": data.end.timezone
        },
        'attendees': Object.keys(data.attendee).map(key => {
          return { 'email': data.attendee[key].email }
        }),
      }
    )
  }

  const allEvents = asyncGetAllGoogleEvents(auth.email, auth.accessToken)
  return allEvents
};

// TODO
const editGoogleSingle = async (payload) => {
  const debug = false;
  await editGoogleEvent(
    payload.calendarId,
    payload.originalId,
    payload.user.accessToken,
    {
      'summary': payload.title,
      'location': payload.location,
      'description': payload.description,
      'start': {
        'dateTime': payload.start.format(),
      },
      'end': {
        "dateTime": payload.end.format(),
      },
      'attendees': Object.keys(payload.attendee).map(key => {
        return { 'email': payload.attendee[key].email }
      }),
      // 'recurrence': ['RRULE:'.concat(payload.data.rrule)],
    }
  )
};

// TODO
const editGoogleAllRecurrenceEvents = async (payload) => {
  const debug = false;
  console.log("PANDA")
  console.log(payload)
  await editGoogleEvent(
    // calendarId
    payload.originalId,
    payload.user.accessToken,
    {
      'summary': payload.title,
      'location': payload.location,
      'description': payload.description,
      'start': {
        'dateTime': payload.start.format(),
      },
      'end': {
        'dateTime': payload.end.format()
      },
      'recurrence': ['RRULE:'.concat(payload.rrule)],
      'attendees': Object.keys(payload.attendee).map(key => {
        return { 'email': payload.attendee[key].email }
      }),
    }
  )
};

// TODO
const editGoogleAllFutureRecurrenceEvents = async (payload) => {
  const debug = false;
};

// TODO
const deleteGoogleSingle = async (payload) => {
  const { data, user } = payload;
  const debug = false;
  await deleteGoogleEvent(data.calendarId, data.originalId, user.accessToken);
};

// TODO
const deleteGoogleAllRecurrenceEvents = async (payload) => {
  const { data, user } = payload;
  const debug = false;
};

// TODO
const deleteGoogleAllFutureRecurrenceEvents = async (payload) => {
  const { data, user } = payload;
  const debug = false;
};
