import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  CALDAV_PROVIDER,
  UPDATE_FUTURE_RECURRING_EVENTS,
  UPDATE_ALL_RECURRING_EVENTS,
} from '../../constants';
import { editCalDavAllRecurrenceEvents, editCalDavSingle } from './edit-caldav-event-utils';

export const editSingleEvent = async payload => {
  // Immediate editing of events from reflux is done within the corresponding methods under the switch statement

  // Based off which provider, we will have different edit functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return editCalDavSingle(payload);
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
  // #region Display available info immediately via flux store
  // recurrence pattern has to be parsed before being displayed
  const toBeEditedEvents = {
    summary: payload.title,
    allDay: payload.allDay,
    location: payload.location,
    organizer: payload.organizer,
    attendee: JSON.stringify(payload.attendee),
  };
  // In order to show immediate edit on calendar
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      Actions.updateIcloudCalendarData(
        payload.reccuringEventId,
        toBeEditedEvents,
        UPDATE_ALL_RECURRING_EVENTS
      );
      break;
    default:
      console.log('Not supposed to reach here');
      break;
  }
  // #endregion

  // Based off which provider, we will have different edit functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return editCalDavAllRecurrenceEvents(payload);
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
  // #region Display available info immediately via flux store
  // recurrence pattern has to be parsed before being displayed
  const [data] = CalendarPluginStore.getIcloudCalendarData().filter(
    event => event.id === payload.id
  );
  // no event found
  if (data === undefined) {
    console.log('error');
    return;
  }
  const recurToBeEditedDatetime = { iCalUID: data.iCalUID, datetime: data.start.dateTime };
  const toBeEditedEvents = {
    summary: payload.title,
    allDay: payload.allDay,
    location: payload.location,
    organizer: payload.organizer,
    attendee: JSON.stringify(payload.attendee),
  };
  // In order to show immediate edit on calendar
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      Actions.updateIcloudCalendarData(
        payload.reccuringEventId,
        toBeEditedEvents,
        UPDATE_FUTURE_RECURRING_EVENTS,
        recurToBeEditedDatetime
      );
      break;
    default:
      console.log('Not supposed to reach here');
      break;
  }
  // #endregion

  // Based off which provider, we will have different delete functions.
  switch (payload.providerType) {
    case CALDAV_PROVIDER:
      try {
        return editFutureReccurenceEvent(payload);
      } catch (caldavError) {
        console.log('Handle Caldav pending action here', caldavError);
      }
      break;
    default:
      console.log(`Edit future feature for ${payload.providerType} not handled`);
      break;
  }
};
