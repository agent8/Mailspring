import WyCalendarStore from '../../../../../../src/flux/stores/wycalendar-store.es6';
import Actions from '../../../../../../src/flux/actions.es6';
import {
  CALDAV_PROVIDER,
  ALL_RECURRING_EVENTS,
  SINGLE_EVENT,
  FUTURE_RECCURRING_EVENTS,
} from '../constants';
import { deleteCaldavSingle, deleteCaldavAll, deleteCaldavFuture } from './DeleteCaldavEventUtils';
export const deleteSingleEvent = async id => {
  const debug = false;
  // #region Getting information
  // Get Information
  const [data] = WyCalendarStore.getIcloudCalendarData().filter(event => event.id === id);
  console.log('my data', data);
  // more than 1 event from 1 id or no event found
  if (data === undefined) {
    console.log('error');
    return;
  }
  // In order to show immediate deletion on calendar
  switch (data.providerType) {
    case CALDAV_PROVIDER:
      Actions.deleteIcloudCalendarData(id, SINGLE_EVENT);
      break;
    default:
      console.log('Not supposed to reach here');
      break;
  }
  const [user] = WyCalendarStore.getIcloudAuth().filter(
    icloudAccount =>
      icloudAccount.providerType === data.providerType && icloudAccount.owner === data.username
  );
  // more than 1 user found or no user found
  if (user === undefined) {
    console.log('error');
    return;
  }

  // Set up the payload for the providers to handle.
  const payload = {
    data,
    user,
  };

  // Based off which provider, we will have different delete functions.
  switch (data.providerType) {
    case CALDAV_PROVIDER:
      try {
        await deleteCaldavSingle(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }
};

export const deleteAllEvents = async id => {
  const debug = false;

  // #region Getting information
  // Get Information
  const [data] = WyCalendarStore.getIcloudCalendarData().filter(event => event.id === id);
  // more than 1 event from 1 id or no event found
  if (data === undefined) {
    console.log('error');
    return;
  }

  // In order to show immediate deletion on calendar
  switch (data.providerType) {
    case CALDAV_PROVIDER:
      Actions.deleteIcloudCalendarData(data.recurringEventId, ALL_RECURRING_EVENTS);
      break;
    default:
      console.log('Not supposed to reach here');
      break;
  }
  const [user] = WyCalendarStore.getIcloudAuth().filter(
    icloudAccount =>
      icloudAccount.providerType === data.providerType && icloudAccount.owner === data.username
  );
  // more than 1 user found or no user found
  if (user === undefined) {
    console.log('error');
    return;
  }

  if (debug) {
    console.log(data, user);
  }
  // #endregion

  // Set up the payload for the providers to handle.
  const payload = {
    data,
    user,
  };

  // Based off which provider, we will have different delete functions.
  switch (data.providerType) {
    case CALDAV_PROVIDER:
      try {
        deleteCaldavAll(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }
};
export const deleteFutureEvents = async id => {
  const debug = false;

  // #region Getting information
  // Get Information
  const [data] = WyCalendarStore.getIcloudCalendarData().filter(event => event.id === id);
  // more than 1 event from 1 id or no event found
  if (data === undefined) {
    console.log('error');
    return;
  }
  const [user] = WyCalendarStore.getIcloudAuth().filter(
    icloudAccount =>
      icloudAccount.providerType === data.providerType && icloudAccount.owner === data.username
  );
  // more than 1 user found or no user found
  if (user === undefined) {
    console.log('error');
    return;
  }

  // In order to show immediate deletion
  switch (data.providerType) {
    case CALDAV_PROVIDER:
      Actions.deleteIcloudCalendarData(data.iCalUID, FUTURE_RECCURRING_EVENTS, data.start.dateTime);
      break;
    default:
      console.log('Not supposed to reach here');
      break;
  }
  // #endregion

  // Set up the payload for the providers to handle.
  const payload = {
    data,
    user,
  };

  // Based off which provider, we will have different delete functions.
  switch (data.providerType) {
    case CALDAV_PROVIDER:
      try {
        deleteCaldavFuture(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }
};
