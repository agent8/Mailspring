import uuidv4 from 'uuid';
import ICAL from 'ical.js';
import {
  CALDAV_PROVIDER,
  DELETE_ALL_RECURRING_EVENTS,
  ICLOUD_URL,
  UPDATE_ALL_RECURRING_EVENTS,
  UPSERT_RECURRENCE_PATTERN,
} from '../../constants';
import * as IcalStringBuilder from '../../common-utils/ical-string-builder';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import * as PARSER from '../../common-utils/parser';
import { getEtagAndIcalstringFromIcalUID } from '../../fetch-event/utils/fetch-events-utils';
import { syncCaldavCalendar } from '../../fetch-event/utils/get-caldav-account';
const dav = require('dav');

export const createCaldavEvent = async payload => {
  const debug = false;
  console.log('payload', payload);
  // Parse user information from account layer to dav object.
  const xhrObject = new dav.transport.Basic(
    new dav.Credentials({
      username: payload.auth.username,
      password: payload.auth.password,
    })
  );

  // Final iCalString to post out
  let newiCalString = '';

  console.log('calendar url', payload.calendar.url);
  // Caldav calendar link
  const caldavUrl = payload.calendar.url;

  const newIcsUid = uuidv4();
  const { data } = payload;

  // Builds additional fields that are missing specifically for caldav.
  data.id = uuidv4();
  data.originalId = uuidv4();

  // Repopulate certain fields that are missing
  data.caldavUrl = caldavUrl + `${newIcsUid}.ics`;
  data.iCalUID = data.originalId;
  data.providerType = CALDAV_PROVIDER;
  data.caldavType = ICLOUD_URL;
  let populateReflux = [];
  if (payload.data.isRecurring) {
    const rruleObject = ICAL.Recur._stringToData(data.rrule);
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
    // Creates Recurring event.
    newiCalString = IcalStringBuilder.buildICALStringCreateRecurEvent(payload.data, rruleObject);

    // Add data to reflux store for immediate UI display
    const masterEvent = {
      isAllDay: data.isAllDay,
      attendee: JSON.stringify(data.attendee),
      caldavType: data.caldavType,
      calendarId: ICLOUD_URL + payload.calendar.calendarId.slice(1),
      caldavUrl: data.caldavUrl,
      colorId: data.colorId,
      created: Math.floor(Date.now() / 1000),
      description: data.description,
      end: { dateTime: data.end.dateTime.unix(), timezone: data.end.dateTime.tz() },
      etag: data.id,
      iCALString: newiCalString,
      iCalUID: data.iCalUID,
      id: data.id,
      isMaster: true,
      isRecurring: data.isRecurring,
      location: data.location,
      originalId: data.originalId,
      originalStartTime: {
        dateTime: data.start.dateTime.unix(),
        timezone: data.start.dateTime.tz(),
      },
      owner: payload.auth.username,
      organizer: data.organizer,
      providerType: payload.providerType,
      recurringEventId: data.iCalUID,
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
    console.log('rruleobj', rruleObject, rruleString);
    populateReflux = PARSER.parseRecurrence(recurrencePattern[0], masterEvent);
    console.log('rp', recurrencePattern[0]);
    // add new rp into store
    CalendarPluginStore.upsertRpList(recurrencePattern[0], UPSERT_RECURRENCE_PATTERN);
  } else {
    // Creates non Recurring event.
    newiCalString = IcalStringBuilder.buildICALStringCreateEvent(payload.data);

    // Add data into reflux store for immediate UI display
    const masterEvent = {
      attendee: JSON.stringify(data.attendee),
      caldavType: data.caldavType,
      calendarId: ICLOUD_URL + payload.calendar.calendarId.slice(1),
      caldavUrl: data.caldavUrl,
      colorId: data.colorId,
      created: Math.floor(Date.now() / 1000),
      description: data.description,
      end: { dateTime: data.end.dateTime.unix(), timezone: data.end.dateTime.tz() },
      etag: data.id,
      iCALString: newiCalString,
      iCalUID: data.iCalUID,
      id: data.id,
      isAllDay: data.isAllDay,
      isMaster: false,
      isRecurring: data.isRecurring,
      location: data.location,
      originalId: data.originalId,
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
  data.iCALString = newiCalString;

  const calendar = new dav.Calendar();
  calendar.url = caldavUrl;

  const addCalendarObject = {
    data: newiCalString,
    filename: `${newIcsUid}.ics`,
    xhr: xhrObject,
  };
  try {
    await dav.createCalendarObject(calendar, addCalendarObject);
    CalendarPluginStore.addCalendarData(populateReflux, CALDAV_PROVIDER);
  } catch (error) {
    console.log(error);
  }
  const foundObj = await getEtagAndIcalstringFromIcalUID(
    payload.auth.username,
    payload.auth.password,
    ICLOUD_URL,
    data.iCalUID
  );
  CalendarPluginStore.updateCalendarData(
    CALDAV_PROVIDER,
    data.iCalUID,
    { etag: foundObj.etag, iCALString: foundObj.iCalstring }, // update etag and icalstring(icalstring not rly needed)
    UPDATE_ALL_RECURRING_EVENTS
  );
  console.log('reflux', CalendarPluginStore.getCalendarData(CALDAV_PROVIDER));
};
