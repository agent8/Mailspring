import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  CALDAV_PROVIDER,
  UPDATE_FUTURE_RECURRING_EVENTS,
  UPDATE_ALL_RECURRING_EVENTS,
  GOOGLE_PROVIDER,
} from '../../constants';
import { editCaldavSingle, editCaldavAll, editCaldavFuture } from './edit-caldav-event-utils';
import { editGoogleSingle, editGoogleAll, editGoogleFuture } from './edit-google-event-utils';

export const editSingleEvent = async payload => {
  // Immediate editing of events from reflux is done within the corresponding methods under the switch statement
  console.log(payload)
  // Based off which provider, we will have different edit functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return await editCaldavSingle(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    case GOOGLE_PROVIDER:
      try {
        return await editGoogleSingle(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    default:
      console.log(`Delete feature for ${payload.providerType} not handled`);
      break;
  }
};

export const editAllReccurenceEvent = async payload => {
  // Based off which provider, we will have different edit functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return await editCaldavAll(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    case GOOGLE_PROVIDER:
      try {
        return await editGoogleAll(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    default:
      console.log(`Edit all feature for ${payload.providerType} not handled`);
      break;
  }
};

export const editFutureReccurenceEvent = async payload => {
  // Based off which provider, we will have different delete functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return await editCaldavFuture(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    case GOOGLE_PROVIDER:
      try {
        return await editGoogleFuture(payload);
      } catch (googleError) {
        console.log('Handle Google pending action here', googleError);
      }
      break;
    default:
      console.log(`Edit future feature for ${payload.providerType} not handled`);
      break;
  }
};
