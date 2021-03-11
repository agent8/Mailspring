import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  CALDAV_PROVIDER,
  ALL_RECURRING_EVENTS,
  SINGLE_EVENT,
  FUTURE_RECCURRING_EVENTS,
} from '../../constants';

export const editSingleEvent = async payload => {
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
    attendee: JSON.stringify(payload.attendee),
  });
  // #endregion

  // Based off which provider, we will have different edit functions.
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
    user: Providers.filterUsersIntoSchema(user),
  };
};

export const editAllReccurenceEvent = async payload => {
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
    attendee: JSON.stringify(payload.attendee),
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
    user: Providers.filterUsersIntoSchema(user),
  };
};

export const editFutureReccurenceEvent = async payload => {
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
    attendee: JSON.stringify(payload.attendee),
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
    user: Providers.filterUsersIntoSchema(user),
  };
};
