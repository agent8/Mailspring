import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { GOOGLE_PROVIDER, CALDAV_PROVIDER } from '../constants';
import {
  deleteCaldavSingle,
  deleteCaldavAll,
  deleteCaldavFuture,
} from './delete-caldav-event-utils';
import {
  deleteGoogleSingle,
  deleteGoogleAll,
  deleteGoogleFuture,
} from './delete-google-event-utils';

export const deleteSingleEvent = async id => {
  // #region Getting information
  // Get Information
  const [data] = CalendarPluginStore.getCalendarData().filter(event => event.id === id);
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }

  const [user] = CalendarPluginStore.getAuth().filter(
    account => account.providerType === data.providerType && account.owner === data.username
  );
  // more than 1 user found or no user found
  if (user === undefined) {
    throw 'user not found';
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
    case GOOGLE_PROVIDER:
      try {
        await deleteGoogleSingle(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
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
  const [data] = CalendarPluginStore.getCalendarData().filter(event => event.id === id);
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }

  const [user] = CalendarPluginStore.getAuth().filter(
    account => account.providerType === data.providerType && account.owner === data.username
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
        await deleteCaldavAll(payload);
      } catch (caldavError) {
        console.log('handle caldav pending action here', caldavError);
      }
      break;
    case GOOGLE_PROVIDER:
      try {
        await deleteGoogleAll(payload);
      } catch (googleError) {
        console.log('handle google pending action here', googleError);
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
  const [data] = CalendarPluginStore.getCalendarData().filter(event => event.id === id);
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }
  const [user] = CalendarPluginStore.getAuth().filter(
    account => account.providerType === data.providerType && account.owner === data.username
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
        await deleteCaldavFuture(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    case GOOGLE_PROVIDER:
      try {
        await deleteGoogleFuture(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    default:
      console.log(`Delete feature for ${data.providerType} not handled`);
      break;
  }
};
