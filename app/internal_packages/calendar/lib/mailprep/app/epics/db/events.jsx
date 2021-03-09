import { map, mergeMap, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import { from } from 'rxjs';
import uuidv4 from 'uuid';
import moment from 'moment';

import {
  RETRIEVE_STORED_EVENTS,
  BEGIN_STORE_EVENTS,
  updateStoredEvents,
  successStoringEvents,
  failStoringEvents,
  beginStoringEvents
} from '../../actions/db/events';
import {
  POST_EVENT_SUCCESS,
  GET_EVENTS_SUCCESS,
  DELETE_EVENT_BEGIN,
  DELETE_RECURRENCE_SERIES_BEGIN,
  DELETE_FUTURE_RECURRENCE_SERIES_BEGIN,
  EDIT_EVENT_BEGIN,
  EDIT_RECURRENCE_SERIES_BEGIN,
  EDIT_FUTURE_RECURRENCE_SERIES_BEGIN
} from '../../actions/events';
import {
  deleteCalDavSingleEventBegin,
  deleteCalDavAllEventBegin,
  deleteCalDavFutureEventBegin,
  editCalDavSingleEventBegin,
  editCalDavAllEventBegin,
  editCalDavFutureEventBegin
} from '../../actions/providers/caldav';
import {
  editGoogleSingleEventBegin,
  deleteGoogleSingleEventBegin,
  editGoogleAllEventBegin
} from '../../actions/providers/google';
import {
  deleteEwsSingleEventBegin,
  deleteEwsAllEventBegin,
  deleteEwsFutureEventBegin,
  editEwsSingleEventBegin,
  editEwsAllEventBegin,
  editEwsFutureEventBegin
} from '../../actions/providers/exchange';

import { deleteGoogleEvent, loadClient } from '../../utils/client/google';
import * as Providers from '../../utils/constants';
import * as parser from '../../utils/parser';
import * as IcalStringBuilder from '../../utils/icalStringBuilder';
import serverUrls from '../../utils/serverUrls';
import credentials from '../../utils/credentials';

import * as dbEventActions from '../../sequelizeDB/operations/events';
import * as dbUserActions from '../../sequelizeDB/operations/accounts';
import * as dbRpActions from '../../sequelizeDB/operations/recurrencepatterns';
import * as dbPendingActionActions from '../../sequelizeDB/operations/pendingactions';

import EventBlock from '../../sequelizeDB/schemas/events';

const dav = require('dav');

export const retrieveEventsEpic = (action$) =>
  action$.pipe(
    ofType(RETRIEVE_STORED_EVENTS),
    mergeMap((action) =>
      from(EventBlock.findAll()).pipe(
        map((events) =>
          events.filter(
            (singleEvent) => singleEvent.providerType === action.payload.user.providerType
          )
        ),
        map((events) =>
          events.map((singleEvent) => ({
            id: singleEvent.id,
            end: singleEvent.end,
            start: singleEvent.start,
            summary: singleEvent.summary,
            colorId: singleEvent.colorId,
            organizer: singleEvent.organizer,
            recurrence: singleEvent.recurrence,
            iCalUID: singleEvent.iCalUID,
            iCALString: singleEvent.iCALString,
            attendee: singleEvent.attendee,
            originalId: singleEvent.originalId,
            owner: singleEvent.owner,
            hide: singleEvent.hide,
            isRecurring: singleEvent.isRecurring,
            isModifiedThenDeleted: singleEvent.isModifiedThenDeleted,
            calendarId: singleEvent.calendarId,
            providerType: singleEvent.providerType,
            isMaster: singleEvent.isMaster,
            caldavType: singleEvent.caldavType,
            isAllDay: singleEvent.allDay
          }))
        ),
        map((results) => updateStoredEvents(results, action.payload.user))
      )
    )
  );

export const storeEventsEpic = (action$) =>
  action$.pipe(
    ofType(BEGIN_STORE_EVENTS),
    mergeMap((action) =>
      from(storeEvents(action.payload)).pipe(
        map((results) =>
          successStoringEvents(results, action.payload.users, action.payload.tempEvents)
        ),
        catchError((error) => failStoringEvents(error))
      )
    )
  );

export const beginStoreEventsEpic = (action$) =>
  action$.pipe(
    ofType(POST_EVENT_SUCCESS, GET_EVENTS_SUCCESS),
    map((action) => beginStoringEvents(action.payload))
  );

export const deleteSingleEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_EVENT_BEGIN),
    mergeMap((action) => from(deleteSingleEvent(action.payload)).pipe(map((resp) => resp)))
  );

export const deleteAllRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_RECURRENCE_SERIES_BEGIN),
    mergeMap((action) => from(deleteAllReccurenceEvent(action.payload)).pipe(map((resp) => resp)))
  );

export const deleteFutureRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_FUTURE_RECURRENCE_SERIES_BEGIN),
    mergeMap((action) =>
      from(deleteFutureReccurenceEvent(action.payload)).pipe(map((resp) => resp))
    )
  );

export const editSingleEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_EVENT_BEGIN),
    mergeMap((action) => from(editSingleEvent(action.payload)).pipe(map((resp) => resp)))
  );

export const editAllRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_RECURRENCE_SERIES_BEGIN),
    mergeMap((action) => from(editAllReccurenceEvent(action.payload)).pipe(map((resp) => resp)))
  );

export const editFutureRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_FUTURE_RECURRENCE_SERIES_BEGIN),
    mergeMap((action) => from(editFutureReccurenceEvent(action.payload)).pipe(map((resp) => resp)))
  );

const storeEvents = async (payload) => {
  const { data, users, tempEvents } = payload;
  const debug = false;

  const allPromises = [];

  if (data.length !== users.length) {
    console.log('something is wrong');
    return [];
  }

  try {
    for (let i = 0; i < data.length; i += 1) {
      for (let j = 0; j < data[i].length; j += 1) {
        const newEvent = Providers.filterIntoSchema(
          data[i][j],
          users[i].providerType,
          users[i].email,
          false
        );
        allPromises.push(dbEventActions.insertEventsIntoDatabase(newEvent));
      }
    }
  } catch (e) {
    console.log(e);
    debugger;
  }
  const insertResults = await Promise.all(allPromises);
  return insertResults;
};

const deleteSingleEvent = async (id) => {
  const debug = false;

  // In order to show immediate action
  // We hide the thing first by updating the database
  // And await if there are any possible deletion errors
  await dbEventActions.hideEventById(id);

  // #region Getting information
  // Get Information
  const data = await dbEventActions.getOneEventById(id);
  const user = await dbUserActions.findAccount(data.providerType, data.owner);
  if (debug) {
    console.log(data, user);
  }
  // #endregion
  // debugger;

  // Edge case, means user created an event offline, and is yet to upload it to service.
  // In that case, we shuld remove it from pending action if it exists.
  if (data.local === true) {
    await dbPendingActionActions.deletePendingActionById(data.originalId);
    await dbEventActions.deleteEventById(id);

    return {
      providerType: data.providerType,
      user: Providers.filterUsersIntoSchema(user)
    };
  }

  // if it is a recurring event, I need to add it into the ExDates, which is located in our RP database.
  if (data.isRecurring) {
    switch (data.providerType) {
      case Providers.GOOGLE:
        console.log(data.providerType, ' not handling adding of exDates for recurring pattern');
        break;
      case Providers.OUTLOOK:
        console.log(data.providerType, ' not handling adding of exDates for recurring pattern');
        break;
      case Providers.EXCHANGE:
        await dbRpActions.addExDateByiCalUID(data.iCalUID, data.start.dateTime);
        break;
      case Providers.CALDAV:
        await dbRpActions.addExDateByOid(data.iCalUID, data.start.dateTime);
        break;
      default:
        console.log(
          'Unhandled provider: ',
          data.providerType,
          ' for adding of exDates for recurring pattern'
        );
        break;
    }
  }

  // Set up the payload for the providers to handle.
  const payload = {
    data: data.toJSON(),
    user: user.toJSON()
  };

  // Based off which provider, we will have different delete functions.
  switch (data.providerType) {
    case Providers.GOOGLE:
      try {
        return deleteGoogleSingleEventBegin(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    case Providers.OUTLOOK:
      try {
        console.log('Outlook, To-Do delete feature');
      } catch (outlookError) {
        console.log('Handle Outlook pending action here', outlookError);
      }
      break;
    case Providers.EXCHANGE:
      // Try catch for HTTP errors, offline etc.
      try {
        return deleteEwsSingleEventBegin(payload);
      } catch (exchangeError) {
        // Delete doc is meant for both offline and online actions.
        // This means item has been deleted on server, maybe by another user
        // Handle this differently.
        if (exchangeError.ErrorCode === 249) {
          // Just remove it from database instead, and break;
          await dbEventActions.deleteEventById(data.id);
          break;
        }

        // Upsert it to the pending action, let pending action automatically handle it.
        await dbPendingActionActions.insertPendingActionIntoDatabase({
          uniqueId: uuidv4(),
          eventId: data.originalId,
          status: 'pending',
          type: 'delete'
        });
        await dbEventActions.updateEventById(data.id, {
          hide: true,
          local: true
        });
      }
      break;
    case Providers.CALDAV:
      try {
        return deleteCalDavSingleEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: data.providerType,
    user: Providers.filterUsersIntoSchema(user)
  };
};

const deleteAllReccurenceEvent = async (id) => {
  const debug = false;

  // #region Getting information
  // Get Information
  const data = await dbEventActions.getOneEventById(id);

  // In order to show immediate action
  // We hide the thing first by updating the database
  // And await if there are any possible deletion errors
  await dbEventActions.hideEventByRecurringId(data.recurringEventId);

  const user = await dbUserActions.findAccount(data.providerType, data.owner);
  if (debug) {
    console.log(data, user);
  }
  // #endregion

  // Edge case, means user created an event offline, and is yet to upload it to service.
  // In that case, we shuld remove it from pending action if it exists.
  if (data.local === true) {
    await dbPendingActionActions.deletePendingActionById(data.originalId);
    await dbEventActions.deleteEventById(data.id);

    return {
      providerType: data.providerType,
      user: Providers.filterUsersIntoSchema(user)
    };
  }

  // As we are deleting a series, we need to delete the recurrence pattern from db to ensure our database does not blow up accordingly.
  if (data.isRecurring) {
    switch (data.providerType) {
      case Providers.GOOGLE:
        console.log(data.providerType, ' not handling deleting of recurring pattern');
        break;
      case Providers.OUTLOOK:
        console.log(data.providerType, ' not handling deleting of recurring pattern');
        break;
      case Providers.EXCHANGE:
        if (debug) {
          const allRP = await dbRpActions.getAllRp();
          console.log(allRP.map((e) => e.toJSON()));
        }
        dbRpActions.deleteRpByiCalUID(data.iCalUID);

        if (debug) {
          const newRp = await dbRpActions.getAllRp();
          console.log(newRp.map((e) => e.toJSON()));
        }
        break;
      case Providers.CALDAV:
        // Duplicate now, I just wanna get it working
        if (debug) {
          const allRP = await dbRpActions.getAllRp();
          console.log(allRP.map((e) => e.toJSON()));
        }
        dbRpActions.deleteRpByiCalUID(data.iCalUID);

        if (debug) {
          // const newRp = await db.recurrencepatterns.find().exec();
          const newRp = await dbRpActions.getAllRp();
          console.log(newRp.map((e) => e.toJSON()));
        }
        break;
      default:
        console.log('Unhandled provider: ', data.providerType, ' for deleting recurring pattern');
        break;
    }
  }

  // Set up the payload for the providers to handle.
  const payload = {
    data,
    user
  };

  // Based off which provider, we will have different delete functions.
  switch (data.providerType) {
    case Providers.GOOGLE:
      await loadClient();
      const responseFromAPI = await deleteGoogleEvent(data.get('originalId'));
      // await query.remove();
      break;
    case Providers.OUTLOOK:
      console.log('Outlook, To-Do delete feature');
      break;
    case Providers.EXCHANGE:
      try {
        return deleteEwsAllEventBegin(payload);
      } catch (error) {
        console.log('THIS IS BROKEN; FOR DB STUFF');

        // This means item has been deleted on server, maybe by another user
        // Handle this differently.
        if (error.ErrorCode === 249) {
          // Just remove it from database instead, and break;
          await dbEventActions.deleteAllEventByRecurringEventId(data.recurringEventId);
          break;
        }

        // Upsert it to the pending action, let pending action automatically handle it.
        await dbPendingActionActions.insertPendingActionIntoDatabase({
          uniqueId: uuidv4(),
          eventId: data.originalId,
          status: 'pending',
          type: 'delete'
        });

        // Hide the item, and set it to local as it has been updated.
        await dbEventActions.updateEventById(data.id, {
          hide: true,
          local: true
        });
      }
      break;
    case Providers.CALDAV:
      try {
        return deleteCalDavAllEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: data.providerType,
    user: Providers.filterUsersIntoSchema(user)
  };
};

const deleteFutureReccurenceEvent = async (id) => {
  const debug = false;

  // #region Getting information
  // Get Information
  const data = await dbEventActions.getOneEventById(id);
  const user = await dbUserActions.findAccount(data.providerType, data.owner);
  if (debug) {
    console.log(data, user);
  }

  // In order to show immediate action
  // We hide all events by this and after events
  // And await if there are any possible deletion errors
  await dbEventActions.updateEventEqiCalUidGteStartDateTime(data.iCalUID, data.start.dateTime, {
    hide: true
  });
  // #endregion

  // Edge case, means user created an event offline, and is yet to upload it to service.
  // In that case, we shuld remove it from pending action if it exists.
  if (data.local === true) {
    await dbPendingActionActions.deletePendingActionById(data.originalId);

    // await query.remove();
    await dbEventActions.deleteEventById(data.id);

    return {
      providerType: data.providerType,
      user: Providers.filterUsersIntoSchema(user)
    };
  }

  // Set up the payload for the providers to handle.
  const payload = {
    data,
    user
  };

  // Based off which provider, we will have different delete functions.
  switch (data.providerType) {
    case Providers.GOOGLE:
      await loadClient();
      const responseFromAPI = await deleteGoogleEvent(data.get('originalId'));
      // await query.remove();
      break;
    case Providers.OUTLOOK:
      console.log('Outlook, To-Do delete feature');
      break;
    case Providers.EXCHANGE:
      try {
        return deleteEwsFutureEventBegin(payload);
      } catch (error) {
        console.log(error);
      }
      break;
    case Providers.CALDAV:
      try {
        return deleteCalDavFutureEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: data.providerType,
    user: Providers.filterUsersIntoSchema(user)
  };
};

const editSingleEvent = async (payload) => {
  const debug = false;

  // #region Getting/Hiding old information
  // Get Information
  const { user } = payload;
  if (debug) {
    console.log(payload, user);
  }

  // In order to show immediate action
  // We hide the thing first by updating the database
  // And await if there are any possible deletion errors
  await dbEventActions.updateEventById(payload.id, {
    summary: payload.title,
    description: payload.description,
    start: { dateTime: payload.start.unix(), timezone: payload.start.tz() },
    end: { dateTime: payload.end.unix(), timezone: payload.end.tz() },
    allDay: payload.allDay,
    location: payload.location,
    attendee: JSON.stringify(payload.attendee)
  });

  // #endregion

  // // Edge case, means user created an event offline, and is yet to upload it to service.
  // // In that case, we shuld edit it from pending action if it exists.
  // if (data.local === true) {
  //   // DO SOME EDITING OF THE DATABASE, EVERYTHING ELSE IS AUTOMATIC

  //   return {
  //     providerType: data.providerType,
  //     user: Providers.filterUsersIntoSchema(user)
  //   };
  // }

  // if it is a recurring event originally, I need to add it into the ExDates, which is located in our RP database.
  if (payload.isRecurring) {
    switch (payload.providerType) {
      case Providers.GOOGLE:
        console.log(payload.providerType, ' not handling adding of exDates for recurring pattern');
        break;
      case Providers.OUTLOOK:
        console.log(payload.providerType, ' not handling adding of exDates for recurring pattern');
        break;
      case Providers.EXCHANGE:
        await dbRpActions.addRecurrenceIdsByiCalUID(payload.iCalUID, payload.start.dateTime);
        break;
      case Providers.CALDAV:
        await dbRpActions.addRecurrenceIdsByiCalUID(payload.iCalUID, payload.start.dateTime);
        break;
      default:
        console.log(
          'Unhandled provider: ',
          payload.providerType,
          ' for adding of exDates for recurring pattern'
        );
        break;
    }
  }

  // Based off which provider, we will have different delete functions.
  switch (payload.providerType) {
    case Providers.GOOGLE:
      try {
        return editGoogleSingleEventBegin(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    case Providers.OUTLOOK:
      try {
        console.log('Outlook, To-Do edit feature');
      } catch (outlookError) {
        console.log('Handle Outlook pending action here', outlookError);
      }
      break;
    case Providers.EXCHANGE:
      // Try catch for HTTP errors, offline etc.
      try {
        return editEwsSingleEventBegin(payload);
      } catch (exchangeError) {
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
        //   eventId: payload.id,
        //   status: 'pending',
        //   type: 'update'
        // });
        // await dbEventActions.updateEventById(payload.id, {
        //   hide: true,
        //   local: true
        // });
      }
      break;
    case Providers.CALDAV:
      try {
        return editCalDavSingleEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${payload.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: payload.providerType,
    user: Providers.filterUsersIntoSchema(user)
  };
};

const editAllReccurenceEvent = async (payload) => {
  const debug = false;

  // #region Getting/Hiding old information
  // Get Information
  // const data = await dbEventActions.getOneEventById(id);

  // In order to show immediate action
  // We update all the objects with the same recurring event Id
  // And await if there are any possible editing errors
  await dbEventActions.updateEventRecurringEventId(payload.recurringEventId, {
    summary: payload.title,
    allDay: payload.allDay,
    location: payload.location,
    organizer: payload.organizer,
    attendee: JSON.stringify(payload.attendee)
  });

  const user = await dbUserActions.findAccount(payload.providerType, payload.owner);
  if (debug) {
    console.log(payload, user);
  }
  // #endregion

  // // Edge case, means user created an event offline, and is yet to upload it to service.
  // // In that case, we shuld edit it from pending action if it exists.
  // #region
  // if (data.local === true) {
  //   // DO SOME EDITING OF THE DATABASE, EVERYTHING ELSE IS AUTOMATIC

  //   return {
  //     providerType: data.providerType,
  //     user: Providers.filterUsersIntoSchema(user)
  //   };
  // }

  // // As we are editing a series, we need to edit the recurrence pattern to prevent side effects
  // if (payload.isRecurring) {
  //   switch (payload.providerType) {
  //     case Providers.GOOGLE:
  //       console.log(payload.providerType, ' not handling deleting of recurring pattern');
  //       break;
  //     case Providers.OUTLOOK:
  //       console.log(payload.providerType, ' not handling deleting of recurring pattern');
  //       break;
  //     case Providers.EXCHANGE:
  //       if (debug) {
  //         const allRP = await dbRpActions.getAllRp();
  //         console.log(allRP.map((e) => e.toJSON()));
  //       }
  //       dbRpActions.deleteRpByiCalUID(payload.iCalUID);

  //       if (debug) {
  //         const newRp = await dbRpActions.getAllRp();
  //         console.log(newRp.map((e) => e.toJSON()));
  //       }
  //       break;
  //     case Providers.CALDAV:
  //       // Duplicate now, I just wanna get it working
  //       if (debug) {
  //         const allRP = await dbRpActions.getAllRp();
  //         console.log(allRP.map((e) => e.toJSON()));
  //       }
  //       dbRpActions.deleteRpByiCalUID(payload.iCalUID);

  //       if (debug) {
  //         // const newRp = await db.recurrencepatterns.find().exec();
  //         const newRp = await dbRpActions.getAllRp();
  //         console.log(newRp.map((e) => e.toJSON()));
  //       }
  //       break;
  //     default:
  //       console.log(
  //         'Unhandled provider: ',
  //         payload.providerType,
  //         ' for deleting recurring pattern'
  //       );
  //       break;
  //   }
  // }
  // #endregion

  // Based off which provider, we will have different delete functions.
  switch (payload.providerType) {
    case Providers.GOOGLE:
      try {
        console.log('EDIT GOOGLE RECURR EVENT');
        return editGoogleAllEventBegin(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    case Providers.OUTLOOK:
      try {
        console.log('Outlook, To-Do edit all feature');
      } catch (outlookError) {
        console.log('Handle Outlook pending action here', outlookError);
      }
      break;
    case Providers.EXCHANGE:
      try {
        return editEwsAllEventBegin(payload);
      } catch (exchangeError) {
        // console.log('THIS IS BROKEN; FOR DB STUFF');
        // // This means item has been deleted on server, maybe by another user
        // // Handle this differently.
        // if (error.ErrorCode === 249) {
        //   // Just remove it from database instead, and break;
        //   await dbEventActions.deleteAllEventByRecurringEventId(data.recurringEventId);
        //   break;
        // }
        // // Upsert it to the pending action, let pending action automatically handle it.
        // await dbPendingActionActions.insertPendingActionIntoDatabase({
        //   uniqueId: uuidv4(),
        //   eventId: data.originalId,
        //   status: 'pending',
        //   type: 'delete'
        // });
        // // Hide the item, and set it to local as it has been updated.
        // await dbEventActions.updateEventById(data.id, {
        //   hide: true,
        //   local: true
        // });
      }
      break;
    case Providers.CALDAV:
      try {
        return editCalDavAllEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Edit all feature for ${payload.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: payload.providerType,
    user: Providers.filterUsersIntoSchema(user)
  };
};

const editFutureReccurenceEvent = async (payload) => {
  const debug = false;

  // #region Getting/Hiding old information
  // Get Information
  const data = await dbEventActions.getOneEventById(payload.id);
  const user = await dbUserActions.findAccount(payload.providerType, payload.owner);
  if (debug) {
    console.log(payload, user);
  }

  // In order to show immediate action
  // We hide all events by this and after events
  // And await if there are any possible deletion errors
  await dbEventActions.updateEventEqiCalUidGteStartDateTime(data.iCalUID, data.start.dateTime, {
    summary: payload.title,
    allDay: payload.allDay,
    location: payload.location,
    organizer: payload.organizer,
    attendee: JSON.stringify(payload.attendee)
  });
  // #endregion

  // // Edge case, means user created an event offline, and is yet to upload it to service.
  // // In that case, we shuld remove it from pending action if it exists.
  // if (data.local === true) {
  //   await dbPendingActionActions.deletePendingActionById(data.originalId);

  //   // await query.remove();
  //   await dbEventActions.deleteEventById(data.id);

  //   return {
  //     providerType: data.providerType,
  //     user: Providers.filterUsersIntoSchema(user)
  //   };
  // }

  // Based off which provider, we will have different delete functions.
  switch (payload.providerType) {
    case Providers.GOOGLE:
      try {
        console.log('Google, To-Do edit future feature');
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    case Providers.OUTLOOK:
      try {
        console.log('Outlook, To-Do edit future feature');
      } catch (outlookError) {
        console.log('Handle Outlook pending action here', outlookError);
      }
      break;
    case Providers.EXCHANGE:
      try {
        return editEwsFutureEventBegin(payload);
      } catch (exchangeError) {
        console.log(exchangeError);
      }
      break;
    case Providers.CALDAV:
      try {
        return editCalDavFutureEventBegin(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Edit future feature for ${payload.providerType} not handled`);
      break;
  }

  // Return which user has been edited.
  return {
    providerType: payload.providerType,
    user: Providers.filterUsersIntoSchema(user)
  };
};
