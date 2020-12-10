import {
  map,
  mergeMap,
  catchError,
  takeUntil,
  switchMap,
  concatMap,
  exhaustMap
} from 'rxjs/operators';
import { ofType } from 'redux-observable';
import { from, iif, of, interval, throwError } from 'rxjs';
import { Client } from '@microsoft/microsoft-graph-client';
import {
  Appointment,
  DateTime,
  ExchangeService,
  ExchangeCredentials,
  Item,
  MessageBody,
  Uri,
  SendInvitationsMode,
  WellKnownFolderName,
  PropertySet,
  BasePropertySet,
  AppointmentSchema,
  BodyType,
  ItemId,
  FolderView
} from 'ews-javascript-api';
import moment from 'moment-timezone';
import _ from 'lodash';
import uuidv4 from 'uuid';
// import { uuidv1 } from 'uuid/v1';
import ICAL from 'ical.js';

import { syncStoredEvents, retrieveStoreEvents, UPDATE_STORED_EVENTS } from '../actions/db/events';
// import {
//   loadClient,
//   loadFullCalendar,
//   loadSyncCalendar,
//   loadNextPage,
//   postGoogleEvent,
//   deleteGoogleEvent,
//   editGoogleEvent
// } from '../utils/client/google';
import * as Providers from '../utils/constants';
import { getUserEvents, getAccessToken, filterEventToOutlook } from '../utils/client/outlook';
import {
  asyncCreateExchangeEvent,
  asyncDeleteExchangeEvent,
  asyncGetRecurrAndSingleExchangeEvents,
  asyncUpdateExchangeEvent,
  createNewEwsRecurrenceObj,
  parseEwsRecurringPatterns
} from '../utils/client/exchange';

import {
  asyncGetSingleExchangeEvent,
  asyncGetAllExchangeEvents
} from '../utils/client/exchangebasics';

import {
  // GET_EVENTS_BEGIN,
  // EDIT_EVENT_BEGIN,
  POST_EVENT_BEGIN,
  CLEAR_ALL_EVENTS,
  BEGIN_POLLING_EVENTS,
  END_POLLING_EVENTS,
  BEGIN_PENDING_ACTIONS,
  END_PENDING_ACTIONS,
  CLEAR_ALL_EVENTS_SUCCESS,
  apiFailure,
  getEventsSuccess,
  postEventSuccess,
  editEventSuccess,
  getEventsFailure,
  clearAllEventsSuccess,
  endPollingEvents,
  EDIT_EVENT_BEGIN,
  beginPollingEvents
} from '../actions/events';
import * as Credentials from '../utils/credentials';
import ServerUrls from '../utils/serverUrls';
import { asyncGetAllCalDavEvents } from '../utils/client/caldav';
import { asyncGetAllGoogleEvents } from '../utils/client/google';
import * as IcalStringBuilder from '../utils/icalStringBuilder';

import * as dbGeneralActions from '../sequelizeDB/operations/general';
import * as dbAccountsActions from '../sequelizeDB/operations/accounts';

import * as dbEventActions from '../sequelizeDB/operations/events';
import * as dbRpActions from '../sequelizeDB/operations/recurrencepatterns';
import * as dbPendingActionActions from '../sequelizeDB/operations/pendingactions';
import { createEwsEventBegin } from '../actions/providers/exchange';
import { createCaldavEventBegin } from '../actions/providers/caldav';
import { createGoogleEventBegin } from '../actions/providers/google';
import { parseRecurrenceEvents, parseRecurrence } from '../utils/parser';
import { SUCCESS_STORE_AUTH } from '../actions/db/auth';

const dav = require('dav');
const uuidv1 = require('uuid/v1');

// #region Google (Not Working)
// export const beginGetEventsEpics = (action$) =>
//   action$.pipe(
//     ofType(GET_EVENTS_BEGIN),
//     mergeMap((action) =>
//       iif(
//         () => action.payload !== undefined,
//         from(loadClient()).pipe(
//           mergeMap(() =>
//             from(setCalendarRequest()).pipe(
//               mergeMap((resp) =>
//                 from(eventsPromise(resp)).pipe(
//                   // made some changes here for resp, unsure if it breaks.
//                   map((resp2) => getEventsSuccess(resp2, Providers.GOOGLE))
//                 )
//               )
//             )
//           )
//         ),
//         of(getEventsFailure('Google user undefined!!'))
//       )
//     )
//   );

// export const beginEditEventEpics = (action$) =>
//   action$.pipe(
//     ofType(EDIT_EVENT_BEGIN),
//     mergeMap((action) =>
//       from(editEvent(action.payload)).pipe(
//         map((resp) => editEventSuccess(resp), catchError((error) => apiFailure(error)))
//       )
//     )
//   );

// const editEvent = async (payload) => {
//   const calendarObject = payload.data;
//   const { id } = payload;
//   await loadClient();
//   return editGoogleEvent(id, calendarObject);
// };

// const deleteEvent = async (id) => {
//   await loadClient();
//   return deleteGoogleEvent(id);
// };

// const setCalendarRequest = () => {
//   let request;
//   const syncToken = localStorage.getItem('sync');
//   if (syncToken == null) {
//     console.log('Performing full sync');
//     request = loadFullCalendar();
//   } else {
//     console.log('Performing incremental sync');
//     request = loadSyncCalendar(syncToken);
//   }
//   return request;
// };

// const eventsPromise = async (resp) => {
//   const items = [];
//   return new Promise((resolve, reject) => {
//     fetchEvents(resp, items, resolve, reject);
//   });
// };

// const fetchEvents = (resp, items, resolve, reject) => {
//   const newItems = items.concat(resp.result.items);
//   if (resp.result.nextPageToken !== undefined) {
//     loadNextPage(resp.result.nextPageToken)
//       .then((nextResp) => fetchEvents(nextResp, newItems, resolve, reject))
//       .catch((e) => {
//         if (e.code === 410) {
//           console.log('Invalid sync token, clearing event store and re-syncing.');
//           localStorage.deleteItem('sync');
//           loadFullCalendar().then((newResp) => fetchEvents(newResp, items, resolve, reject));
//         } else {
//           console.log(e);
//           reject('Something went wrong, Please refresh and try again');
//         }
//       });
//   } else {
//     localStorage.setItem('sync', resp.result.nextSyncToken);
//     resolve(newItems);
//   }
// };
// #endregion

// #region Create Events Epics
export const beginPostEventEpics = (action$) =>
  action$.pipe(
    ofType(POST_EVENT_BEGIN),
    mergeMap((action) => from(createEvent(action.payload)).pipe(map((resp) => resp)))
  );

const createEvent = async (payload) => {
  const debug = false;

  // Create the event, be it recurrence or what and insert.
  const tempEventAndRp = createEventDb(payload.data, payload.auth);
  const dbEvents = tempEventAndRp.events;
  if (payload.data.isRecurring) {
    const dbRp = tempEventAndRp.rp;
    await dbRpActions.insertOrUpdateRp(dbRp);
    payload.tempRp = dbRp;
  }
  await Promise.all(dbEvents.map((event) => dbEventActions.insertEventsIntoDatabase(event)));
  payload.tempEvents = dbEvents;

  // Based off which provider, we will have different delete functions.
  switch (payload.providerType) {
    case Providers.GOOGLE:
      try {
        return createGoogleEventBegin(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    case Providers.OUTLOOK:
      try {
        console.log('Outlook, To-Do create feature');
      } catch (outlookError) {
        console.log('Handle Outlook pending action here', outlookError);
      }
      break;
    case Providers.EXCHANGE:
      // Try catch for HTTP errors, offline etc.
      try {
        return createEwsEventBegin(payload);
      } catch (exchangeError) {
        // debugger;
        // // Delete doc is meant for both offline and online actions.
        // // This means item has been deleted on server, maybe by another user
        // // Handle this differently.
        // if (exchangeError.ErrorCode === 249) {
        //   // Just remove it from database instead, and break;
        //   await dbEventActions.deleteEventById(payload.id);
        //   break;
        // }
        // // Upsert it to the pending action, let pending action automatically handle it.
        // await dbPendingActionActions.insertPendingActionIntoDatabase({
        //   uniqueId: uuidv4(),
        //   eventId: payload.originalId,
        //   status: 'pending',
        //   type: 'create'
        // });
      }
      break;
    case Providers.CALDAV:
      try {
        return createCaldavEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Create feature for ${payload.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: payload.providerType,
    user: Providers.filterUsersIntoSchema(payload.auth)
  };
};

const postEventGoogle = async (resource) => {
  const calendarObject = {
    calendarId: 'primary',
    resource: resource.data
  };
  // await loadClient();
  // return postGoogleEvent(calendarObject);
  return apiFailure('Google post event unimplemented.');
};

const postEventsOutlook = (payload) =>
  new Promise((resolve, reject) => {
    getAccessToken(payload.auth.accessToken, payload.auth.accessTokenExpiry, (accessToken) => {
      if (accessToken) {
        // Create a Graph client
        const client = Client.init({
          authProvider: (done) => {
            // Just return the token
            done(null, accessToken);
          }
        });

        // This first select is to choose from the list of calendars
        resolve(
          client
            .api(
              '/me/calendars/AAMkAGZlZDEyNmMxLTMyNDgtNDMzZi05ZmZhLTU5ODk3ZjA5ZjQyOABGAAAAAAA-XPNVbhVJSbREEYK0xJ3FBwCK0Ut7mQOxT5W1Wd82ZSuqAAAAAAEGAACK0Ut7mQOxT5W1Wd82ZSuqAAGfLM-yAAA=/events'
            )
            .post(filterEventToOutlook(payload.data))
        );
      } else {
        const error = { responseText: 'Could not retrieve access token' };
        console.log(error);
        reject(error);
      }
    });
  });

// To create a local db event for displaying immediately first
// This creates an event from the data with minimum data.
// I will rely on individual posting of events to deal with correct event data.
// I also need to remove it upon successful posting of an event.
const createEventDb = (data, auth) => {
  const basicEvent = {
    id: uuidv4(),
    originalId: uuidv4(),
    start: { dateTime: data.start.dateTime.unix(), timezone: data.start.timezone },
    end: { dateTime: data.end.dateTime.unix(), timezone: data.end.timezone },
    summary: data.summary,
    description: data.description,
    providerType: auth.providerType,
    owner: auth.email,
    isRecurring: data.isRecurring,
    iCalUID: uuidv4(),
    allDay: data.allDay,
    calendarId: data.calendarId,
    colorId: data.colorId,
    location: data.location,
    organizer: data.organizer,
    attendee: JSON.stringify(data.attendee)
  };

  if (data.isRecurring) {
    // eslint-disable-next-line no-underscore-dangle
    const rrule = ICAL.Recur._stringToData(data.rrule);
    if (rrule.until !== undefined) {
      rrule.until.adjust(1, 0, 0, 0, 0);
    }
    let untilJson;
    if (rrule.until !== undefined) {
      untilJson = rrule.until.toJSON();
      untilJson.month -= 1; // Month needs to minus one due to start date
    }
    const rp = parseRecurrenceEvents([
      {
        eventData: basicEvent,
        recurData: {
          rrule: {
            stringFormat: data.rrule,
            freq: rrule.freq,
            interval: rrule.interval !== undefined ? rrule.interval : 1,
            until: untilJson,
            count: rrule.count
          },
          exDates: [],
          recurrenceIds: [],
          modifiedThenDeleted: false,
          iCALString: data.rrule
        }
      }
    ]);
    const events = parseRecurrence(rp[0], basicEvent);
    // This basically just sets the originalId of the recurrence pattern to the generic icaluid
    // so CRUD actions can be performed locally
    rp[0].originalId = events[0].iCalUID;
    return { events, rp: rp[0] };
  }
  return { events: [basicEvent] };
};

const createEventExchange = (data, user) => {
  // Create Exchange Service and set up credientials
  const exch = new ExchangeService();
  exch.Url = new Uri('https://outlook.office365.com/Ews/Exchange.asmx');
  exch.Credentials = new ExchangeCredentials(user.email, user.password);

  const newEvent = new Appointment(exch);

  const startDate = new DateTime(moment.tz(data.start.dateTime, data.start.timezone));

  // Map variables from local to server object
  newEvent.Subject = data.summary;
  newEvent.Body = new MessageBody(data.description);
  newEvent.Start = startDate;
  newEvent.End = new DateTime(moment.tz(data.end.dateTime, data.end.timezone));

  if (data.isRepeating) {
    const newRecurrencePattern = {};
    const updatedId = uuidv1();
    const updatedUid = uuidv1();

    // eslint-disable-next-line no-underscore-dangle
    const jsonRecurr = ICAL.Recur._stringToData(data.rrule);
    const ewsReucrr = createNewEwsRecurrenceObj(
      jsonRecurr['rrule:freq'],
      [0, jsonRecurr.BYDAY, 0, 0],
      jsonRecurr.interval,
      startDate,
      jsonRecurr.until,
      jsonRecurr.count,
      jsonRecurr.BYMONTH,
      jsonRecurr.BYMONTHDAY,
      jsonRecurr.BYDAY,
      jsonRecurr.BYSETPOS
    );
    newEvent.Recurrence = ewsReucrr;
  }

  return newEvent;
};
// #endregion

// #region General Epics
export const clearAllEventsEpics = (action$) =>
  action$.pipe(
    ofType(CLEAR_ALL_EVENTS),
    map(() => {
      localStorage.clear();
      dbGeneralActions.cleardb();
      return clearAllEventsSuccess();
    })
  );
// #endregion

// #region Polling Epics
export const successStoreAuthEpics = (action$) =>
  action$.pipe(
    ofType(SUCCESS_STORE_AUTH),
    mergeMap((action) =>
      from(dbAccountsActions.getAllAccounts()).pipe(
        mergeMap((resp) => {
          console.log(resp.map((mapToJson) => mapToJson.toJSON()));
          return of(beginPollingEvents(resp.map((mapToJson) => mapToJson.toJSON())));
        }),
        catchError((error) => {
          of(console.log(error));
        })
      )
    )
  );

export const pollingEventsEpics = (action$) => {
  const stopPolling$ = action$.pipe(ofType(END_POLLING_EVENTS));
  return action$.pipe(
    // ofType(BEGIN_POLLING_EVENTS, UPDATE_STORED_EVENTS),
    ofType(BEGIN_POLLING_EVENTS),
    switchMap((action) =>
      interval(60 * 1000).pipe(
        takeUntil(stopPolling$),
        switchMap(() => from(syncEvents(action))),
        map((results) => {
          // console.log(results);
          return syncStoredEvents(results);
        })
      )
    )
  );
};

const syncEvents = async (action) => {
  const { users } = action;
  const userEventsResults = await Promise.all(
    users.map(async (user) => {
      // Check which provider
      switch (user.providerType) {
        case Providers.GOOGLE:
          console.log("GOOGLE EVENTS SYNCING")
          try {
            // debugger;
            const events = await asyncGetAllGoogleEvents(
              user.email,
              user.accessToken
            );
            console.log(user);
            console.log(events);
            // debugger;
            const dbEvents = await dbEventActions.getAllEvents();
            const updatedEvents = [];
            const listOfPriomises = [];

            for (const event of events) {
              const dbObj = dbEvents.filter(
                (dbEvent) =>
                  dbEvent.providerType === event.providerType &&
                  dbEvent.start.dateTime === event.start.dateTime &&
                  dbEvent.originalId === event.originalId
              );
              const filteredEvent = Providers.filterIntoSchema(
                event,
                Providers.GOOGLE,
                user.email,
                false
              );

              // debugger;

              if (dbObj.length === 0) {
                // New object from server, add and move on to next one.
                updatedEvents.push({ event: filteredEvent, type: 'create' });
                listOfPriomises.push(dbEventActions.insertEventsIntoDatabase(filteredEvent));
              } else {
                // Sync old objects and compare in case.
                const dbEvent = dbObj[0];

                // Just update, server is always truth, no matter what
                updatedEvents.push({ event: filteredEvent, type: 'update' });
                filteredEvent.id = dbEvent.id;
                listOfPriomises.push(
                  dbEventActions.updateEventByiCalUIDandStartDateTime(
                    filteredEvent.iCalUID,
                    event.start.dateTime,
                    filteredEvent
                  )
                );
              }
            }

            // debugger;

            // Check for deleted events, as if it not in the set, it means that it could be deleted.
            // In database, but not on server, as we are taking server, we just assume delete.
            for (const dbEvent of dbEvents) {
              const result = events.find(
                (event) =>
                  dbEvent.start.dateTime === event.start.dateTime &&
                  dbEvent.originalId === event.originalId &&
                  dbEvent.providerType === event.providerType
              );
              // Means we found something, move on to next object or it has not been uploaded to the server yet.
              if (
                dbEvent.providerType !== Providers.GOOGLE ||
                result !== undefined ||
                dbEvent.createdOffline === true
              ) {
                continue;
              }
              console.log('Found a event not on server, but is local', dbEvent);

              // Means not found, delete it if it is not a new object.
              updatedEvents.push({
                event: Providers.filterEventIntoSchema(dbEvent),
                type: 'delete'
              });
              listOfPriomises.push(
                dbEventActions.deleteEventByiCalUIDandStartDateTime(
                  dbEvent.originalId,
                  dbEvent.start.dateTime
                )
              );
            }
            await Promise.all(listOfPriomises);
            return updatedEvents;
          } catch (e) {
            console.log(e);
            return [];
          }
          break;
        case Providers.OUTLOOK:
          break;
        case Providers.EXCHANGE:
          // For Exchange, We get all appointments based off the user,
          // And we check if there is anything new.
          // If there is nothing new, we return nothing.
          try {
            const exch = new ExchangeService();
            exch.Url = new Uri('https://outlook.office365.com/Ews/Exchange.asmx');
            exch.Credentials = new ExchangeCredentials(user.email, user.password);

            const appts = await asyncGetRecurrAndSingleExchangeEvents(exch);

            debugger;

            // However, we need to get all items from database too, as created offline events
            // does not exist on the server yet.
            const dbEvents = await dbEventActions.getAllEvents();
            const updatedEvents = [];
            const listOfPriomises = [];

            for (const appt of appts) {
              const dbObj = dbEvents.filter((dbEvent) => dbEvent.originalId === appt.Id.UniqueId);
              const filteredEvent = Providers.filterIntoSchema(
                appt,
                Providers.EXCHANGE,
                user.email,
                false
              );

              if (dbObj.length === 0) {
                // New object from server, add and move on to next one.
                updatedEvents.push({ event: filteredEvent, type: 'create' });
                // listOfPriomises.push(db.events.upsert(filteredEvent));
                listOfPriomises.push(dbEventActions.insertEventsIntoDatabase(filteredEvent));
              } else {
                // Sync old objects and compare in case.
                const dbEvent = dbObj[0];
                const lastUpdatedTime = moment(dbEvent.updated);

                if (
                  appt.Id.UniqueId === dbEvent.originalId &&
                  appt.LastModifiedTime.getMomentDate() > lastUpdatedTime
                ) {
                  console.log(
                    appt.LastModifiedTime.getMomentDate(),
                    lastUpdatedTime,
                    appt.LastModifiedTime.getMomentDate() > lastUpdatedTime
                  );

                  updatedEvents.push({ event: filteredEvent, type: 'update' });
                  // Problem here now is due to upsert changing its behavior.
                  // Upsert is based on the primary key, and as our UUID is now not relying on originalId,
                  // We got an issue.
                  // This means we have to write a query to update based off the filteredEvent data
                  // but keep the primary key.
                  filteredEvent.id = dbEvent.id;
                  listOfPriomises.push(
                    dbEventActions.updateEventByOriginalId(filteredEvent.originalId, filteredEvent)
                  );
                }
              }
            }

            // debugger;

            // Check for deleted events, as if it not in the set, it means that it could be deleted.
            // In database, but not on server, as we are taking server, we just assume delete.
            for (const dbEvent of dbEvents) {
              const result = appts.find((appt) => appt.Id.UniqueId === dbEvent.originalId);

              // Means we found something, move on to next object or it has not been uploaded to the server yet.
              if (
                dbEvent.providerType !== Providers.EXCHANGE ||
                result !== undefined ||
                dbEvent.createdOffline === true
              ) {
                continue;
              }
              console.log('Found an Exchange event not on server, but is local', dbEvent);

              // Means not found, delete it if it is not a new object.
              updatedEvents.push({
                event: Providers.filterEventIntoSchema(dbEvent),
                type: 'delete'
              });
              listOfPriomises.push(dbEventActions.deleteEventByOriginalId(dbEvent.originalId));
            }
            const rest = await Promise.all(listOfPriomises);
            // debugger;
            console.log(updatedEvents);
            return updatedEvents;
          } catch (error) {
            // Return empty array, let next loop handle syncing.
            return [];
          }
        case Providers.CALDAV:
          try {
            // debugger;
            const events = await asyncGetAllCalDavEvents(
              user.email,
              user.password,
              user.principalUrl,
              user.caldavType
            );
            // console.log(user);
            // console.log(events);
            // debugger;
            const dbEvents = await dbEventActions.getAllEvents();
            const updatedEvents = [];
            const listOfPriomises = [];

            for (const event of events) {
              const dbObj = dbEvents.filter(
                (dbEvent) =>
                  dbEvent.start.dateTime === event.start.dateTime &&
                  dbEvent.originalId === event.originalId
              );
              const filteredEvent = Providers.filterIntoSchema(
                event,
                Providers.CALDAV,
                user.email,
                false
              );

              // debugger;

              if (dbObj.length === 0) {
                // New object from server, add and move on to next one.
                updatedEvents.push({ event: filteredEvent, type: 'create' });
                listOfPriomises.push(dbEventActions.insertEventsIntoDatabase(filteredEvent));
              } else {
                // Sync old objects and compare in case.
                const dbEvent = dbObj[0];

                // Just update, coz caldav, server is always truth, no matter what
                // Also, the damn updated field is never updated. Wtf.
                updatedEvents.push({ event: filteredEvent, type: 'update' });
                filteredEvent.id = dbEvent.id;
                listOfPriomises.push(
                  dbEventActions.updateEventByiCalUIDandStartDateTime(
                    filteredEvent.iCalUID,
                    event.start.dateTime,
                    filteredEvent
                  )
                );
              }
            }

            // debugger;

            // Check for deleted events, as if it not in the set, it means that it could be deleted.
            // In database, but not on server, as we are taking server, we just assume delete.
            for (const dbEvent of dbEvents) {
              const result = events.find(
                (event) =>
                  dbEvent.start.dateTime === event.start.dateTime &&
                  dbEvent.originalId === event.originalId &&
                  dbEvent.providerType === event.providerType
              );
              // Means we found something, move on to next object or it has not been uploaded to the server yet.
              if (
                dbEvent.providerType !== Providers.CALDAV ||
                result !== undefined ||
                dbEvent.createdOffline === true
              ) {
                continue;
              }
              console.log('Found a event not on server, but is local', dbEvent);

              // Means not found, delete it if it is not a new object.
              updatedEvents.push({
                event: Providers.filterEventIntoSchema(dbEvent),
                type: 'delete'
              });
              listOfPriomises.push(
                dbEventActions.deleteEventByiCalUIDandStartDateTime(
                  dbEvent.originalId,
                  dbEvent.start.dateTime
                )
              );
            }
            await Promise.all(listOfPriomises);
            return updatedEvents;
          } catch (e) {
            console.log(e);
            return [];
          }
        default:
          break;
      }
    })
  );
  return userEventsResults.reduce((prev, curr) => prev.concat(curr));
};
// #endregion

// #region Pending Actions Epics
export const pendingActionsEpics = (action$) => {
  // Stop upon a end pending action trigger, for debugging/stopping if needed
  const stopPolling$ = action$.pipe(ofType(END_PENDING_ACTIONS));
  return action$.pipe(
    ofType(BEGIN_PENDING_ACTIONS),
    switchMap((action) =>
      // At a 5 second interval
      interval(10 * 1000).pipe(
        // Stop when epics see a end pending action
        takeUntil(stopPolling$),
        concatMap(() =>
          // Get the db
          // Get all the pending actions
          from(dbPendingActionActions.getAllPendingActions()).pipe(
            // For each pending action, run the correct result
            mergeMap((actions) =>
              from(handlePendingActions(actions)).pipe(
                // Return an array of result, reduced accordingly.
                mergeMap((result) => of(...result))
              )
            )
          )
        )
      )
    )
  );
};

const reflect = (p) =>
  p.then(
    (v) => ({ v, status: 'fulfilled' }),
    (e) => ({ e, status: 'rejected' })
  );

/*
You were dealing with creating an offline recurrence event pending action
And you just finished createEwsEvent on exchange.js provider epics.

Now, upon an error, you throw a begin pending actions for pending action epics to handle
However, in order to begin pending actions, its previously needed the user information
and due to how you were handling it with rxdb, you prob will have error when accessing data

Therefore, the list of things we should do is

1. Remove users params from handle pending actions by querying the db for the users directly.
2. Add what happens when it is a recurrence event
  - The database has a temp store of the rp.
  - Therefore, all you need to do is query the database based off the originalId
  - Then from there, attempt to cast the action and retrieve if success.

3. When merging the event together,
  - If Success
    - Remove the temp events based off the iCalUID
    - Remove the recurrence pattern if it is a recurrence event, e.g. local should be true.
4. Checking the updating moment will not work as updated might be outdated. You are also using unix now.
*/
const handlePendingActions = async (actions) => {
  // Get all events for resolving conflict.
  const docs = await dbEventActions.getAllEvents();
  const dbAccounts = await dbAccountsActions.getAllAccounts();
  const accounts = dbAccounts.map((account) => account.toJSON());

  // Promises array for each of our async action.
  const promisesArr = actions.map(async (action) => {
    // debugger;
    // Find the corresponding item in our database that is in the pending action.
    const rxDbObj = docs.filter((obj) => obj.id === action.eventId)[0].toJSON();
    // Find the correct user credentials.
    const account = accounts.filter(
      (indivAcc) =>
        indivAcc.providerType === rxDbObj.providerType && indivAcc.email === rxDbObj.owner
      // indivAcc.providerType === rxDbObj.providerType && indivAcc.owner === rxDbObj.email
    )[0];

    // debugger;

    // Declare here for ease over all providers, not used for create events.
    let serverObj;

    // Try/Catch handles when there is any error, network or otherwise.
    try {
      switch (rxDbObj.providerType) {
        case Providers.GOOGLE:
          break;
        case Providers.OUTLOOK:
          break;
        case Providers.EXCHANGE:
          // For create, we need to handle differently as there is nothing on server,
          // So we ignore it.
          if (action.type !== 'create') {
            serverObj = await asyncGetSingleExchangeEvent(
              account.email,
              account.password,
              'https://outlook.office365.com/Ews/Exchange.asmx',
              rxDbObj.originalId
            );
          }
          break;
        default:
          return apiFailure('Unhandled provider for Pending actions');
      }

      // Get a resulting action from the merge function.
      const resultingAction = await handleMergeEvents(
        rxDbObj,
        serverObj,
        action.type,
        action.recurrenceType,
        account
      );

      // Return object to be reduced down later on, with the proper user information.
      return { result: resultingAction, user: account };
    } catch (error) {
      // Just remove it from database instead, and break;
      // This is when the item has been deleted on server, but not local due to sync.
      // Error is thrown by asyncGetSingleExchangeEvent
      // console.log(error);
      if (error.ErrorCode === 249) {
        console.log('removing action', action);
        await action.remove();
      }
      throw error;
    }
  });

  // The logic here, is to wait for all promises to complete, NO MATTER SUCCESS OR FAILURE
  // Reason being is we want it to requeue the failed ones, but still not block the UI.
  // We use a techinque called reflect for this, https://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
  // Based on each result, if ANY of them is a success, we start retrieving stored events
  // and assume that our queue is still valid, and let it re-run on its own next cycle.
  // However, I need to retrieve stored events for the providers that are fulfilled, and not those who are not.
  const result = await Promise.all(promisesArr.map(reflect));
  const appendedUsers = [];
  const noDuplicateUsers = result.reduce((a, b) => {
    if (
      b.status === 'fulfilled' && // ensure that it is a success
      !a.some((singleUser) => _.isEqual(singleUser.v.user, b.v.user)) && // ensure that the same user is not inside
      !(appendedUsers.filter((appendedUser) => _.isEqual(appendedUser, b.v.user)).length > 1) // ensure that the return array does not contain that user
    ) {
      a.push(b);
      appendedUsers.push(b.v.user);
    }
    return a;
  }, []);

  // For every successful user, it will map a retrieve stored event for it.
  // Returns multiple action due to filtering on UI selector, updates specific providers only, not all of them.
  const resultingAction = noDuplicateUsers.map((indivAcc) => retrieveStoreEvents(indivAcc.v.user));

  // Unsure if needed due to if all fail to send
  return resultingAction;
};

const handleMergeEvents = async (localObj, serverObj, type, recurrenceType, user) => {
  let result = '';

  // Create is a specific type, as it assumes local is the source of truth.
  // So I can assume if success, just return.
  // If error, let pending actions automatically try, without the need of triggering it.
  if (type === 'create') {
    switch (localObj.providerType) {
      case Providers.GOOGLE:
        break;
      case Providers.OUTLOOK:
        break;
      case Providers.EXCHANGE:
        result = await asyncCreateExchangeEvent(
          user.email,
          user.password,
          'https://outlook.office365.com/Ews/Exchange.asmx',
          localObj
        );
        break;
      default:
        console.log('(Handle Merge Events) Provider not accounted for');
        break;
    }

    // debugger;

    // Only if success
    if (result.type === 'POST_EVENT_SUCCESS') {
      // Remove the pending action first
      await dbPendingActionActions.deletePendingActionById(localObj.id);
      return result;
    }
  }

  // Merging main code!
  const filteredServerObj = Providers.filterIntoSchema(
    serverObj,
    localObj.providerType,
    localObj.owner,
    false
  );

  // Parse time into moment so we can handle them.
  const localUpdatedTime = moment(localObj.updated);
  const serverUpdatedTime = moment(filteredServerObj.updated);

  // Not used now, but can be used for future merging if needed.
  const dateIsAfter = localUpdatedTime.isAfter(serverUpdatedTime);
  const dateIsBefore = localUpdatedTime.isBefore(serverUpdatedTime);

  // Local means changes has been made to it. So if it is new, then compare.
  // Else, take the server always.
  if (localObj.local) {
    const dateIsSame = localUpdatedTime.isSame(serverUpdatedTime);

    // Only if date between server and local is the same, then we take local.
    if (dateIsSame) {
      // Take local
      switch (localObj.providerType) {
        case Providers.GOOGLE:
          break;
        case Providers.OUTLOOK:
          break;
        case Providers.EXCHANGE:
          switch (type) {
            case 'update':
              // TO-DO, add more update fields
              serverObj.Subject = localObj.summary;
              serverObj.Location = localObj.location;

              switch (recurrenceType) {
                case 'single':
                  result = await asyncUpdateExchangeEvent(serverObj, user, () => {
                    console.log('Pending Action Edited Single Exchange Event');
                  });
                  break;
                case 'all':
                  break;
                case 'future':
                  break;
                default:
                  break;
              }

              if (result.type === 'EDIT_EVENT_SUCCESS') {
                await dbPendingActionActions.deletePendingActionById(localObj.id);
              }
              return result;
            case 'delete':
              switch (recurrenceType) {
                case 'single':
                  result = await asyncDeleteExchangeEvent(serverObj, user, () => {
                    console.log('Pending Action Deleted Single Exchange Event');
                  });
                  break;
                case 'all':
                  // asyncGetSingleExchangeEvent will throw error when no internet or event missing.
                  const recurringMasterObj = await asyncGetSingleExchangeEvent(
                    user.email,
                    user.password,
                    'https://outlook.office365.com/Ews/Exchange.asmx',
                    localObj.recurringEventId
                  );
                  await dbEventActions.deleteAllEventByRecurringEventId(localObj.recurringEventId);
                  result = await asyncDeleteExchangeEvent(recurringMasterObj, user, () => {
                    console.log('Pending Action Deleted All Exchange Event');
                  });
                  break;
                case 'future':
                  break;
                default:
                  break;
              }

              if (result.type === 'DELETE_EVENT_SUCCESS') {
                await dbPendingActionActions.deletePendingActionById(localObj.id);
              }
              return result;
            default:
              console.log('(Exchange, Merge) Unhandled CRUD type');
              break;
          }
          break;
        default:
          console.log('(Handle Merge Events) Provider not accounted for');
          break;
      }
    } else if (dateIsBefore) {
      // Keep server
      await dbEventActions.insertEventsIntoDatabase(filteredServerObj);
      await dbPendingActionActions.deletePendingActionById(filteredServerObj.originalId);

      return editEventSuccess(serverObj);
    }
  } else {
    // Keep server
    await dbEventActions.insertEventsIntoDatabase(filteredServerObj);
    await dbPendingActionActions.deletePendingActionById(filteredServerObj.originalId);
    return editEventSuccess(serverObj);
  }
};
// #endregion
