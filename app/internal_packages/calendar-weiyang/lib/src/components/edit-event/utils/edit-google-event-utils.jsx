import { Actions, AccountStore, CalendarPluginStore } from 'mailspring-exports';
import {
  DELETE_ALL_RECURRING_EVENTS,
  DELETE_FUTURE_RECCURRING_EVENTS,
  GOOGLE_PROVIDER,
  UPDATE_SINGLE_EVENT,
} from '../../constants';
import { fetchGmailAccount } from '../../fetch-event/utils/get-caldav-account';
import ICAL from 'ical.js';
import moment from 'moment-timezone';
import * as PARSER from '../../common-utils/parser';
import { deleteGoogleAll, deleteGoogleFuture } from '../../delete-event/delete-google-event-utils';
import { createGoogleEvent } from '../../create-event/utils/create-google-event-utils';

export const editGoogleSingle = async payload => {
  const { user } = payload;
  const [data] = CalendarPluginStore.getCalendarData(GOOGLE_PROVIDER).filter(
    event => event.id === payload.id
  );
  if (data === undefined) {
    throw 'cannot find event id in database';
  }
  // account to be used to fetch gmail account once production client id is ready to be used
  const [account] = AccountStore.accounts().filter(
    account => account.emailAddress == user.username && account.provider === 'gmail'
  );
  const services = await fetchGmailAccount(account);
  const result = new Promise((resolve, reject) => {
    // MAX RESULTS IS 2500 events fetched, TODO: use pageToken to get all events
    services.events.list(
      {
        calendarId: data.calendarId,
        iCalUID: data.iCalUID,
        singleEvents: true,
        maxResults: 2500,
      },
      (err, res) => {
        if (err) reject(err);
        console.log(res);
        const [instance] = res.data.items.filter(event => event.id === data.id);
        if (instance === undefined) {
          reject('Unable to find event from server while editing single event');
        }
        resolve(instance);
      }
    );
  });
  result
    .then(instance => {
      const updatedRruleObj = ICAL.Recur._stringToData(payload.updatedRrule);
      const { freq } = updatedRruleObj;
      if (freq === 'MONTHLY') {
        // If there is a setpos, I need to merge them up into one param
        // RRule gen splits them into bysetpos and byday, but server takes in byday
        // E.g. bysetpos = 1, byday = TU, merge to byday = 1TU
        // If there is no setpos, it means it is a by month day event
        if (updatedRruleObj.BYSETPOS !== undefined) {
          updatedRruleObj.BYDAY = updatedRruleObj.BYSETPOS + updatedRruleObj.BYDAY;
          delete updatedRruleObj.BYSETPOS;
        } else if (Array.isArray(updatedRruleObj.BYDAY)) {
          updatedRruleObj.BYDAY = updatedRruleObj.BYDAY.join(',');
        }
      }
      const updatedRruleString = ICAL.Recur.fromData(updatedRruleObj).toString();
      instance = {
        ...instance,
        summary: payload.title,
        description: payload.description,
        start: payload.isAllDay
          ? { date: payload.start.format(), timeZone: payload.start.tz() }
          : { dateTime: payload.start.format(), timeZone: payload.start.tz() },
        end: payload.isAllDay
          ? { date: payload.end.format(), timeZone: payload.end.tz() }
          : { dateTime: payload.end.format(), timeZone: payload.end.tz() },
        location: payload.location,
        attendee: payload.attendee,
        ...(payload.updatedIsRecurring && { recurrence: ['RRULE:' + updatedRruleString] }),
      };
      let expandedRecurEvents = [];
      let refluxUpdateObj = {};
      if (!payload.isRecurring && payload.updatedIsRecurring) {
        // edited event becomes single -> recurring
        const masterEvent = data; // data = event object retrieved from db
        masterEvent.isRecurring = 1;
        masterEvent.isMaster = 1;
        masterEvent.iCALString = 'RRULE:' + updatedRruleString;
        masterEvent.isAllDay = payload.isAllDay;
        masterEvent.attendee = JSON.stringify(payload.attendee);
        masterEvent.description = payload.description;
        masterEvent.end = {
          dateTime: payload.end.unix(),
          timezone: payload.end.tz(),
        };
        masterEvent.start = {
          dateTime: payload.start.unix(),
          timezone: payload.start.tz(),
        };
        masterEvent.location = payload.location;
        masterEvent.summary = payload.title;
        let untilJson;
        if (updatedRruleObj.until !== undefined) {
          untilJson = updatedRruleObj.until.toJSON();
          untilJson.month -= 1; // Month needs to minus one due to start date
        }
        const recurrencePattern = PARSER.parseRecurrenceEvents([
          {
            eventData: masterEvent,
            recurData: {
              rrule: {
                stringFormat: updatedRruleString,
                freq: updatedRruleObj.freq,
                interval: updatedRruleObj.interval !== undefined ? updatedRruleObj.interval : 1,
                until: moment.tz(untilJson, 'UTC').unix() * 1000,
                count: updatedRruleObj.count,
              },
              exDates: [],
              recurrenceIds: [],
              modifiedThenDeleted: false,
              iCALString: updatedRruleString,
            },
          },
        ]);
        expandedRecurEvents = PARSER.parseRecurrence(
          recurrencePattern[0],
          masterEvent,
          GOOGLE_PROVIDER
        );
      } else {
        // edited event becomes from recurring -> single/single -> single/recurring -> recurring
        refluxUpdateObj = {
          summary: payload.title,
          description: payload.description,
          start: { dateTime: payload.start.unix(), timezone: payload.start.tz() },
          end: { dateTime: payload.end.unix(), timezone: payload.end.tz() },
          isAllDay: payload.isAllDay,
          location: payload.location,
          attendee: JSON.stringify(payload.attendee),
        };
      }
      services.events.update(
        {
          calendarId: data.calendarId,
          eventId: data.id,
          requestBody: instance,
        },
        (err, res) => {
          if (err) return err;
          if (!payload.isRecurring && payload.updatedIsRecurring) {
            // add all expanded events into reflux and remove any existing similar icaluid from reflux store
            Actions.deleteCalendarData(
              GOOGLE_PROVIDER,
              expandedRecurEvents[0].iCalUID,
              DELETE_ALL_RECURRING_EVENTS
            );
            console.log(expandedRecurEvents[0].recurringEventId);
            Actions.addCalendarData(expandedRecurEvents, GOOGLE_PROVIDER);
          } else {
            Actions.updateCalendarData(
              GOOGLE_PROVIDER,
              data.id,
              refluxUpdateObj,
              UPDATE_SINGLE_EVENT
            );
          }
        }
      );
    })
    .catch(err => {
      throw err;
    });
};

export const editGoogleAll = async payload => {
  // 1) delete original event/s
  // 2) create new recurring event from updated rrule
  const { user } = payload;
  const [data] = CalendarPluginStore.getCalendarData(GOOGLE_PROVIDER).filter(
    event => event.id === payload.id
  );
  if (data === undefined) {
    throw 'cannot find event id in database';
  }
  try {
    const deleteAllPayload = {
      data,
      user,
    };
    await deleteGoogleAll(deleteAllPayload);
  } catch (error) {
    throw ('delete failed while editing all recurrence', error);
  }
  try {
    const [selectedCalendar] = CalendarPluginStore.getCalendarLists(GOOGLE_PROVIDER).filter(
      calendar => calendar.calendarId === data.calendarId
    );
    const createFutureEventData = {
      summary: payload.title,
      description: payload.description,
      start: {
        dateTime: payload.start,
        timezone: payload.tzid,
      },
      end: {
        dateTime: payload.end,
        timezone: payload.tzid,
      },
      isRecurring: payload.isRecurring,
      rrule: payload.updatedRrule,
      isAllDay: payload.isAllDay,
      colorId: data.colorId,
      location: payload.location,
      attendee: payload.attendee,
      organizer: payload.organizer,
      calendarId: data.calendarId,
    };
    const createAllEventPayload = {
      data: createFutureEventData,
      providerType: payload.providerType,
      auth: user,
      calendar: selectedCalendar,
    };
    await createGoogleEvent(createAllEventPayload);
  } catch (error) {
    throw ('error creating new recurrence while editing all event', error);
  }
};

export const editGoogleFuture = async payload => {
  // 1) delete future events by limiting UNTIL of original calendar object
  // 2) create new recurring event with updated RRule
  // the newly created events are no longer in the same recurrence series
  const [data] = CalendarPluginStore.getCalendarData(GOOGLE_PROVIDER).filter(
    event => event.id === payload.id
  );
  // no event found
  if (data === undefined) {
    throw 'unable to find event from database';
  }
  const { user } = payload;
  try {
    const deleteFuturePayload = {
      data,
      user,
    };
    await deleteGoogleFuture(deleteFuturePayload);
    Actions.deleteCalendarData(
      GOOGLE_PROVIDER,
      data.recurringEventId,
      DELETE_FUTURE_RECCURRING_EVENTS,
      data.start.dateTime
    );
  } catch (error) {
    throw ('delete failed while editing future recurrence', error);
  }

  try {
    const [selectedCalendar] = CalendarPluginStore.getCalendarLists(GOOGLE_PROVIDER).filter(
      calendar => calendar.calendarId === data.calendarId
    );
    const createFutureEventData = {
      summary: payload.title,
      description: payload.description,
      start: {
        dateTime: payload.start,
        timezone: payload.tzid,
      },
      end: {
        dateTime: payload.end,
        timezone: payload.tzid,
      },
      isRecurring: payload.isRecurring,
      rrule: payload.rrule,
      isAllDay: payload.isAllDay,
      colorId: data.colorId,
      location: payload.location,
      attendee: payload.attendee,
      organizer: payload.organizer,
      calendarId: data.calendarId,
    };
    const createFutureEventPayload = {
      data: createFutureEventData,
      providerType: payload.providerType,
      auth: user,
      calendar: selectedCalendar,
    };
    await createGoogleEvent(createFutureEventPayload);
  } catch (error) {
    throw ('error creating new recurrence while editing future', error);
  };
};
