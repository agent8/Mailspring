import ICAL from 'ical.js';
import moment from 'moment-timezone';
import * as icalTookKit from 'ical-toolkit';

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

export const buildICALStringDeleteRecurEvent = (recurrencePattern, eventObject, iCalStringJson) => {
  // Build the Dav Calendar Object from the iCalString
  const calendarData = ICAL.parse(eventObject.iCALString);
  const vcalendar = new ICAL.Component(calendarData);
  // Get the master event, as they are in order, and remove the ExDates.
  // ExDates are from the recurrence pattern.
  // const vevents = cloneDeep(vcalendar.getAllSubcomponents('vevent'));
  const vevents = vcalendar.getAllSubcomponents('vevent');
  const vevent = vevents.filter(comp => comp.hasProperty('rrule'))[0];
  vevent.removeAllProperties('exdate');

  // Get all the Edited event to work on later.
  const allEditedEvent = vcalendar
    .getAllSubcomponents('vevent')
    .filter(e => e.getFirstPropertyValue('recurrence-id') !== null);

  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Based off the ExDates, set the new event accordingly.
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
    vevent.addPropertyWithValue('exdate', timezone);
  });

  // Build the new recurrence pattern off the database which is updated.
  let rrule;
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
    vevent.addPropertyWithValue('exdate', toBeDeleted);
    rrule = new ICAL.Recur(iCalStringJson);
  } else {
    // delete future events in recurrence
    rrule = new ICAL.Recur(buildRruleObject(recurrencePattern));
  }
  vevent.updatePropertyWithValue('rrule', rrule);

  // Ensure the proper Timezone ID.
  vevent.getAllProperties('exdate').forEach(e => e.setParameter('tzid', tzid));

  // This removes all the edited event and the master, and add the new master.
  vcalendar.removeAllSubcomponents('vevent');
  vcalendar.addSubcomponent(vevent);
  // For each edited event, find the right one to add.
  recurrencePattern.recurrenceIds.split(',').forEach(date => {
    const editedEvent = moment.tz(date * 1000, eventObject.start.timezone);
    const findingEditedComp = allEditedEvent.filter(e2 =>
      moment(e2.getFirstPropertyValue().toJSDate()).isSame(editedEvent, 'day')
    );
    if (findingEditedComp.length > 0) {
      vcalendar.addSubcomponent(findingEditedComp[0]);
    }
  });
  return vcalendar.toString();
};

export const buildICALStringUpdateRecurEvent = (recurrencePattern, eventObject, updatedObject) => {
  // debugger;
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(eventObject.iCALString);
  const vcalendar = new ICAL.Component(calendarData);

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = vcalendar.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = eventObject.dataValues.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);
  vcalendar.removeSubcomponent('vtimezone');

  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  // debugger;

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
  const startDateTime = ICAL.Time.fromJSDate(new Date(updatedObject.start.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(updatedObject.end.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (updatedObject.allDay) {
    startDateTime.isDate = true;
  } else {
    startDateTime.isDate = false;
  }

  vevent.updatePropertyWithValue('recurrence-id', startDateTime);
  vevent.getFirstProperty('recurrence-id').setParameter('tzid', tzid);

  // UID ensures the connection to the Recurring Master
  vevent.updatePropertyWithValue('uid', eventObject.iCalUID);

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', startDateTime);
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  // Temp set the duration to all an hour, Will change in the future. (TO-DO)
  vevent.updatePropertyWithValue('duration', duration);

  // The other fields.
  vevent.updatePropertyWithValue('sequence', 0);
  vevent.updatePropertyWithValue('created', ICAL.Time.now());
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());

  vevent.updatePropertyWithValue('priority', 0);

  // Currently, only updating the title. (TO-DO)
  vevent.updatePropertyWithValue('summary', updatedObject.title);
  vevent.updatePropertyWithValue('description', updatedObject.description);

  // Update the rule based off the recurrence pattern.
  const rrule = new ICAL.Recur(buildRruleObject(recurrencePattern));
  recurrencePattern.iCALString = rrule.toString();

  // The other fields.
  vevent.updatePropertyWithValue('status', 'CONFIRMED');
  vevent.updatePropertyWithValue('transp', 'OPAQUE');
  vevent.updatePropertyWithValue('class', 'PUBLIC');

  // Ensure no duplicates!
  const filteredResult = vcalendar
    .getAllSubcomponents('vevent')
    .filter(e => e.getFirstPropertyValue('recurrence-id') !== null)
    .map(e => ({
      e,
      result: moment(e.getFirstPropertyValue('recurrence-id').toJSDate()).isSame(
        moment.tz(eventObject.start.dateTime * 1000, eventObject.start.timezone)
      ),
    }));
  const hasDuplicate = filteredResult.filter(anyTrue => anyTrue.result === true).length > 0;

  if (hasDuplicate) {
    const removingVEvents = filteredResult.filter(anyTrue => anyTrue.result === true);
    removingVEvents.forEach(obj => vcalendar.removeSubcomponent(obj.e));
  }

  // Add the new master, and the timezone after that.
  vcalendar.addSubcomponent(vevent);
  vcalendar.addSubcomponent(timezoneMetadata);
  // debugger;
  return vcalendar.toString();
};

export const buildICALStringUpdateSingleEvent = (
  updatedEvent,
  calendarObject,
  rruleString = undefined
) => {
  // Build the Dav Calendar Object from the iCalString.
  const calendarData = ICAL.parse(calendarObject.iCALString);
  const calendarComp = new ICAL.Component(calendarData);
  // const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // const calObject = await dbCalendarActions.retrieveCalendarByOwnerId();

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = calendarComp.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = calendarObject.dataValues.start.timezone;
  const icalTimezoneData = `BEGIN:VTIMEZONE\nTZID:${tzid}\nEND:VTIMEZONE`;
  const jcalTimezoneData = ICAL.parse(icalTimezoneData);
  const timezoneMetadata = new ICAL.Component(jcalTimezoneData);

  calendarComp.removeSubcomponent('vtimezone');

  // Remove the previous event, as we are building a new one.
  calendarComp.removeSubcomponent('vevent');

  // Create new event structure, and parse it into a component.
  const iCalendarData = 'BEGIN:VEVENT\nEND:VEVENT\n';
  const jcalData = ICAL.parse(iCalendarData);
  const vevent = new ICAL.Component(jcalData);

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
  const startDateTime = ICAL.Time.fromJSDate(new Date(updatedEvent.start.toDate()), false);
  const endDateTime = ICAL.Time.fromJSDate(new Date(updatedEvent.end.toDate()), false);
  const duration = endDateTime.subtractDate(startDateTime);

  if (updatedEvent.allDay) {
    startDateTime.isDate = true;
  } else {
    startDateTime.isDate = false;
  }

  // The order might matter, did not test it yet, but sequence is usually at the top.
  vevent.updatePropertyWithValue('sequence', 0);

  // Take UID from previous object, so that it will replace it.
  vevent.updatePropertyWithValue('uid', calendarObject.iCalUID);

  // DateTime start of the selected event, set the Timezone ID properly.
  vevent.updatePropertyWithValue('dtstart', startDateTime);
  vevent.getFirstProperty('dtstart').setParameter('tzid', tzid);

  // vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(new Date(datetimeEnd.toDate()), false));
  // vevent.getFirstProperty('dtend').setParameter('tzid', tzid);

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
  if (rruleString) {
    // eslint-disable-next-line no-underscore-dangle
    const rrule = ICAL.Recur._stringToData(rruleString);
    vevent.updatePropertyWithValue('rrule', rrule);
    // debugger;
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
  return calendarComp.toString();
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
  const tzid = eventObject.dataValues.start.timezone;
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

  // Updating Single Recurring event, so update the recurrence-id based off the start time.
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
  const organizerProperty = vevent.updatePropertyWithValue('organizer', updatedObject.organizer);
  organizerProperty.setParameter('email', updatedObject.organizer);

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
  return vcalendar.toString();
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
  const tzid = eventObject.dataValues.start.timezone;
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
  return vcalendar.toString();
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
  const tzid = eventObject.dataValues.start.timezone;
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
  return vcalendar.toString();
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

export const editICALStringRecurringToSingle = (updatedData, masterEventData) => {
  // stub
  const vcalendar = new ICAL.Component(ICAL.parse(masterEventData.iCALString));

  // Remove Timezone data as there might be duplicates.
  // const timezoneMetadata = calendarComp.getFirstSubcomponent('vtimezone');
  // const tzid = timezoneMetadata.getFirstPropertyValue('tzid');
  const tzid = masterEventData.dataValues.start.timezone;
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
  return vcalendar.toString();
};
