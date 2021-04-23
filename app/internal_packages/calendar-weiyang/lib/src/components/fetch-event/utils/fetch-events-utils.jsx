import {
  DELETE_SINGLE_EVENT,
  GOOGLE_PROVIDER,
  CALDAV_PROVIDER,
  ICLOUD_URL,
  SYNC_CALENDAR_DATA,
  SYNC_CALENDAR_LISTS,
  SYNC_RECURRENCE_PATTERN,
  UPDATE_ICALSTRING,
} from '../../constants';
import { fetchGmailAccount, getCaldavAccount, syncCaldavCalendar } from './get-caldav-account';
import * as PARSER from '../../common-utils/parser';
import { Actions, CalendarPluginStore, AccountStore } from 'mailspring-exports';
import { syncGoogleLocalData, syncIcalLocalData } from './sync-utils';
import moment from 'moment';
import uuidv4 from 'uuid';
const dav = require('dav');

const getUidFromIcalstring = iCalstring => {
  let regexMatchedString = iCalstring.match(/UID:.+/g);
  return regexMatchedString[0].substr(4).trim();
};

// fetch newly created events etag and icalstring
export const getEtagAndIcalstringFromIcalUID = async (email, password, accountType, iCalUID) => {
  const res = await getCaldavAccount(email, password, accountType);
  const calendars = res.calendars;
  let trimmedData = [];
  calendars.forEach(calendar => {
    const calendarObjects = calendar.objects;
    calendarObjects.forEach(calObj => {
      if (calObj.calendarData !== undefined && calObj.calendarData !== '') {
        const foundUid = getUidFromIcalstring(calObj.calendarData);
        const etag = calObj.etag.slice(1, -1); // remove quotes from front and end
        trimmedData.push({ iCalUID: foundUid, etag: etag, iCalstring: calObj.calendarData });
      }
    });
  });
  const [foundObj] = trimmedData.filter(data => data.iCalUID === iCalUID);
  if (foundObj === undefined) {
    console.log('no iCalUID found in server');
    return undefined;
  }
  return foundObj;
};

export const fetchCaldavEvents = async (email, password, accountType) => {
  const res = await getCaldavAccount(email, password, ICLOUD_URL);
  console.log('res', res);
  const authObject = {
    providerType: CALDAV_PROVIDER,
    caldavType: accountType,
    username: res.credentials.username,
    password: res.credentials.password,
  };
  Actions.setAuth(authObject, CALDAV_PROVIDER);
  const calendars = PARSER.parseCal(res.calendars);
  console.log('calendar', calendars);
  syncIcalLocalData(calendars, SYNC_CALENDAR_LISTS);
  const events = PARSER.parseCalEvents(res.calendars, calendars);
  console.log('events', events);
  const flatEvents = events.reduce((acc, val) => {
    // console.log('accumulator', acc, val);
    return acc.concat(val);
  }, []);
  const filteredEvents = flatEvents.filter(event => event !== '');
  const flatFilteredEvents = filteredEvents.reduce((acc, val) => acc.concat(val), []);
  console.log('flatFilteredEvents', flatFilteredEvents);
  // const eventPersons = PARSER.parseEventPersons(flatFilteredEvents);
  const recurrencePatterns = PARSER.parseRecurrenceEvents(flatFilteredEvents);
  syncIcalLocalData(recurrencePatterns, SYNC_RECURRENCE_PATTERN);
  console.log('recurrencePattern', recurrencePatterns);
  const expanded = PARSER.expandRecurEvents(
    flatFilteredEvents.map(calEvent => calEvent.eventData),
    recurrencePatterns
  );
  const finalResult = [
    ...expanded.filter(e => e.isRecurring === true),
    ...flatFilteredEvents
      .filter(e => e.recurData === undefined || e.recurData === null)
      .map(e => e.eventData),
  ];
  finalResult.forEach(e => {
    e.owner = email;
    e.caldavType = accountType;
  });
  syncIcalLocalData(finalResult, SYNC_CALENDAR_DATA);
  console.log('DATA', finalResult);

  deleteStaleEventsDEBUG(email, password, flatFilteredEvents, finalResult);

  return finalResult;
};
// Delete stale recurrences during developement
// Happens when there's no events but recurrences exists,
// caused by deleting all specific events in the recurrences
const deleteStaleEventsDEBUG = async (email, password, flatFilteredEvents, finalResult) => {
  // if there's event in the expansion, returns immediately, even though there might be stale recurrences
  if (finalResult.length > 0) {
    return;
  }
  // Parse user information from account layer to dav object.
  const xhrObject = new dav.transport.Basic(
    new dav.Credentials({
      username: email,
      password: password,
    })
  );
  // Ensure etag is set in option for no 412 http error.
  flatFilteredEvents.forEach(async flatFilteredEvent => {
    const option = {
      xhr: xhrObject,
      etag: flatFilteredEvent.eventData.etag,
    };
    const calendarObject = {
      url: flatFilteredEvent.eventData.caldavUrl,
    };
    await dav.deleteCalendarObject(calendarObject, option);
  });
};

const parseGoogleEvent = (event, myCalendar, isMaster, email) => {
  return {
    attendee: event.attendees
      ? JSON.stringify({
          ...event.attendees.map(attendee => {
            let partstat = 'NEEDS-ACTION';
            if (attendee.responseStatus === 'accepted') partstat = 'APPROVED';
            if (attendee.responseStatus === 'declined') partstat = 'DECLINED';
            return {
              email: attendee.email,
              partstat,
            };
          }),
        })
      : '',
    calendarId: myCalendar.id,
    colorId: 'blue', // TODO the color logic
    created: moment(event.created).unix(),
    description: event.description ? event.description : '',
    end: {
      dateTime: moment(event.end.dateTime ? event.end.dateTime : event.end.date).unix(),
      // timezone is from datetime of event, which user pre-selected, otherwise defaults to calendar timezone
      timezone: event.end.timeZone ? event.end.timeZone : myCalendar.timeZone,
    },
    etag: event.etag,
    iCalUID: event.iCalUID,
    id: event.id,
    isAllDay: event.start.date ? true : false,
    isMaster: isMaster,
    isRecurring: event.recurringEventId ? true : false,
    location: event.location ? event.location : '',
    organizer: event.organizer ? event.organizer.email : '',
    originalId: event.iCalUID,
    originalStartTime: {
      dateTime: event.originalStartTime
        ? moment(
            event.originalStartTime.dateTime
              ? event.originalStartTime.dateTime
              : event.originalStartTime.date
          ).unix()
        : moment(event.start.dateTime ? event.start.dateTime : event.start.date).unix(),
      timezone:
        event.originalStartTime && event.originalStartTime.timeZone
          ? event.originalStartTime.timeZone
          : myCalendar.timeZone,
    },
    owner: email,
    providerType: GOOGLE_PROVIDER,
    recurringEventId: event.recurringEventId ? event.recurringEventId : '',
    start: {
      dateTime: moment(event.start.dateTime ? event.start.dateTime : event.start.date).unix(),
      timezone: event.start.timeZone ? event.start.timeZone : myCalendar.timeZone,
    },
    summary: event.summary ? event.summary : 'Untitled Event',
    updated: 0,
    iCALString: '',
    caldavType: '',
    caldavUrl: '',
  };
};

const parseGoogleCalendar = (myCalendar, email) => {
  return {
    calendarId: myCalendar.id,
    checked: true,
    description: myCalendar.description ? myCalendar.description : '',
    name: myCalendar.summary,
    ownerId: email, // gmail of owner, can be retrieved after integrating with AccountStore
    providerType: GOOGLE_PROVIDER,
    timezone: myCalendar.timeZone,
    url: '',
  };
};
/**
 * recursion via pagetoken to retrieve all possible single events
 */
const fetchRecurrenceWithToken = async (
  services,
  myCalendar,
  upperBoundDate,
  lowerBoundDate,
  nextPageToken,
  allRecurrences
) => {
  const res = await services.events.list({
    calendarId: myCalendar.id,
    timeMax: upperBoundDate.toISOString(),
    timeMin: lowerBoundDate.toISOString(),
    maxResults: 2500,
    ...(nextPageToken && { pageToken: nextPageToken }),
  });
  allRecurrences = [...allRecurrences, ...res.data.items];
  if (res.data.nextPageToken) {
    console.log(res.data.nextPageToken);
    return await fetchRecurrenceWithToken(
      services,
      myCalendar,
      upperBoundDate,
      lowerBoundDate,
      res.data.nextPageToken,
      allRecurrences
    );
  } else {
    return allRecurrences;
  }
};

/**
 * recursion via pagetoken to retrieve all possible single events
 */
const fetchEventsWithToken = async (
  services,
  myCalendar,
  upperBoundDate,
  lowerBoundDate,
  nextPageToken,
  allEvents
) => {
  const res = await services.events.list({
    calendarId: myCalendar.id,
    singleEvents: true,
    timeMax: upperBoundDate.toISOString(),
    timeMin: lowerBoundDate.toISOString(),
    orderBy: 'startTime',
    maxResults: 2500,
    ...(nextPageToken && { pageToken: nextPageToken }),
  });
  console.log('res', res);
  console.log('res.data.items', res.data.items);
  allEvents = [...allEvents, ...res.data.items];
  if (res.data.nextPageToken) {
    return await fetchEventsWithToken(
      services,
      myCalendar,
      upperBoundDate,
      lowerBoundDate,
      res.data.nextPageToken,
      allEvents
    );
  } else {
    return allEvents;
  }
};
export const fetchGmailEvents = async selectedYear => {
  // below line of code will be in use once production client id is ready, hardcoded gmail accounts are used for now
  // const gmailAccounts = AccountStore.accounts().filter(account => account.provider === 'gmail');
  // gmailAccounts.forEach(gmailAccount => {
  let gmailAccountAddress = 'piadruids@gmail.com';
  //  fetchGmailAccount(gmailAccount)
  //  do the fetch stuff from below
  // })
  const services = await fetchGmailAccount('account info');
  const authObject = {
    providerType: GOOGLE_PROVIDER,
    caldavType: '',
    username: gmailAccountAddress,
    password: '',
  };
  Actions.setAuth(authObject, GOOGLE_PROVIDER);
  const calendarResults = await services.calendarList.list({
    minAccessRole: 'owner',
  });
  const calendar = calendarResults.data.items;
  const upperBoundDate = moment.tz([selectedYear, 11, 31], 'GMT');
  const lowerBoundDate = moment.tz([selectedYear, 0, 1], 'GMT');
  console.log(calendar);
  const parsedCalendars = calendar.map(calendar =>
    parseGoogleCalendar(calendar, gmailAccountAddress)
  );
  syncGoogleLocalData(parsedCalendars, SYNC_CALENDAR_LISTS);
  let eventResults = [];
  for (const myCalendar of calendar) {
    const allEventsInSingleCalendar = await fetchEventsWithToken(
      services,
      myCalendar,
      upperBoundDate,
      lowerBoundDate,
      null,
      []
    );
    let duplicateIcalUIDChecker = new Set();
    eventResults.push(
      allEventsInSingleCalendar.map(event => {
        // No way to directly find out master event of recurring events,
        // hence current soln: order by starttime, earliest event that doesn't have duplicated iCalUID and has recurringEventId is the master event.
        if (event.recurringEventId && !duplicateIcalUIDChecker.has(event.iCalUID)) {
          duplicateIcalUIDChecker.add(event.iCalUID);
          return parseGoogleEvent(event, myCalendar, true, gmailAccountAddress);
        } else {
          return parseGoogleEvent(event, myCalendar, false, gmailAccountAddress);
        }
      })
    );
  }
  console.log(eventResults);
  let flatData = [];
  console.log(eventResults);
  eventResults.map(arrOfEvents => (flatData = [...flatData, ...arrOfEvents]));
  syncGoogleLocalData(flatData, SYNC_CALENDAR_DATA, selectedYear);

  // Retrieve recurring events from server and update events in reflux with the RRULE needed for UI display
  let allRecurrenceList = [];
  for (const myCalendar of calendar) {
    let recurrenceList = {};
    const recurrences = await fetchRecurrenceWithToken(
      services,
      myCalendar,
      upperBoundDate,
      lowerBoundDate,
      null,
      []
    );
    console.log(recurrences);
    recurrences.map(recurEvent => {
      recurEvent.recurrence
        ? (recurrenceList = { ...recurrenceList, [recurEvent.iCalUID]: recurEvent.recurrence[0] })
        : null;
    });
    allRecurrenceList.push(recurrenceList);
  }
  allRecurrenceList.map(obj => {
    for (let iCalUID in obj) {
      console.log(iCalUID);
      Actions.updateCalendarData(
        GOOGLE_PROVIDER,
        iCalUID,
        { iCALString: obj[iCalUID] },
        UPDATE_ICALSTRING
      );
    }
  });
};
