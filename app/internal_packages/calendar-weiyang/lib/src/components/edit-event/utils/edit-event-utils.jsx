import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  CALDAV_PROVIDER,
  UPDATE_FUTURE_RECURRING_EVENTS,
  UPDATE_ALL_RECURRING_EVENTS,
} from '../../constants';
import { editCaldavSingle, editCaldavAll, editCaldavFuture } from './edit-caldav-event-utils';

export const editSingleEvent = async payload => {
  // Immediate editing of events from reflux is done within the corresponding methods under the switch statement

  // Based off which provider, we will have different edit functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return editCaldavSingle(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
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
        return editCaldavAll(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
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
        return editCaldavFuture(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Edit future feature for ${payload.providerType} not handled`);
      break;
  }
};
