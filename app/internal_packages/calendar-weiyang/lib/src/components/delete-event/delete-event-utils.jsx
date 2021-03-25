import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  CALDAV_PROVIDER,
  DELETE_ALL_RECURRING_EVENTS,
  DELETE_SINGLE_EVENT,
  DELETE_FUTURE_RECCURRING_EVENTS,
  GET_ALL_EVENT,
} from '../constants';
import {
  deleteCaldavSingle,
  deleteCaldavAll,
  deleteCaldavFuture,
} from './delete-caldav-event-utils';
export const deleteSingleEvent = async id => {
  // #region Getting information
  // Get Information
  const [data] = CalendarPluginStore.getIcloudCalendarData().filter(event => event.id === id);
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }

  const [user] = CalendarPluginStore.getIcloudAuth().filter(
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
  // #region Getting information
  // Get Information
  const [data] = CalendarPluginStore.getIcloudCalendarData().filter(event => event.id === id);
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }

  const [user] = CalendarPluginStore.getIcloudAuth().filter(
    icloudAccount =>
      icloudAccount.providerType === data.providerType && icloudAccount.owner === data.username
  );
  // more than 1 user found or no user found
  if (user === undefined) {
    console.log('error');
    return;
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
  // #region Getting information
  // Get Information
  const [data] = CalendarPluginStore.getIcloudCalendarData().filter(event => event.id === id);
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }
  const [user] = CalendarPluginStore.getIcloudAuth().filter(
    icloudAccount =>
      icloudAccount.providerType === data.providerType && icloudAccount.owner === data.username
  );
  // more than 1 user found or no user found
  if (user === undefined) {
    console.log('error');
    return;
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
