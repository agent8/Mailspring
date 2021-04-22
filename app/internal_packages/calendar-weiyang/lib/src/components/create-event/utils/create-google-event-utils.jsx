import { fetchGmailAccount } from '../../fetch-event/utils/get-caldav-account';
import { Actions, AccountStore } from 'mailspring-exports';
import uuidv4 from 'uuid';
import ICAL from 'ical.js';
import * as PARSER from '../../common-utils/parser';
import { GOOGLE_PROVIDER } from '../../constants';

export const createGoogleEvent = async payload => {
  const { data, auth, calendar } = payload;
  // account to be used to fetch gmail account once production client id is ready to be used
  const [account] = AccountStore.accounts().filter(
    account => account.emailAddress == auth.username
  );
  const services = await fetchGmailAccount(account);
  let event = {};

  // Recurrence parsing START
  const rruleObject = ICAL.Recur._stringToData(data.rrule);
  // adjust day
  if (rruleObject.until !== undefined) {
    rruleObject.until.adjust(1, 0, 0, 0, 0);
  }
  const { freq } = rruleObject;
  if (freq === 'MONTHLY') {
    // If there is a setpos, I need to merge them up into one param
    // RRule gen splits them into bysetpos and byday, but server takes in byday
    // E.g. bysetpos = 1, byday = TU, merge to byday = 1TU
    // If there is no setpos, it means it is a by month day event
    if (rruleObject.BYSETPOS !== undefined) {
      rruleObject.BYDAY = rruleObject.BYSETPOS + rruleObject.BYDAY;
      delete rruleObject.BYSETPOS;
    } else if (Array.isArray(rruleObject.BYDAY)) {
      rruleObject.BYDAY = rruleObject.BYDAY.join(',');
    }
  }
  const rruleString = ICAL.Recur.fromData(rruleObject).toString();
  // Recurrence parsing END

  const allDayOrNotObjStart = data.isAllDay
    ? { date: data.start.dateTime.format(), timeZone: data.start.dateTime.tz() }
    : { dateTime: data.start.dateTime.format(), timeZone: data.start.dateTime.tz() };
  const allDayOrNotObjEnd = data.isAllDay
    ? { date: data.end.dateTime.format(), timeZone: data.end.dateTime.tz() }
    : { dateTime: data.end.dateTime.format(), timeZone: data.end.dateTime.tz() };
  event = {
    id: uuidv4().replace(/-/g, ''),
    summary: data.summary,
    location: data.location,
    description: data.description,
    start: allDayOrNotObjStart,
    end: allDayOrNotObjEnd,
    ...(data.isRecurring && { recurrence: ['RRULE:' + rruleString] }),
    // 'attendees': [
    //     {'email': 'lpage@example.com'},
    //     {'email': 'sbrin@example.com'},
    //   ],
    reminders: {
      useDefault: false,
      overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 10 }],
    },
  };
  console.log(event);
  services.events.insert(
    {
      calendarId: calendar.calendarId,
      resource: event,
    },
    (err, event) => {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      console.log('Event created:', event);
    }
  );
  let populateReflux;
  if (data.isRecurring) {
    const tempRecurringId = uuidv4();
    // Add data to reflux store for immediate UI display
    const masterEvent = {
      isAllDay: data.isAllDay,
      attendee: JSON.stringify(data.attendee),
      caldavType: '',
      calendarId: calendar.calendarId,
      caldavUrl: '',
      colorId: data.colorId,
      created: Math.floor(Date.now() / 1000),
      description: data.description,
      end: { dateTime: data.end.dateTime.unix(), timezone: data.end.dateTime.tz() },
      etag: '',
      iCALString: 'RRULE:' + data.rrule,
      iCalUID: tempRecurringId,
      id: event.id,
      isMaster: true,
      isRecurring: data.isRecurring,
      location: data.location,
      originalId: tempRecurringId,
      originalStartTime: {
        dateTime: data.start.dateTime.unix(),
        timezone: data.start.dateTime.tz(),
      },
      owner: auth.username,
      organizer: data.organizer,
      providerType: payload.providerType,
      recurringEventId: tempRecurringId,
      start: { dateTime: data.start.dateTime.unix(), timezone: data.start.dateTime.tz() },
      summary: data.summary,
      updated: 0,
    };
    let untilJson;
    if (rruleObject.until !== undefined) {
      untilJson = rruleObject.until.toJSON();
      untilJson.month -= 1; // Month needs to minus one due to start date
    }
    const recurrencePattern = PARSER.parseRecurrenceEvents([
      {
        eventData: masterEvent,
        recurData: {
          rrule: {
            stringFormat: rruleString,
            freq: rruleObject.freq,
            interval: rruleObject.interval !== undefined ? rruleObject.interval : 1,
            until: untilJson,
            count: rruleObject.count,
          },
          exDates: [],
          recurrenceIds: [],
          modifiedThenDeleted: false,
          iCALString: rruleString,
        },
      },
    ]);
    populateReflux = PARSER.parseRecurrence(recurrencePattern[0], masterEvent, GOOGLE_PROVIDER);
  } else {
    // Add data into reflux store for immediate UI display
    const masterEvent = {
      attendee: JSON.stringify(data.attendee),
      caldavType: '',
      calendarId: calendar.calendarId,
      caldavUrl: '',
      colorId: data.colorId,
      created: Math.floor(Date.now() / 1000),
      description: data.description,
      end: { dateTime: data.end.dateTime.unix(), timezone: data.end.dateTime.tz() },
      etag: data.id,
      iCALString: '',
      iCalUID: event.id,
      id: event.id,
      isAllDay: data.isAllDay,
      isMaster: false,
      isRecurring: data.isRecurring,
      location: data.location,
      originalId: event.id,
      originalStartTime: {
        dateTime: data.start.dateTime.unix(),
        timezone: data.start.dateTime.tz(),
      },
      owner: payload.auth.username,
      organizer: data.organizer,
      providerType: payload.providerType,
      start: { dateTime: data.start.dateTime.unix(), timezone: data.start.dateTime.tz() },
      summary: data.summary,
      updated: 0,
    };
    populateReflux = [masterEvent];
  }
  console.log('populateReflux', populateReflux);
  Actions.addCalendarData(populateReflux, GOOGLE_PROVIDER);
};
