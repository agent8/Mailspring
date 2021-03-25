import ICAL from 'ical.js';
import moment from 'moment-timezone';
import * as icalTookKit from 'ical-toolkit';
import { DELETE_EDITED_EVENT, DELETE_NON_EDITED_EVENT } from '../constants';

export const buildRruleObject = recurrencePattern => {
  // debugger;
  let returnObj;
  if (recurrencePattern.numberOfRepeats > 0) {
    returnObj = {
      freq: recurrencePattern.freq,
      interval: recurrencePattern.interval,
      count: recurrencePattern.numberOfRepeats,
    };
  } else if (recurrencePattern.until !== '') {
    const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const datetime = moment.tz(recurrencePattern.until * 1000, 'UTC');
    const dtTimezone = new ICAL.Time(
      {
        year: datetime.year(),
        month: datetime.month() + 1,
        day: datetime.date(),
        hour: datetime.hour(),
        minute: datetime.minute(),
        second: datetime.second(),
      },
      new ICAL.Timezone({ tzid })
    );

    returnObj = {
      freq: recurrencePattern.freq,
      interval: recurrencePattern.interval,
      until: dtTimezone,
    };
  } else {
    returnObj = {
      freq: recurrencePattern.freq,
      interval: recurrencePattern.interval,
    };
  }
  let byDay = null;
  // To prevent monthly/yearly recurence from turning into weekly occurence, byDay variable is needed to control
  //   the expansion
  if (recurrencePattern.byWeekDay !== '()' && recurrencePattern.byWeekNo !== '()') {
    byDay = recurrencePattern.byWeekNo.slice(1, -1) + recurrencePattern.byWeekDay.slice(1, -1);
  } else if (recurrencePattern.byWeekDay !== '()') {
    byDay = recurrencePattern.byWeekDay.slice(1, -1);
  }
  if (byDay === null) {
    console.log('returnObj', returnObj);
    return returnObj;
  } else {
    Object.assign(returnObj, {
      byday: [byDay],
    });
    console.log('returnObj', returnObj);
    return returnObj;
  }
};
export const buildICALStringDeleteEditedSingleEvent = (exdate, iCALString) => {
  // Add exdate to the iCalString built with the buildICALStringDeleteRecurEvent function
  const calendarData = ICAL.parse(iCALString);
  const vcalendar = new ICAL.Component(calendarData);
  const vevents = vcalendar.getAllSubcomponents('vevent');
  const masterEvent = vevents.filter(comp => comp.hasProperty('rrule'))[0];
  const allEditedEvent = vevents.filter(e => e.getFirstPropertyValue('recurrence-id') !== null);

  masterEvent.addPropertyWithValue('exdate', exdate);
  vcalendar.removeAllSubcomponents('vevent');
  vcalendar.addSubcomponent(masterEvent);
  // Add back the remaining events
  allEditedEvent.forEach(vevt => {
    vcalendar.addSubcomponent(vevt);
  });
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
  masterEvent.getAllProperties('exdate').forEach(e => e.setParameter('tzid', tzid));
  return updateIcalString(vcalendar.toString());
};

export const buildICALStringDeleteRecurEvent = (recurrencePattern, eventObject, iCalStringJson) => {
  // Build the Dav Calendar Object from the iCalString
  const calendarData = ICAL.parse(eventObject.iCALString);

  // Get the master event, as they are in order, and remove the ExDates.
  // ExDates are from the recurrence pattern.
  const vcalendar = new ICAL.Component(calendarData);
  const vevents = vcalendar.getAllSubcomponents('vevent');
  const masterEvent = vevents.filter(comp => comp.hasProperty('rrule'))[0];
  const [vTimezone] = vcalendar.getAllSubcomponents('vtimezone');
  let exdateToReturn = undefined;
  vcalendar.removeSubcomponent('vtimezone');
  masterEvent.removeAllProperties('exdate');

  // Check if eventObject is an edited event
  const nonMasterVevents = vevents.filter(comp => !comp.hasProperty('rrule'));
  const [foundVevent] = nonMasterVevents.filter(vevt => {
    if (
      vevt
        .getFirstPropertyValue('dtstart')
        .toJSDate()
        .getTime() /
        1000 ===
      eventObject.start.dateTime
    ) {
      return vevt;
    }
  });

  // Based off the ExDates, set the new master event accordingly.
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
  recurrencePattern.exDates.split(',').forEach(date => {
    if (date === '') {
      return;
    }
    const datetime = moment.tz(date * 1000, tzid);
    const timezone = new ICAL.Time().fromData(
      {
        year: datetime.year(),
        month: datetime.month() + 1,
        day: datetime.date(),
        hour: datetime.hour(),
        minute: datetime.minute(),
        second: datetime.second(),
      },
      new ICAL.Timezone({ tzid })
    );
    masterEvent.addPropertyWithValue('exdate', timezone);
  });

  let rrule;
  let allEditedEvent = [];

  if (foundVevent !== undefined && iCalStringJson !== undefined) {
    // deleting a single edited event - parameter iCalStringJson isn't undefined

    // event that is going to be deleted has been edited before, follow algo:
    // delete foundVevent that represents the edited event
    // add foundvevent's recurrenceIds to mainVevent's exdate

    // all edited events that are not foundVevent
    allEditedEvent = vevents.filter(
      evt => evt !== foundVevent && evt.getFirstPropertyValue('recurrence-id') !== null
    );
    // add foundVevent's recurrenceIds into mainVevent's exdate
    const foundVeventRecurIds = foundVevent
      .getFirstPropertyValue('recurrence-id')
      .toJSDate()
      .getTime();
    const datetime = moment.tz(foundVeventRecurIds, tzid);
    const toBeDeleted = new ICAL.Time().fromData(
      {
        year: datetime.year(),
        month: datetime.month() + 1,
        day: datetime.date(),
        hour: datetime.hour(),
        minute: datetime.minute(),
        second: datetime.second(),
      },
      new ICAL.Timezone({ tzid })
    );
    exdateToReturn = toBeDeleted;
    // masterEvent.addPropertyWithValue('exdate', toBeDeleted);
    // Build the new recurrence pattern off the database which is updated.
    rrule = new ICAL.Recur(iCalStringJson);
  } else {
    // delete single event via inserting exdate into master vevent or deleting future via changing UNTIL rrule

    // Get all the Edited event to work on later.
    allEditedEvent = vevents.filter(e => e.getFirstPropertyValue('recurrence-id') !== null);

    // temporary, need to settle data flow for delete this and future events
    if (iCalStringJson !== undefined) {
      // delete one event in recurrence
      const datetime = moment.tz(eventObject.start.dateTime * 1000, tzid);
      const toBeDeleted = new ICAL.Time().fromData(
        {
          year: datetime.year(),
          month: datetime.month() + 1,
          day: datetime.date(),
          hour: datetime.hour(),
          minute: datetime.minute(),
          second: datetime.second(),
        },
        new ICAL.Timezone({ tzid })
      );
      // Build the new recurrence pattern off the database which is updated.
      masterEvent.addPropertyWithValue('exdate', toBeDeleted);
      rrule = new ICAL.Recur(iCalStringJson);
    } else {
      // delete future events in recurrence

      // Build the new recurrence pattern off the database which is updated.
      rrule = new ICAL.Recur(buildRruleObject(recurrencePattern));
    }
  }
  masterEvent.updatePropertyWithValue('rrule', rrule);
  // Ensure the proper Timezone ID.
  masterEvent.getAllProperties('exdate').forEach(e => e.setParameter('tzid', tzid));

  // This removes all the edited event and the master, and add the new master.
  vcalendar.removeAllSubcomponents('vevent');
  vcalendar.addSubcomponent(masterEvent);

  // Add back the remaining events
  allEditedEvent.forEach(vevt => {
    vcalendar.addSubcomponent(vevt);
  });
  vcalendar.addSubcomponent(vTimezone);
  console.log(updateIcalString(vcalendar.toString()));
  return [updateIcalString(vcalendar.toString()), exdateToReturn];
};

export const buildICALStringUpdateRecurEvent = (recurrencePattern, eventObject, updatedObject) => {
  // debugger;
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(eventObject.iCALString);
  const vcalendar = new ICAL.Component(calendarData);
  // Remove Timezone data as there might be duplicates.
  const tzid = eventObject.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);
  const [vTimezone] = vcalendar.getAllSubcomponents('vtimezone');
  vcalendar.removeSubcomponent('vtimezone');

  // parse updated/original datetime to ICAL format
  const updatedStartDatetime = ICAL.Time.fromJSDate(new Date(updatedObject.start.toDate()), false);
  const originalStartDatetimeInMoment = moment.tz(eventObject.start.dateTime * 1000, tzid);
  const originalStartDatetime = ICAL.Time.fromJSDate(
    new Date(originalStartDatetimeInMoment.toDate()),
    false
  );
  const updatedEndDatetime = ICAL.Time.fromJSDate(new Date(updatedObject.end.toDate()), false);
  const updatedDuration = updatedEndDatetime.subtractDate(updatedStartDatetime);
  // get all the non master vevents
  const notMainVevents = vcalendar
    .getAllSubcomponents('vevent')
    .filter(comp => !comp.hasProperty('rrule'));

  // check if any of the vevents' dtstart == eventObject's dtstart
  // If there is, means the original single event has been edited before, just have to update the vevent found
  // Note that we exclude master event during the search
  const [foundVevent] = notMainVevents.filter(comp => {
    const dtstart = comp.getFirstPropertyValue('dtstart');
    let dtstartMoment = moment(dtstart.toUnixTime() * 1000);
    dtstartMoment = dtstartMoment.tz('GMT').tz(tzid, true);
    return dtstartMoment.unix() === eventObject.start.dateTime;
  });
  if (foundVevent !== undefined) {
    // Update foundVevent since the single event has been edited before

    const remainingVevents = vcalendar.getAllSubcomponents('vevent').filter(comp => {
      return (
        comp.getFirstPropertyValue('dtstart').toUnixTime() !== eventObject.start.dateTime ||
        comp.hasProperty('rrule')
      );
    });

    // DateTime start/end of the selected event, set the Timezone ID properly.
    foundVevent.updatePropertyWithValue('dtstart', updatedStartDatetime);
    foundVevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

    // Temp set the duration to all an hour, Will change in the future. (TO-DO)
    foundVevent.updatePropertyWithValue('duration', updatedDuration);

    // The other fields.
    foundVevent.updatePropertyWithValue('sequence', 0);
    foundVevent.updatePropertyWithValue('created', ICAL.Time.now());
    foundVevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());

    foundVevent.updatePropertyWithValue('priority', 0);

    // Currently, only updating the title. (TO-DO)
    foundVevent.updatePropertyWithValue('summary', updatedObject.title);
    foundVevent.updatePropertyWithValue('description', updatedObject.description);
    foundVevent.updatePropertyWithValue('location', updatedObject.location);

    // The other fields.
    foundVevent.updatePropertyWithValue('status', 'CONFIRMED');
    foundVevent.updatePropertyWithValue('transp', 'OPAQUE');
    foundVevent.updatePropertyWithValue('class', 'PUBLIC');
    vcalendar.removeAllSubcomponents('vevent');
    remainingVevents.forEach(vevt => {
      vcalendar.addSubcomponent(vevt);
    });
    vcalendar.addSubcomponent(foundVevent);
  } else {
    // Create new vevent for the newly edited event

    // New event structure, and parse it into a component.
    const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
    const jcalData = ICAL.parse(iCalendarData);
    const vevent = new ICAL.Component(jcalData);

    if (updatedObject.allDay) {
      updatedStartDatetime.isDate = true;
    } else {
      updatedStartDatetime.isDate = false;
    }

    vevent.updatePropertyWithValue('recurrence-id', originalStartDatetime);
    vevent.getFirstProperty('recurrence-id').setParameter('tzid', tzid);

    // UID ensures the connection to the Recurring Master
    vevent.updatePropertyWithValue('uid', eventObject.iCalUID);

    // DateTime start/end of the selected event, set the Timezone ID properly.
    vevent.updatePropertyWithValue('dtstart', updatedStartDatetime);
    vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

    // Temp set the duration to all an hour, Will change in the future. (TO-DO)
    vevent.updatePropertyWithValue('duration', updatedDuration);
    console.log('vevent duration', vevent.getFirstPropertyValue('duration'));
    // The other fields.
    vevent.updatePropertyWithValue('sequence', 0);
    vevent.updatePropertyWithValue('created', ICAL.Time.now());
    vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());

    vevent.updatePropertyWithValue('priority', 0);

    // Currently, only updating the title. (TO-DO)
    vevent.updatePropertyWithValue('summary', updatedObject.title);
    vevent.updatePropertyWithValue('description', updatedObject.description);
    vevent.updatePropertyWithValue('location', updatedObject.location);

    // The other fields.
    vevent.updatePropertyWithValue('status', 'CONFIRMED');
    vevent.updatePropertyWithValue('transp', 'OPAQUE');
    vevent.updatePropertyWithValue('class', 'PUBLIC');

    // Add the new edited event
    vcalendar.addSubcomponent(vevent);
  }
  vcalendar.addSubcomponent(vTimezone);
  console.log('vcalendar', vcalendar);
  return updateIcalString(vcalendar.toString());
};

export const buildICALStringUpdateSingleAndAllEvent = (
  updatedEvent,
  calendarObject,
  rruleObj = undefined
) => {
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(calendarObject.iCALString);
  const calendarComp = new ICAL.Component(calendarData);
  // const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // const calObject = await dbCalendarActions.retrieveCalendarByOwnerId();

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = calendarComp.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = calendarObject.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);

  calendarComp.removeSubcomponent('vtimezone');

  // Remove the previous master event, as we are building a new one.
  calendarComp.removeSubcomponent('vevent');

  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  const startDateTime = ICAL.Time.fromJSDate(new Date(updatedEvent.start.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(updatedEvent.end.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (updatedEvent.allDay) {
    startDateTime.isDate = true;
  } else {
    startDateTime.isDate = false;
  }

  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', calendarObject.iCalUID);

  // DateTime start/end of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', startDateTime);
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', duration.toString());

  // The other fields.
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  vevent.updatePropertyWithValue('summary', updatedEvent.title);
  vevent.updatePropertyWithValue('description', updatedEvent.description);

  // Add new rrule if present
  if (rruleObj) {
    const rrule = new ICAL.Recur(rruleObj);
    vevent.updatePropertyWithValue('rrule', rrule);
  }

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');
  vevent.updatePropertyWithValue('location', updatedEvent.location);
  const organizerProperty = vevent.updatePropertyWithValue('organizer', updatedEvent.organizer);
  organizerProperty.setParameter('email', updatedEvent.organizer);

  Object.keys(updatedEvent.attendee).forEach(key => {
    const attendee = updatedEvent.attendee[key];
    const email = attendee['email'];
    const partstat = attendee['partstat'];

    const attendeeProperty = vevent.addPropertyWithValue('attendee', `mailto:${email}`);
    attendeeProperty.setParameter('email', email);
    attendeeProperty.setParameter('cutype', 'INDIVIDUAL');
    attendeeProperty.setParameter('partstat', partstat);
    if (email === updatedEvent.organizer) {
      attendeeProperty.setParameter('role', 'CHAIR');
    }
  });

  // Add the new master, and the timezone after that.
  // vevent.removeProperty('rrule');
  calendarComp.addSubcomponent(vevent);
  calendarComp.addSubcomponent(timezoneMetadata);

  // debugger;
  return updateIcalString(calendarComp.toString());
};

export const buildICALStringUpdateAllRecurEvent = (
  recurrencePattern,
  eventObject,
  updatedObject
) => {
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(eventObject.iCALString);
  const vcalendar = new ICAL.Component(calendarData);

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = vcalendar.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = eventObject.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);
  vcalendar.removeSubcomponent('vtimezone');

  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  // Updating whole series, so just find the recurring master, and update that.
  const recurringMaster = vcalendar
    .getAllSubcomponents('vevent')
    .filter(e => e.getFirstPropertyValue('recurrence-id') === null)[0];

  const startDateTime = ICAL.Time.fromJSDate(new Date(updatedObject.start.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(updatedObject.end.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (updatedObject.allDay) {
    // eslint-disable-next-line no-underscore-dangle
    recurringMaster.getFirstPropertyValue('dtstart')._time.isDate = true;
  } else {
    // eslint-disable-next-line no-underscore-dangle
    recurringMaster.getFirstPropertyValue('dtstart')._time.isDate = false;
  }
  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', eventObject.iCalUID);

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', recurringMaster.getFirstPropertyValue('dtstart'));
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', duration.toString());

  // The other fields.
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  vevent.updatePropertyWithValue('summary', updatedObject.title);
  vevent.updatePropertyWithValue('description', updatedObject.description);
  // Update the rule based off the recurrence pattern.
  const rrule = new ICAL.Recur(recurrencePattern);
  recurrencePattern.iCALString = rrule.toString();
  vevent.updatePropertyWithValue('rrule', rrule);

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');
  vevent.updatePropertyWithValue('location', updatedObject.location);
  vevent.updatePropertyWithValue('organizer', updatedObject.organizer);

  Object.keys(updatedObject.attendee).forEach(key => {
    const attendee = updatedObject.attendee[key];
    const email = attendee['email'];
    const partstat = attendee['partstat'];

    const attendeeProperty = vevent.addPropertyWithValue('attendee', `mailto:${email}`);
    attendeeProperty.setParameter('email', email);
    attendeeProperty.setParameter('cutype', 'INDIVIDUAL');
    attendeeProperty.setParameter('partstat', partstat);
    if (email === updatedObject.organizer) {
      attendeeProperty.setParameter('role', 'CHAIR');
    }
  });

  // Remove the recurring maaster, add the new master, and the timezone after that.
  vcalendar.removeSubcomponent(recurringMaster);
  vcalendar.addSubcomponent(vevent);
  vcalendar.addSubcomponent(timezoneMetadata);
  return updateIcalString(vcalendar.toString());
};

export const buildICALStringUpdateFutureRecurMasterEvent = (
  recurrencePattern,
  eventObject,
  updatedObject
) => {
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(eventObject.iCALString);
  const vcalendar = new ICAL.Component(calendarData);

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = vcalendar.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = eventObject.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);
  vcalendar.removeSubcomponent('vtimezone');

  // #region Updating Old Object, with all the previous values & new recurrence
  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  // As we are dealing with future events, get all events,
  // Filter them to master and non recurring master.
  const allVEvents = vcalendar.getAllSubcomponents('vevent');
  const recurringMaster = allVEvents.filter(
    e => e.getFirstPropertyValue('recurrence-id') === null
  )[0];
  const nonRecurringEvents = allVEvents.filter(
    e => e.getFirstPropertyValue('recurrence-id') !== null
  );

  // Used to append the edited events after the recurrence master.
  // Order matters. If you move the order, something will break.
  const recurringChildren = [];

  // Result used for debugging.
  // Idea is to remove the edited events that are the selected event or the following events.
  const result = nonRecurringEvents.map(e2 => {
    const nonMasterVEventTime = moment(e2.getFirstPropertyValue('recurrence-id').toJSDate());
    if (
      nonMasterVEventTime.isSameOrAfter(moment.tz(eventObject.start.dateTime * 1000, tzid), 'day')
    ) {
      vcalendar.removeSubcomponent(e2);
      return 'deleted';
    }
    recurringChildren.push(e2);
    return 'ignored';
  });

  // Same as previous chunk, but for deleted events now.
  recurringMaster.getAllProperties('exdate').forEach(e => {
    const exDateMoment = moment(e.getValues()[0].toJSDate());
    if (
      exDateMoment.isSameOrAfter(
        moment.tz(eventObject.start.dateTime * 1000, eventObject.start.timezone)
      )
    ) {
      recurringMaster.removeProperty(e);
    }
  });

  // Remove them first, add them back later.
  recurringChildren.forEach(e => vcalendar.removeSubcomponent(e));

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
  const startDateTime = ICAL.Time.fromJSDate(new Date(eventObject.start.dateTime), false);

  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', eventObject.iCalUID);

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', recurringMaster.getFirstPropertyValue('dtstart'));
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', 'PT1H');

  // The other fields.
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  // Update all the events based of the recurring master property,
  // as only the future events are changed.
  vevent.updatePropertyWithValue('summary', recurringMaster.getFirstPropertyValue('summary'));
  vevent.updatePropertyWithValue(
    'description',
    recurringMaster.getFirstPropertyValue('description')
  );

  // Update the rule based off the recurrence pattern.
  const rrule = new ICAL.Recur(buildRruleObject(recurrencePattern));
  recurrencePattern.iCALString = rrule.toString();
  vevent.updatePropertyWithValue('rrule', rrule);

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');
  vevent.updatePropertyWithValue('location', recurringMaster.getFirstPropertyValue('location'));
  const organizerProperty = vevent.updatePropertyWithValue('organizer', eventObject.organizer);
  organizerProperty.setParameter('email', eventObject.organizer);

  recurringMaster.getAllProperties('attendee').forEach(attendee => {
    const attendeeProperty = vevent.addPropertyWithValue(
      'attendee',
      `mailto:${attendee.getParameter('email')}`
    );

    attendeeProperty.setParameter('email', attendee.getParameter('email'));
    attendeeProperty.setParameter('cutype', 'INDIVIDUAL');
    attendeeProperty.setParameter('partstat', attendee.getParameter('partstat'));
    if (attendee.getParameter('email') === eventObject.organizer) {
      attendeeProperty.setParameter('role', 'CHAIR');
    }
  });
  // #endregion

  // Remove the recurring maaster, add the new master,
  // edited events still within range and the timezone after that.
  vcalendar.removeSubcomponent(recurringMaster);
  vcalendar.addSubcomponent(vevent);
  recurringChildren.forEach(e => vcalendar.addSubcomponent(e));
  vcalendar.addSubcomponent(timezoneMetadata);
  return updateIcalString(vcalendar.toString());
};

export const buildICALStringUpdateFutureRecurCreateEvent = (
  recurrencePattern,
  eventObject,
  updatedObject
) => {
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(eventObject.iCALString);
  const vcalendar = new ICAL.Component(calendarData);

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = vcalendar.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = eventObject.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);
  vcalendar.removeSubcomponent('vtimezone');

  // #region Updating Old Object, with all the previous values & new recurrence
  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  // As we are dealing with future events, get all events,
  // Filter them to master and non recurring master.
  const allVEvents = vcalendar.getAllSubcomponents('vevent');
  const recurringMaster = allVEvents.filter(
    e => e.getFirstPropertyValue('recurrence-id') === null
  )[0];
  const nonRecurringEvents = allVEvents.filter(
    e => e.getFirstPropertyValue('recurrence-id') !== null
  );

  // Used to append the edited events after the recurrence master.
  // Order matters. If you move the order, something will break.
  const recurringChildren = [];

  // The goal here is to remove any edited events from the calendar string based off the
  // recurrence id as the time of the event.
  // It checks it based off the recurrence pattern parsed in.
  // It then deletes it if it is before the selected event.
  // or if it is the same, it will edit it to details from the updated ui.
  // In the future, if the behavior of updating this and future events change, for e.g.
  // If it becomes let it automatically expand the events and not take the events from the parents,
  // Then, come here, and edit this code to not delete or edit but just remove all child elements.
  // Caldav will automatically handle the expansion.
  const startDt = moment.tz(eventObject.start.dateTime * 1000, eventObject.start.timezone);
  nonRecurringEvents.forEach(e => {
    const nonMasterVEventTime = moment(e.getFirstPropertyValue('recurrence-id').toJSDate());
    let toDelete = false;
    let isSame = false;
    if (nonMasterVEventTime.isBefore(startDt)) {
      toDelete = true;
    } else if (nonMasterVEventTime.isSame(startDt)) {
      isSame = true;
    }

    if (toDelete || isSame) {
      vcalendar.removeSubcomponent(e);
    } else {
      e.updatePropertyWithValue('uid', recurrencePattern.originalId);
      recurringChildren.push(e);
    }
  });

  // Remove them first, add them back later.
  recurringChildren.forEach(e => vcalendar.removeSubcomponent(e));

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
  const startDateTime = ICAL.Time.fromJSDate(new Date(updatedObject.start.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(updatedObject.end.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (updatedObject.allDay) {
    startDateTime.isDate = true;
  }

  // temp method to parse day of week until front end UI is updated
  let byWeekDay = '';
  if (updatedObject.secondOption[1].length === 0) {
    byWeekDay = updatedObject.byWeekDay.slice(1, 3);
  } else {
    byWeekDay = [];
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    updatedObject.secondOption[1].forEach((value, index) => {
      if (value === 1) {
        byWeekDay.push(days[index]);
      }
    });
  }

  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from recurrence pattern, to build the bond between them.
  vevent.updatePropertyWithValue('uid', recurrencePattern.originalId);

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', startDateTime);
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);
  // vevent.updatePropertyWithValue('dtend', endDateTime);
  // vevent.getFirstProperty('dtend').setParameter('tzid', tzid);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', duration);

  // The other fields.
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  // Update all the events based of the new event property.
  vevent.updatePropertyWithValue('summary', updatedObject.title);
  const organizerProperty = vevent.updatePropertyWithValue(
    'organizer',
    `mailto:${updatedObject.organizer}`
  );
  vevent.updatePropertyWithValue('description', updatedObject.description);

  // Update the rule based off the recurrence pattern.
  const rrule = new ICAL.Recur(recurrencePattern.rrule);
  recurrencePattern.iCALString = rrule.toString();
  vevent.updatePropertyWithValue('rrule', rrule);

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');
  vevent.updatePropertyWithValue('location', updatedObject.location);

  Object.keys(updatedObject.attendee).forEach(key => {
    const attendee = updatedObject.attendee[key];
    const email = attendee['email'];
    const partstat = attendee['partstat'];

    const attendeeProperty = vevent.addPropertyWithValue('attendee', `mailto:${email}`);
    attendeeProperty.setParameter('email', email);
    attendeeProperty.setParameter('cutype', 'INDIVIDUAL');
    attendeeProperty.setParameter('partstat', partstat);
    if (email === updatedObject.organizer) {
      attendeeProperty.setParameter('role', 'CHAIR');
    }
  });

  // Based off the ExDates, set the new event accordingly.
  recurrencePattern.exDates.split(',').forEach(date => {
    const exDatetime = moment.tz(date * 1000, tzid);
    const timezone = new ICAL.Time().fromData(
      {
        year: exDatetime.year(),
        month: exDatetime.month() + 1,
        day: exDatetime.date(),
        hour: exDatetime.hour(),
        minute: exDatetime.minute(),
        second: exDatetime.second(),
      },
      new ICAL.Timezone({ tzid })
    );
    vevent.addPropertyWithValue('exdate', timezone);
  });
  // Ensure the proper Timezone ID.
  vevent.getAllProperties('exdate').forEach(e => e.setParameter('tzid', tzid));
  // #endregion

  // Remove the recurring maaster, add the new master,
  // edited events still within range and the timezone after that.
  vcalendar.removeSubcomponent(recurringMaster);
  vcalendar.addSubcomponent(vevent);
  recurringChildren.forEach(e => vcalendar.addSubcomponent(e));
  vcalendar.addSubcomponent(timezoneMetadata);
  return updateIcalString(vcalendar.toString());
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
  return updateIcalString(vcalendar.toString());
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
  return updateIcalString(vcalendar.toString());
};

export const editICALStringRecurringToSingle = (updatedData, masterEventData) => {
  // stub
  const vcalendar = new ICAL.Component(ICAL.parse(masterEventData.iCALString));

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = calendarComp.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = masterEventData.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);

  vcalendar.removeSubcomponent('vtimezone');

  // Remove the previous event, as we are building a new one.
  vcalendar.removeSubcomponent('vevent');

  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  // Start/End time of reduced event is the same as master event (ie collapsing all events back to master).
  const startDateTime = ICAL.Time.fromJSDate(new Date(updatedData.start.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(updatedData.end.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (updatedData.allDay) {
    startDateTime.isDate = true;
  } else {
    startDateTime.isDate = false;
  }

  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', masterEventData.iCalUID);

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
  vevent.updatePropertyWithValue('summary', updatedData.title);
  vevent.updatePropertyWithValue('description', updatedData.description);

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');

  vevent.removeProperty('rrule');

  vcalendar.addSubcomponent(vevent);
  vcalendar.addSubcomponent(timezoneMetadata);

  // debugger;
  return updateIcalString(vcalendar.toString());
};

// append a Z at the end of the RRule, might have better way to do this
const updateIcalString = iCalString => {
  let originalUNTILrrule = iCalString.match(
    /UNTIL=\d{4}(0[1-9]|1[0-2])(0[1-9]|[1-2]\d|3[0-1])T([0-1]\d|2[0-3])[0-5]\d[0-5]\dZ?/g
  );
  // second expression short circuits if res isn't null
  if (
    originalUNTILrrule === null ||
    originalUNTILrrule[0][originalUNTILrrule[0].length - 1] === 'Z'
  ) {
    return iCalString;
  } else if (originalUNTILrrule[0][originalUNTILrrule[0].length - 1] !== 'Z') {
    let updatedUNTILrrule = originalUNTILrrule + 'Z';
    let updatedICalString = iCalString.replace(originalUNTILrrule, updatedUNTILrrule);
    return updatedICalString;
  }
  return iCalString;
};
