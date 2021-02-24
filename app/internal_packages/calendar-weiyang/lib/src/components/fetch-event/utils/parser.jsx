/* eslint-disable new-cap */
/* eslint-disable no-lone-blocks */
import ICAL from 'ical.js';
import moment from 'moment-timezone';
import uuidv4 from 'uuid';
import { RRule, RRuleSet } from 'rrule';
import { CALDAV_PROVIDER } from '../../constants';
// import * as dbRpActions from '../sequelizeDB/operations/recurrencepatterns';

const TEMPORARY_RECURRENCE_END = new Date(2020, 12, 12);

export const parseRecurrenceEvents = calEvents => {
  const recurringEvents = [];
  calEvents.forEach(calEvent => {
    const { isRecurring } = calEvent.eventData;
    if (isRecurring && calEvent.recurData !== undefined && calEvent.recurData !== null) {
      const options = RRule.parseString(calEvent.recurData.rrule.stringFormat);
      options.dtstart = new Date(moment.unix(calEvent.eventData.start.dateTime));
      const rrule = new RRule(options);
      console.log('rrule', rrule);
      recurringEvents.push({
        id: uuidv4(),
        recurringTypeId: calEvent.eventData.start.dateTime,
        originalId: calEvent.eventData.originalId,
        colorId: calEvent.eventData.colorId,
        freq: calEvent.recurData.rrule.freq,
        interval:
          calEvent.recurData.rrule.interval === undefined
            ? rrule.options.interval
            : calEvent.recurData.rrule.interval,
        until:
          calEvent.recurData.rrule.until !== undefined
            ? moment(calEvent.recurData.rrule.until)
                .unix()
                .toString()
            : undefined,
        exDates: calEvent.recurData.exDates
          .map(exDate => moment(new Date(exDate)).unix())
          .join(','),
        recurrenceIds: calEvent.recurData.recurrenceIds.join(','),
        modifiedThenDeleted: calEvent.recurData.modifiedThenDeleted,
        numberOfRepeats: calEvent.recurData.rrule.count,
        iCalUID: calEvent.eventData.iCalUID,
        iCALString: calEvent.recurData.iCALString,
        wkSt: calEvent.recurData.rrule.wkst, // Prob not working
        isAllDay: calEvent.eventData.allDay,
        byMonth:
          rrule.origOptions.bymonth === undefined ? '' : rrule.origOptions.bymonth.toString(),
        byMonthDay:
          // eslint-disable-next-line no-nested-ternary
          rrule.origOptions.bymonthday === undefined
            ? ''
            : rrule.origOptions.bymonthday === Array
            ? `(${rrule.origOptions.bymonthday.join(',')})`
            : `(${rrule.origOptions.bymonthday})`,
        byYearDay:
          rrule.origOptions.byyearday === undefined
            ? ''
            : `(${calEvent.recurData.rrule.byyearday.join(',')})`,
        byWeekNo:
          rrule.origOptions.byweekday === undefined
            ? '()'
            : `(${rrule.origOptions.byweekday
                .filter(e => e.n !== undefined)
                .map(e => e.n)
                .join(',')})`,
        byWeekDay:
          rrule.origOptions.byweekday === undefined
            ? '()'
            : `(${rrule.origOptions.byweekday
                .map(e => parseWeekDayNoToString(e.weekday))
                .join(',')})`,
        weeklyPattern:
          calEvent.recurData.rrule.freq !== 'WEEKLY' ? '' : convertiCalWeeklyPattern(rrule),
        // Too much details, Prob not needed for below
        bySetPos: calEvent.recurData.rrule.bysetpos,
        byHour: calEvent.recurData.rrule.byhour,
        byMinute: calEvent.recurData.rrule.byminute,
        bySecond: calEvent.recurData.rrule.bysecond,
        byEaster: calEvent.recurData.rrule.byeaster,
      });
    }
  });
  return recurringEvents;
};

export const convertiCalWeeklyPattern = rrule => {
  const weeklyPattern = [0, 0, 0, 0, 0, 0, 0];
  if (rrule.origOptions.byweekday) {
    rrule.origOptions.byweekday.forEach(e => {
      // Need +1 here because weekday starts from 0
      let index = e.weekday + 1;
      if (index >= 7) {
        index = 0;
      }
      weeklyPattern[index] = 1;
    });
  } else {
    const date = moment(rrule.options.dtstart);
    weeklyPattern[date.day()] = 1;
  }
  return weeklyPattern.join(',');
};

export const parseEventPersons = events => {
  const eventPersons = [];
  events.forEach(calEvent => {
    const attendees = calEvent.eventData.attendee;
    if (attendees.length > 0) {
      // if there are attendees
      attendees.forEach(attendee => {
        eventPersons.push({
          eventPersonId: uuidv4(),
          // this is null when status of event is not confirmed
          eventId: calEvent.eventData.id,
          // Update: Gonna use email as the personId
          personId: attendee.email !== undefined ? attendee.email : attendee.action,
        });
      });
    }
  });
  return eventPersons;
};

// Returns an array of JSON list of each calendar information, eg work calendar, home calendar etc
// [{work calendar}, {home calendar}]
export const parseCal = calendars => {
  const parsedCalendars = calendars.map(calendar => ({
    calendarId: calendar.data.href,
    ownerId: calendar.account.credentials.username,
    name: calendar.displayName,
    description: calendar.description,
    timezone: calendar.timezone,
    url: calendar.url,
    providerType: calendar.url.includes('caldav') ? CALDAV_PROVIDER : null,
  }));
  return parsedCalendars;
};

// Returns an array of JSON containing either 1) eventData only or 2) eventData+recurData
// 1) consist of non recurring event information. 2) consist of recurring event information.
export const parseCalEvents = (calendars, calendarList) => {
  const events = [];
  calendars.forEach(calendar => {
    events.push(newParseCalendarObjects(calendar, calendarList));
  });
  const flatEvents = events.reduce((acc, val) => acc.concat(val), []);
  const filteredEvents = flatEvents.filter(event => event !== '');
  const flatFilteredEvents = filteredEvents.reduce((acc, val) => acc.concat(val), []);
  return flatFilteredEvents;
};

export const newParseCalendarObjects = (calendar, calendarList) => {
  const calendarObjects = calendar.objects;
  const calendarId = calendar.url;
  const color = calendarList.find(cal => cal.url === calendarId).color;
  const singleCalendarObjects = calendarObjects.map(calendarObject =>
    parseCalendarObject(calendarObject, calendarId, color)
  );
  const flatEvents = singleCalendarObjects.reduce((acc, val) => acc.concat(val), []);
  const filteredEvents = flatEvents.filter(event => event !== '');
  const flatFilteredEvents = filteredEvents.reduce((acc, val) => acc.concat(val), []);
  const map = new Map();
  flatFilteredEvents.forEach(e => {
    if (map.has(e.eventData.originalId)) {
      map.get(e.eventData.originalId).push(e);
    } else {
      map.set(e.eventData.originalId, [e]);
    }
  });
  map.forEach((v, k) => {
    if (v.length === 1) {
      map.delete(k);
    }
  });
  if (map.size === 0) {
    return flatFilteredEvents;
  }

  return flatFilteredEvents;
};

export const parseCalendarObject = (calendarObject, calendarId, color) => {
  const { etag, url, calendarData } = calendarObject;
  const etagClean = etag.slice(1, -1);
  let edisonEvent = {};
  if (calendarData !== undefined && calendarData !== '') {
    edisonEvent = parseCalendarData(calendarData, etagClean, url, calendarId, color);
  } else {
    edisonEvent = '';
  }
  return edisonEvent;
};

export const parseCalendarData = (calendarData, etag, url, calendarId, color) => {
  const results = [];
  const jCalData = ICAL.parse(calendarData);
  console.log('calendardata', calendarData);
  const comp = new ICAL.Component(jCalData);
  console.log('comp', comp);
  const vevents = comp.getAllSubcomponents('vevent');
  console.log('vevents', vevents);
  const modifiedEvents = vevents.filter(indivComp => !indivComp.hasProperty('rrule'));
  console.log('modifiedEvents', modifiedEvents);
  let masterEvent;
  // This means it is recurring because there is more than one event per ics.
  if (vevents.length > 1) {
    masterEvent = vevents.filter(indivComp => indivComp.hasProperty('rrule'))[0];
  } else {
    // Single or recurring event with no edited events
    masterEvent = vevents[0];
  }

  if (masterEvent === undefined) {
    // debugger;
  }
  console.log('masterEvent', masterEvent);
  const icalMasterEvent = new ICAL.Event(masterEvent);
  console.log('icalMasterEvent', icalMasterEvent);

  if (icalMasterEvent.isRecurring()) {
    const recurrenceIds = getRecurrenceIds(vevents);
    const exDates = getExDates(masterEvent);

    // I need to figure out how to parse the data into db here.
    const rrule = getRuleJSON(masterEvent, icalMasterEvent);
    console.log('parseCalender', rrule);
    const modifiedThenDeleted = isModifiedThenDeleted(masterEvent, exDates);

    const iCALString = masterEvent.getFirstPropertyValue('rrule').toString();
    console.log('getAllProperty', masterEvent.getFirstPropertyValue());
    console.log('iCalString', iCALString);
    if (recurrenceIds.length > 0) {
      // modified events from recurrence series
      for (let i = 0; i < modifiedEvents.length; i += 1) {
        results.push({
          eventData: parseModifiedEvent(comp, etag, url, modifiedEvents[i], calendarId, color),
        });
      }
    }

    // Recurring event
    results.push({
      recurData: { rrule, exDates, recurrenceIds, modifiedThenDeleted, iCALString },
      eventData: parseEvent(comp, true, etag, url, calendarId, true, color),
    });
  } else {
    // Non-recurring event
    results.push({
      eventData: parseEvent(comp, false, etag, url, calendarId, false, color),
    });
  }
  return results;
};

export const parseModifiedEvent = (comp, etag, url, modifiedEvent, calendarId, color) => {
  const dtstart =
    modifiedEvent.getFirstPropertyValue('dtstart') == null
      ? ''
      : modifiedEvent.getFirstPropertyValue('dtstart');

  let tz = modifiedEvent.getFirstPropertyValue('tzid');
  if (tz === null) {
    tz = moment.tz.guess(true);
  }
  let dtstartMoment = moment.tz(dtstart.toUnixTime() * 1000, tz);
  dtstartMoment = dtstartMoment.tz('GMT').tz(tz, true);

  let dtend;
  let dtendMoment;
  if (modifiedEvent.hasProperty('dtend')) {
    if (!modifiedEvent.hasProperty('duration')) {
      dtendMoment = moment.tz(modifiedEvent.getFirstPropertyValue('dtend').toUnixTime() * 1000, tz);
      dtendMoment = dtendMoment.tz('GMT').tz(tz, true);
    }
  } else if (modifiedEvent.hasProperty('duration')) {
    if (modifiedEvent.getFirstPropertyValue('duration').toSeconds() >= 0) {
      dtend = modifiedEvent.getFirstPropertyValue('dtstart').clone();
      dtend.addDuration(modifiedEvent.getFirstPropertyValue('duration'));
      dtendMoment = moment.tz(dtend.toUnixTime() * 1000, tz);
      dtendMoment = dtendMoment.tz('GMT').tz(tz, true);
    }
  } else {
    // According to documentation, it ask me to add one day if both duration and dtend does not exist.
    dtend = modifiedEvent
      .getFirstPropertyValue('dtstart')
      .clone()
      .addDuration(
        new ICAL.Duration({
          days: 1,
        })
      );
    dtendMoment = moment.tz(dtend.toUnixTime() * 1000, tz);
    dtendMoment = dtendMoment.tz('GMT').tz(tz, true);
  }

  return {
    id: uuidv4(),
    start: {
      dateTime: dtstartMoment.unix(),
      timezone: tz,
    },
    end: {
      dateTime: dtendMoment.unix(),
      timezone: tz,
    },
    originalId: modifiedEvent.getFirstPropertyValue('uid'),
    iCalUID: modifiedEvent.getFirstPropertyValue('uid'),
    created:
      modifiedEvent.getFirstPropertyValue('created') !== null
        ? moment(modifiedEvent.getFirstPropertyValue('created')).unix()
        : 0,
    updated:
      modifiedEvent.getFirstPropertyValue('last-modified') !== null
        ? moment(modifiedEvent.getFirstPropertyValue('last-modified').toJSDate()).unix()
        : 0,
    summary: modifiedEvent.getFirstPropertyValue('summary'),
    description:
      modifiedEvent.getFirstPropertyValue('description') == null
        ? ''
        : modifiedEvent.getFirstPropertyValue('description'),
    location:
      modifiedEvent.getFirstPropertyValue('location') == null
        ? ''
        : modifiedEvent.getFirstPropertyValue('location'),
    originalStartTime: {
      dateTime: moment(dtstart).unix(),
      timezone: 'America/Los_Angeles',
    },
    providerType: 'CALDAV',
    isRecurring: true,
    etag,
    caldavUrl: url,
    calendarId,
    colorId: color,
    iCALString: comp.toString(),
  };
};

export const parseEvent = (component, isRecurring, etag, url, calendarId, cdIsMaster, color) => {
  const vevents = component.getAllSubcomponents('vevent');

  let masterEvent;
  // This means it is recurring because there is more than one event per ics.
  if (vevents.length > 1) {
    masterEvent = vevents.filter(indivComp => indivComp.hasProperty('rrule'))[0];
  } else {
    // Single or recurring event with no edited events
    masterEvent = vevents[0];
  }
  // console.log(component);
  // debugger;
  let tz = moment.tz.guess(true); // guess user timezone based on browser
  // If vtimezone == undefined, it is a full day event
  if (component.getFirstSubcomponent('vtimezone')) {
    tz = component.getFirstSubcomponent('vtimezone').getFirstPropertyValue('tzid');
  }
  const dtstart =
    masterEvent.getFirstPropertyValue('dtstart') == null
      ? ''
      : masterEvent.getFirstPropertyValue('dtstart');

  let dtstartMoment = moment.tz(dtstart.toUnixTime() * 1000, tz);
  dtstartMoment = dtstartMoment.tz('GMT').tz(tz, true);

  let dtend;
  let dtendMoment;
  if (masterEvent.hasProperty('dtend')) {
    if (!masterEvent.hasProperty('duration')) {
      dtendMoment = moment.tz(masterEvent.getFirstPropertyValue('dtend').toUnixTime() * 1000, tz);
      dtendMoment = dtendMoment.tz('GMT').tz(tz, true);
    }
  } else if (masterEvent.hasProperty('duration')) {
    dtend = masterEvent.getFirstPropertyValue('dtstart').clone();
    dtend.addDuration(masterEvent.getFirstPropertyValue('duration'));
    dtendMoment = moment.tz(dtend.toUnixTime() * 1000, tz);
    dtendMoment = dtendMoment.tz('GMT').tz(tz, true);
  } else {
    // According to documentation, it ask me to add one day if both duration and dtend does not exist.
    dtend = masterEvent
      .getFirstPropertyValue('dtstart')
      .clone()
      .addDuration(
        new ICAL.Duration({
          days: 1,
        })
      );
    dtendMoment = moment.tz(dtend.toUnixTime() * 1000, tz);
    dtendMoment = dtendMoment.tz('GMT').tz(tz, true);
  }
  const event = {
    id: uuidv4(),
    start: {
      dateTime: dtstartMoment.unix(),
      timezone: tz,
    },
    end: {
      dateTime: dtendMoment.unix(),
      timezone: tz,
    },
    originalId: masterEvent.getFirstPropertyValue('uid'),
    iCalUID: masterEvent.getFirstPropertyValue('uid'),
    created:
      masterEvent.getFirstPropertyValue('created') !== null
        ? moment(masterEvent.getFirstPropertyValue('created')).unix()
        : 0,
    updated:
      masterEvent.getFirstPropertyValue('last-modified') !== null
        ? moment(masterEvent.getFirstPropertyValue('last-modified').toJSDate()).unix()
        : 0,
    summary: masterEvent.getFirstPropertyValue('summary'),
    description:
      masterEvent.getFirstPropertyValue('description') == null
        ? ''
        : masterEvent.getFirstPropertyValue('description'),
    location:
      masterEvent.getFirstPropertyValue('location') == null
        ? ''
        : masterEvent.getFirstPropertyValue('location'),
    organizer:
      masterEvent.getFirstProperty('organizer') === null ||
      masterEvent.getFirstProperty('organizer').jCal[1].email === undefined
        ? ''
        : masterEvent.getFirstProperty('organizer').jCal[1].email,
    attendee:
      masterEvent.getFirstPropertyValue('attendee') == null
        ? ''
        : JSON.stringify(
            Object.assign(
              {},
              masterEvent.getAllProperties('attendee').map(attendee => {
                return {
                  email: attendee.getParameter('email'),
                  partstat: attendee.getParameter('partstat'),
                };
              })
            )
          ),
    originalStartTime: {
      dateTime: moment(dtstart).unix(),
      timezone: tz,
    },
    providerType: 'CALDAV',
    isRecurring,
    etag,
    caldavUrl: url,
    calendarId,
    colorId: color,
    isMaster: cdIsMaster,
    iCALString: component.toString(),
    // Temporary fix for wrong initial render of full day events, should only have one allday flag
    allDay: masterEvent.getFirstProperty('dtstart').type === 'date',
    isAllDay: masterEvent.getFirstProperty('dtstart').type === 'date',
  };
  // debugger;
  return event;
};

export const getRuleJSON = (masterEvent, icalMasterEvent) => {
  let rruleJSON = {};
  if (icalMasterEvent.isRecurring()) {
    const rrule = masterEvent.getFirstPropertyValue('rrule');
    rruleJSON = rrule.toJSON();
    rruleJSON.stringFormat = rrule.toString();
    if (rruleJSON.byday !== undefined) {
      if (typeof rruleJSON.byday === 'string') {
        rruleJSON.byday = [rruleJSON.byday];
        rruleJSON.byWeekDay = [rruleJSON.byday];
      }
    }
  }
  return rruleJSON;
};

export const getAttendees = masterEvent => {
  let attendees = [];
  if (masterEvent.hasProperty('attendee')) {
    attendees = parseAttendees(masterEvent.getAllProperties('attendee'));
  }
  return attendees;
};

export const getExDates = masterEvent => {
  const exDates = [];
  if (masterEvent.hasProperty('exdate')) {
    const exdateProps = masterEvent.getAllProperties('exdate');
    exdateProps.forEach(exdate => {
      let tz = exdate.getParameter('tzid');
      // This means it is GMT/UTC
      if (tz === null) {
        tz = 'UTC';
      }
      let deletedEventMoment = moment.tz(exdate.getFirstValue().toUnixTime() * 1000, tz);
      deletedEventMoment = deletedEventMoment.tz('GMT').tz(tz, true);
      exDates.push(deletedEventMoment.toString());
    });
  }
  return exDates;
};

export const getRecurrenceIds = vevents => {
  const recurrenceIds = [];
  vevents.forEach(evt => {
    if (evt.getFirstPropertyValue('recurrence-id')) {
      let tz = evt.getFirstPropertyValue('tzid');
      // This means it is GMT/UTC
      if (tz === null) {
        tz = 'UTC';
      }
      let editedIdMoment = moment.tz(
        evt.getFirstPropertyValue('recurrence-id').toUnixTime() * 1000,
        tz
      );
      editedIdMoment = editedIdMoment.tz('GMT').tz(tz, true);
      recurrenceIds.push(editedIdMoment.unix().toString());
    }
  });
  return recurrenceIds;
};

export const isModifiedThenDeleted = (recurEvent, exDates) => {
  let isMtd = false;
  if (exDates === 0 || !recurEvent.hasProperty('recurrence-id')) {
    return isMtd;
  }
  const recurId = recurEvent.getFirstProperty('recurrence-id').jCal[3];
  exDates.forEach(exdate => {
    if (exdate[3] === recurId) {
      isMtd = true;
      return isMtd;
    }
  });
  return isMtd;
};

/* Take Note that attendees with unconfirmed status do not have names */
export const parseAttendees = properties =>
  properties.map(property => ({
    status: property.jCal[1].partstat,
    action: property.jCal[3],
    email: property.jCal[1].email,
    displayName: property.jCal[1].cn !== undefined ? property.jCal[1].cn : property.jCal[1].email,
  }));

export const expandRecurEvents = (results, recurrencePatterns) => {
  const nonMTDresults = results.filter(result => !result.isModifiedThenDeleted);
  const recurringEvents = nonMTDresults.filter(
    nonMTDresult =>
      nonMTDresult.isRecurring &&
      nonMTDresult.providerType === 'CALDAV' &&
      nonMTDresult.isMaster === true
  );
  let finalResults = [];
  if (recurringEvents.length === 0) {
    finalResults = nonMTDresults;
  } else {
    finalResults = expandSeries(recurringEvents, recurrencePatterns);
  }
  return finalResults;
};

export const expandSeries = (recurringEvents, recurrencePatterns) => {
  // const resolved = await Promise.all(
  //   recurringEvents.map(async recurMasterEvent => {
  //     const recurPatternRecurId = await dbRpActions.getOneRpByOId(recurMasterEvent.iCalUID);
  //     return parseRecurrence(recurPatternRecurId.toJSON(), recurMasterEvent);
  //   })
  // );

  // below is without use of database
  const resolved = recurringEvents.map(recurMasterEvent => {
    const filteredRp = recurrencePatterns.filter(
      recurrencePattern => recurMasterEvent.iCalUID === recurrencePattern.iCalUID
    );
    if (filteredRp.length === 0) {
      // debugger
    }
    return parseRecurrence(filteredRp[0], recurMasterEvent);
  });
  const expandedSeries = resolved.reduce((acc, val) => acc.concat(val), []);
  return expandedSeries;
};

export const parseRecurrence = (recurPattern, recurMasterEvent) => {
  const recurEvents = [];
  const ruleSet = buildRuleSet(
    recurPattern,
    recurMasterEvent.start.dateTime,
    recurMasterEvent.start.timezone
  );
  // Edge case for when there is two timezones due to daylight savings
  // e.g. you will get one -800, and one -700 due to change of daylight savings
  // resulting in ruleSet generating wrong values as it does an === check.
  // In order to fix, just run a fitler on the recurDates as a safety net check.
  const mergedList = [
    ...recurPattern.recurrenceIds
      .split(',')
      .filter(str => str !== '')
      .map(str => parseInt(str, 10)),
    ...recurPattern.exDates
      .split(',')
      .filter(str => str !== '')
      .map(str => parseInt(str, 10)),
  ];

  console.log('ruleSet', ruleSet);
  const allDates = ruleSet.all();

  if (allDates.length <= 0) {
    // This means that the caldav server has an event that when expanded,
    // has 0 events to deal with. This could be due to several reasons
    // For e.g. another calendar app uploads an event with 0 events for some reason
    // Therefore, expansion fails, and we ignore.
    // We could help the user tidy up their events but I think that is a dangerous game to play.
    console.log('(Error) 0 expanded event found', recurPattern, recurMasterEvent);
    return [];
  }
  // Base TZ for all events.
  const base = allDates[0];

  // isNormalizedTz means all time zone from the recurrence series is the same.
  const isNormalizedTz = ruleSet
    .all()
    .every(element => element.getTimezoneOffset() === base.getTimezoneOffset());
  let recurDates = [];
  const eventTz = recurMasterEvent.start.timezone;
  const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!isNormalizedTz && moment.tz(eventTz).isDST()) {
    // SUPER FUNKY WEIRD EDGE CASE, rulestring breaks across timezones.
    // The pattern here is to always take the master time.
    // console.log(moment(base).toString(), recurMasterEvent.summary);
    recurDates.push(moment(base.toJSON()).unix());
    for (let i = 1; i < allDates.length; i += 1) {
      recurDates.push(
        moment.unix(allDates[i].setHours(base.getHours(), base.getMinutes())).unix() / 1000
      );
    }
  } else if (eventTz !== currentTz) {
    const tzedRuleset = ruleSet.all().map(date => moment.tz(date.getTime(), eventTz));
    if (tzedRuleset.length > 0) {
      const newBase = tzedRuleset[0];
      recurDates.push(moment(newBase.toJSON()).unix());
      for (let i = 1; i < tzedRuleset.length; i += 1) {
        tzedRuleset[i].hour(newBase.hour());
        tzedRuleset[i].minute(newBase.minute());
        recurDates.push(tzedRuleset[i].unix());
      }
    } else {
      // debugger;
    }
  } else {
    recurDates = ruleSet.all().map(date => moment(date.toJSON()).unix());
  }
  console.log('passed through parseRecurrence3');
  recurDates = recurDates.filter(date => !mergedList.includes(date));
  const duration = getDuration(recurMasterEvent);
  let vevents = [];
  // new event creation will have no icalstring yet
  if (recurMasterEvent.iCALString) {
    // eslint-disable-next-line prettier/prettier
    vevents = new ICAL.Component.fromString(recurMasterEvent.iCALString).getAllSubcomponents(
      'vevent'
    );
    vevents.shift(); // removes vevents[0], all exact copies of masterevent ignored
  }
  const exceptionMap = {};
  // eslint-disable-next-line prettier/prettier
  if (vevents.length > 0) {
    // exist exceptions to the repeat
    vevents.forEach(vevent => {
      const dtstart = vevent.getFirstPropertyValue('dtstart');
      // Calculating unix time. JS Date is in milliseconds, Unix is in secomds
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime
      const unixStart = dtstart.toJSDate().getTime() / 1000;
      exceptionMap[unixStart] = vevent;
    });
  }
  recurDates.forEach(recurDateTime => {
    // recurDateTime not inside exceptionMap. ie, current recurDateTime is follows master exactly
    if (!exceptionMap[recurDateTime]) {
      recurEvents.push({
        id: uuidv4(),
        end: {
          dateTime: moment
            .unix(recurDateTime)
            .add(duration)
            .unix(),
          timezone: eventTz,
        },
        start: {
          dateTime: recurDateTime,
          timezone: eventTz,
        },
        summary: recurMasterEvent.summary,
        recurringEventId: recurMasterEvent.iCalUID,
        iCalUID: recurMasterEvent.iCalUID,
        iCALString: recurMasterEvent.iCALString,
        originalId: recurMasterEvent.originalId,
        owner: recurMasterEvent.owner,
        isRecurring: recurMasterEvent.isRecurring,
        providerType: recurMasterEvent.providerType,
        calendarId: recurMasterEvent.calendarId,
        colorId: recurMasterEvent.colorId,
        created: recurMasterEvent.created,
        description: recurMasterEvent.description,
        etag: recurMasterEvent.etag,
        caldavUrl: recurMasterEvent.caldavUrl,
        location: recurMasterEvent.location,
        organizer: recurMasterEvent.organizer,
        attendee: recurMasterEvent.attendee,
        originalStartTime: recurMasterEvent.originalStartTime,
        updated: recurMasterEvent.updated,
        isAllDay: recurMasterEvent.allDay,
        ...(recurMasterEvent.start.dateTime === recurDateTime && {
          isMaster: true,
        }),
      });
    } else {
      // current recurDateTime have some differences from the master
      recurEvents.push({
        id: uuidv4(),
        end: {
          dateTime: moment
            .unix(recurDateTime)
            .add(duration)
            .unix(),
          timezone: eventTz,
        },
        start: {
          dateTime: recurDateTime,
          timezone: eventTz,
        },
        summary: exceptionMap[recurDateTime].getFirstPropertyValue('summary'),
        recurringEventId: recurMasterEvent.iCalUID,
        iCalUID: recurMasterEvent.iCalUID,
        iCALString: recurMasterEvent.iCALString,
        originalId: recurMasterEvent.originalId,
        owner: recurMasterEvent.owner,
        isRecurring: recurMasterEvent.isRecurring,
        providerType: recurMasterEvent.providerType,
        calendarId: recurMasterEvent.calendarId,
        colorId: recurMasterEvent.colorId,
        created: recurMasterEvent.created,
        description: exceptionMap[recurDateTime].getFirstPropertyValue('description'),
        etag: recurMasterEvent.etag,
        caldavUrl: recurMasterEvent.caldavUrl,
        location: recurMasterEvent.location,
        organizer: recurMasterEvent.organizer,
        attendee: recurMasterEvent.attendee,
        originalStartTime: recurMasterEvent.originalStartTime,
        updated: recurMasterEvent.updated,
        isAllDay: recurMasterEvent.allDay,
        ...(recurMasterEvent.start.dateTime === recurDateTime && {
          isMaster: true,
        }),
      });
    }
  });
  console.log('passed through parseRecurrence4');
  return recurEvents;
};

export const getDuration = master => {
  const start = moment.unix(master.start.dateTime);
  const end = moment.unix(master.end.dateTime);
  return moment.duration(end.diff(start));
};

export const parseStringToWeekDayNo = stringEwsWeekDay => {
  switch (stringEwsWeekDay) {
    case 'MO':
      return 0;
    case 'TU':
      return 1;
    case 'WE':
      return 2;
    case 'TH':
      return 3;
    case 'FR':
      return 4;
    case 'SA':
      return 5;
    case 'SU':
      return 6;
    default:
      break;
  }
};

export const parseWeekDayNoToString = stringEwsWeekDay => {
  switch (stringEwsWeekDay) {
    case 0:
      return 'MO';
    case 1:
      return 'TU';
    case 2:
      return 'WE';
    case 3:
      return 'TH';
    case 4:
      return 'FR';
    case 5:
      return 'SA';
    case 6:
      return 'SU';
    default:
      break;
  }
};

export const buildRuleObject = (pattern, startTime, tz) => {
  const ruleObject = {};
  ruleObject.interval = pattern.interval;
  const jsonObj = moment.tz(startTime * 1000, tz);
  ruleObject.dtstart = jsonObj.toDate();

  // // Not used at the moment, Need to ensure other providers do not use them too.
  // ruleObject.bymonthday = pattern.byMonthDay ? pattern.byMonthDay : null;
  // ruleObject.byyearday = pattern.byYearDay ? pattern.byYearDay : null;

  // // Probably not used. Too detailed and not needed.
  // ruleObject.byhour = pattern.byHour ? pattern.byHour : null;
  // ruleObject.bysetpos = pattern.bySetPos ? pattern.bySetPos : null;
  // ruleObject.byminute = pattern.byMinute ? pattern.byMinute : null;
  // ruleObject.bysecond = pattern.bySecond ? pattern.bySecond : null;
  // ruleObject.byeaster = pattern.byEaster ? pattern.byEaster : null;

  // This is where it gets really really tricky, fml.
  // Due to RRule api limiation, if I set a byweekday/byweekno value and
  // it is a monthly recurrence, it will become weekly when .all() is called.
  // Resulting in a weird expansion of the recurrence series.
  // So based off each freq, you need to set the proper variable accordingly.
  // Something to note, variables that are not NULL or UNDEFINED, will somehow affect
  // the result from .all from a ruleset.
  // Therefore, DO NOT SET THEM, even a blank array breaks something.
  switch (pattern.freq) {
    case 'YEARLY':
      {
        ruleObject.freq = RRule.YEARLY;
        // Using the recurrence pattern, if it is blank which means '()',
        // .all behavior is it will auto expand on the frequency alone.
        // Therefore, I cannot even have a blank array, aka, ruleObject.byweekday.
        const byMonth = parseInt(pattern.byMonth, 10);

        if (byMonth) {
          ruleObject.bymonth = byMonth;
          const byWeekDay = pattern.byWeekDay
            .slice(1, -1)
            .split(',')
            .filter(str => str !== undefined && str !== null && str !== '')
            .map(day => parseStringToWeekDayNo(day));

          const byWeekNo = pattern.byWeekNo
            .slice(1, -1)
            .split(',')
            .filter(str => str !== undefined && str !== null && str !== '')
            .map(weekNo => parseInt(weekNo, 10));

          if (byWeekNo.length !== byWeekDay.length) {
            console.log('(Yearly) WeekNo length not equals to WeekDay length!');
          } else if (byWeekNo.length !== 0) {
            // Both ways, you need to set the by week day number.
            ruleObject.byweekday = [];
            for (let i = 0; i < byWeekNo.length; i += 1) {
              ruleObject.byweekday.push({ weekday: byWeekDay[i], n: byWeekNo[i] });
            }
          }
        }
      }
      break;
    case 'MONTHLY':
      {
        ruleObject.freq = RRule.MONTHLY;
        // Currently, I am facing a techincal limitation of the api.
        // But the idea here is there are different types of monthly events.

        // 1. Those that repeat on same (day of the week) and (week no)
        // 2. Those that repeat on the same (day every month)

        // Using the recurrence pattern, if it is blank which means '()',
        // .all behavior is it will auto expand on the frequency alone.
        // Therefore, I cannot even have a blank array, aka, ruleObject.byweekday.
        const byWeekDay = pattern.byWeekDay
          .slice(1, -1)
          .split(',')
          .filter(str => str !== undefined && str !== null && str !== '')
          .map(day => parseStringToWeekDayNo(day));

        const byWeekNo = pattern.byWeekNo
          .slice(1, -1)
          .split(',')
          .filter(str => str !== undefined && str !== null && str !== '')
          .map(weekNo => parseInt(weekNo, 10));

        if (byWeekNo.length !== byWeekDay.length) {
          console.log('(Monthly) WeekNo length not equals to WeekDay length!');
        } else if (byWeekNo.length !== 0) {
          // Both ways, you need to set the by week day number.
          ruleObject.byweekday = [];
          for (let i = 0; i < byWeekNo.length; i += 1) {
            ruleObject.byweekday.push({ weekday: byWeekDay[i], n: byWeekNo[i] });
          }
        }

        const byMonthDay = pattern.byMonthDay
          .slice(1, -1)
          .split(',')
          .filter(str => str !== undefined && str !== null && str !== '')
          .map(monthDay => parseInt(monthDay, 10));

        if (byMonthDay.length > 0) {
          ruleObject.bymonthday = [];
          for (let i = 0; i < byMonthDay.length; i += 1) {
            ruleObject.bymonthday.push(byMonthDay[i]);
          }
        }
      }
      break;
    case 'WEEKLY':
      {
        ruleObject.freq = RRule.WEEKLY;
        ruleObject.byweekday =
          pattern.byWeekDay !== '()'
            ? pattern.byWeekDay
                .slice(1, -1)
                .split(',')
                .map(day => parseStringToWeekDayNo(day))
            : null;
        ruleObject.byweekno =
          pattern.byWeekNo !== '()'
            ? pattern.byWeekNo
                .slice(1, -1)
                .split(',')
                .map(weekNo => parseInt(weekNo, 10))
            : null;
      }
      break;
    case 'DAILY':
      {
        ruleObject.freq = RRule.DAILY;
      }
      break;
    default:
  }

  if (
    (pattern.until === undefined || pattern.until === null) &&
    (pattern.numberOfRepeats === undefined || pattern.numberOfRepeats === null)
  ) {
    ruleObject.until = TEMPORARY_RECURRENCE_END;
  } else if (pattern.until === undefined || pattern.until === null || pattern.until === '') {
    ruleObject.count = pattern.numberOfRepeats;
  } else if (pattern.until !== 'Invalid date') {
    const patternJson = moment.tz(pattern.until * 1000, tz).toObject();
    ruleObject.until = new Date(
      Date.UTC(
        patternJson.years,
        patternJson.months,
        patternJson.date,
        patternJson.hours,
        patternJson.minutes
      )
    );
  }
  return ruleObject;
};

export const getModifiedThenDeletedDates = (exDates, recurDates) => {
  const modifiedThenDeletedDates = [];
  exDates.forEach(exdate => {
    recurDates.forEach(recurDate => {
      if (exdate === recurDate) {
        modifiedThenDeletedDates.push(exdate);
      }
    });
  });
  return modifiedThenDeletedDates;
};

export const buildRuleSet = (pattern, start, tz) => {
  // Create new ruleset based off the rule object.
  const rruleSet = new RRuleSet();
  const ruleObject = buildRuleObject(pattern, start, tz);
  rruleSet.rrule(new RRule(ruleObject));
  // Get the deleted and updated occurances from the recurrence pattern.
  const { exDates, recurrenceIds } = pattern;

  // For each of them, set the ex date so to not include them in the list.
  if (exDates !== undefined) {
    exDates
      .split(',')
      .filter(s => s !== '')
      .forEach(exdate => {
        const momentdate = moment.unix(exdate);
        rruleSet.exdate(momentdate.toDate());
      });
  }
  // Here, I am unsure if I am handling it correctly as
  // an edited occurance is also a exdate techincally speaking
  if (recurrenceIds !== undefined) {
    recurrenceIds
      .split(',')
      .filter(s => s !== '')
      .forEach(recurDate => {
        const momentdate = moment.unix(recurDate);
        rruleSet.exdate(momentdate.toDate());
      });
  }

  // const modifiedThenDeletedDates = getModifiedThenDeletedDates(exDates, recurrenceIds);
  return rruleSet;
};

export default {
  parseRecurrenceEvents,
  convertiCalWeeklyPattern,
  parseEventPersons,
  parseCal,
  parseCalEvents,
  newParseCalendarObjects,
  parseCalendarObject,
  parseCalendarData,
  parseModifiedEvent,
  parseEvent,
  getRuleJSON,
  getAttendees,
  getExDates,
  getRecurrenceIds,
  isModifiedThenDeleted,
  parseAttendees,
  expandRecurEvents,
  expandSeries,
  parseRecurrence,
  getDuration,
  parseStringToWeekDayNo,
  parseWeekDayNoToString,
  buildRuleObject,
  getModifiedThenDeletedDates,
  buildRuleSet,
};
