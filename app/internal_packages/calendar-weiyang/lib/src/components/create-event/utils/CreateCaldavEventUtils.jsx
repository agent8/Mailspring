import uuidv4 from 'uuid';
import ICAL from 'ical.js';
import { CALDAV_PROVIDER } from '../../constants';
import * as icalTookKit from 'ical-toolkit';
const dav = require('dav');

export const createCaldavEvent = async payload => {
  const debug = false;

  // Parse user information from account layer to dav object.
  const xhrObject = new dav.transport.Basic(
    new dav.Credentials({
      username: payload.auth.username,
      password: payload.auth.password,
    })
  );

  // Final iCalString to post out
  let newiCalString = '';

  // Caldav calendar link
  const caldavUrl = payload.calendar.url;

  const newETag = uuidv4();
  const { data } = payload;

  // Builds additional fields that are missing specifically for caldav.
  data.id = uuidv4();
  data.originalId = uuidv4();

  // Repopulate certain fields that are missing
  data.caldavUrl = caldavUrl;
  data.iCalUID = data.originalId;
  data.providerType = CALDAV_PROVIDER;
  data.caldavType = payload.auth.caldavType;

  if (payload.data.isRecurring) {
    // eslint-disable-next-line no-underscore-dangle
    const jsonRecurr = ICAL.Recur._stringToData(data.rrule);
    // debugger;

    if (jsonRecurr.until !== undefined) {
      jsonRecurr.until.adjust(1, 0, 0, 0, 0);
    }
    const { freq } = jsonRecurr;
    if (freq === 'MONTHLY') {
      // If there is a setpos, I need ot merge them up into one param
      // RRule gen splits them into bysetpos and byday, but server takes in byday
      // E.g. bysetpos = 1, byday = TU, merge to byday = 1TU
      // If there is no setpos, it means it is a by month day event
      if (jsonRecurr.BYSETPOS !== undefined) {
        jsonRecurr.BYDAY = jsonRecurr.BYSETPOS + jsonRecurr.BYDAY;
        delete jsonRecurr.BYSETPOS;
      } else if (Array.isArray(jsonRecurr.BYDAY)) {
        jsonRecurr.BYDAY = jsonRecurr.BYDAY.join(',');
      }
    }
    // Creates Recurring event.
    newiCalString = buildICALStringCreateRecurEvent(payload.data, jsonRecurr);
  } else {
    data.isRecurring = false;

    // Creates non Recurring event.
    newiCalString = buildICALStringCreateEvent(payload.data);
  }
  data.iCALString = newiCalString;

  const calendar = new dav.Calendar();
  calendar.url = caldavUrl;

  const addCalendarObject = {
    data: newiCalString,
    filename: `${newETag}.ics`,
    xhr: xhrObject,
  };

  const addResult = await dav.createCalendarObject(calendar, addCalendarObject);

  if (debug) {
    console.log('(postEventsCalDav)', addResult);
  }
};

export const buildICALStringCreateRecurEvent = (eventObject, rpObject) => {
  const builder = icalTookKit.createIcsFileBuilder();
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
  builder.calname = eventObject.summary;

  // THIS IS IMPORTANT, PLZ READ
  // In order to respect the user created location, we need to get their local tzid
  // This WILL affect recurrence pattern expansion in ways its hard to explain
  builder.tzid = tzid;
  const icsCalendarContent = builder.toString();

  const vcalendar = new ICAL.Component(ICAL.parse(icsCalendarContent));

  // Create new event structure, and parse it into a component.
  const jcalData = ICAL.parse(new ICAL.Event().toString());
  const vevent = new ICAL.Component(jcalData);

  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', eventObject.originalId);

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
  const startDateTime = ICAL.Time.fromJSDate(new Date(eventObject.start.dateTime.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(eventObject.end.dateTime.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (eventObject.allDay) {
    startDateTime.isDate = true;
  }

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', startDateTime);
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', duration.toString());

  // The other fields.
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  // Update all the events based of the new event property.
  vevent.updatePropertyWithValue('summary', eventObject.summary);
  vevent.updatePropertyWithValue('description', eventObject.description);

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');
  vevent.updatePropertyWithValue('location', eventObject.location);
  const organizerProperty = vevent.updatePropertyWithValue(
    'organizer',
    `mailto:${eventObject.organizer}`
  );
  organizerProperty.setParameter('email', eventObject.organizer);

  Object.keys(eventObject.attendee).forEach(key => {
    const attendee = eventObject.attendee[key];
    const email = attendee['email'];
    const partstat = attendee['partstat'];

    const attendeeProperty = vevent.addPropertyWithValue('attendee', `mailto:${email}`);
    attendeeProperty.setParameter('email', email);
    attendeeProperty.setParameter('cutype', 'INDIVIDUAL');
    attendeeProperty.setParameter('partstat', partstat);
    if (email === eventObject.organizer) {
      attendeeProperty.setParameter('role', 'CHAIR');
    }
  });

  const rrule = new ICAL.Recur(rpObject);
  vevent.updatePropertyWithValue('rrule', rrule);
  vcalendar.addSubcomponent(vevent);
  return vcalendar.toString();
};
export const buildICALStringCreateEvent = eventObject => {
  // debugger;
  const builder = icalTookKit.createIcsFileBuilder();
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
  builder.calname = eventObject.summary;

  // THIS IS IMPORTANT, PLZ READ
  // In order to respect the user created location, we need to get their local tzid
  // This WILL affect recurrence pattern expansion in ways its hard to explain
  builder.tzid = tzid;

  // Try to build
  const icsCalendarContent = builder.toString();
  const vcalendar = new ICAL.Component(ICAL.parse(icsCalendarContent));

  // Create new event structure, and parse it into a component.
  const jcalData = ICAL.parse(new ICAL.Event().toString());
  const vevent = new ICAL.Component(jcalData);

  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', eventObject.originalId);

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
  const startDateTime = ICAL.Time.fromJSDate(new Date(eventObject.start.dateTime.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(eventObject.end.dateTime.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (eventObject.allDay) {
    startDateTime.isDate = true;
  }

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', startDateTime);
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  vevent.updatePropertyWithValue('dtstart', startDateTime);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', duration.toString());

  // The other fields.
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  // Update all the events based of the new event property.
  vevent.updatePropertyWithValue('summary', eventObject.summary);
  vevent.updatePropertyWithValue('description', eventObject.description);

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');
  const organizerProperty = vevent.updatePropertyWithValue(
    'organizer',
    `mailto:${eventObject.organizer}`
  );
  organizerProperty.setParameter('email', eventObject.organizer);

  Object.keys(eventObject.attendee).forEach(key => {
    const attendee = eventObject.attendee[key];
    const email = attendee['email'];
    const partstat = attendee['partstat'];

    const attendeeProperty = vevent.addPropertyWithValue('attendee', `mailto:${email}`);
    attendeeProperty.setParameter('email', email);
    attendeeProperty.setParameter('cutype', 'INDIVIDUAL');
    attendeeProperty.setParameter('partstat', partstat);
    if (email === eventObject.organizer) {
      attendeeProperty.setParameter('role', 'CHAIR');
    }
  });

  vevent.updatePropertyWithValue('location', eventObject.location);
  vcalendar.addSubcomponent(vevent);
  return vcalendar.toString();
};
