import {
  CALDAV_PROVIDER,
  DELETE_SINGLE_EVENT,
  GOOGLE_PROVIDER,
  ICLOUD_ACCOUNT,
  ICLOUD_URL,
  SYNC_CALENDAR_DATA,
  SYNC_CALENDAR_LISTS,
  SYNC_RECURRENCE_PATTERN,
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
  Actions.setAuth(authObject, ICLOUD_ACCOUNT);
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

const parseGoogleEvent = (event, myCalendar) => {
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
    isAllDay: event.date,
    isMaster: undefined,
    isRecurring: event.recurringEventId ? true : false,
    location: event.location,
    organizer: event.organizer ? event.organizer.email : '',
    originalId: event.iCalUID,
    originalStartTime: {
      dateTime: moment(event.start.dateTime ? event.start.dateTime : event.start.date).unix(),
      timezone: event.start.timeZone ? event.start.timeZone : myCalendar.timeZone,
    },
    owner: event.creator ? event.creator.email : '',
    providerType: GOOGLE_PROVIDER,
    recurringEventId: event.recurringEventId ? event.recurringEventId : '',
    start: {
      dateTime: moment(event.start.dateTime ? event.start.dateTime : event.start.date).unix(),
      timezone: event.start.timeZone ? event.start.timeZone : myCalendar.timeZone,
    },
    summary: event.summary ? event.summary : '',
    updated: 0,
    // CALDAV Fields: Not relevant
    iCALString: '',
    caldavType: '',
    caldavUrl: '',
  };
};

const parseGoogleCalendar = myCalendar => {
  return {
    calendarId: myCalendar.id,
    checked: true,
    description: myCalendar.description ? myCalendar.description : '',
    name: myCalendar.summary,
    ownerId: '', // gmail of owner, can be retrieved after integrating with AccountStore
    providerType: GOOGLE_PROVIDER,
    timezone: myCalendar.timeZone,
    url: '',
  };
};

// export const fetchGmailEvents = async selectedYear => {
//   const calendar = await fetchGmailAccount('placeholder');
//   const calendarResults = new Promise((resolve, reject) => {
//     calendar.calendarList.list(
//       {
//         minAccessRole: 'owner',
//       },
//       (err, res) => {
//         if (err) reject(err);
//         const calendarList = res.data.items;
//         if (calendarList.length) {
//           resolve(calendarList);
//         }
//       }
//     );
//   });
//   syncGoogleLocalData(data.events, SYNC_CALENDAR_DATA, selectedYear);
//   calendarResults.then(data => {
//     const parsedCalendars = data.map(myCalendar => parseGoogleCalendar(myCalendar));
//     syncGoogleLocalData(parsedCalendars, SYNC_CALENDAR_LISTS);
//     const upperBoundDate = moment.tz([selectedYear + 1, 11, 31], 'GMT');
//     const lowerBoundDate = moment.tz([selectedYear - 1, 0, 1], 'GMT');
//     // MAX RESULTS IS 250 events fetched, TODO: use pageToken to get all events
//     const subResults = new Promise((resolve, reject) => {
//       let sub = [];
//       calendar.events.list(
//         {
//           calendarId: myCalendar.id,
//           singleEvents: true,
//           timeMax: upperBoundDate.toISOString(),
//           timeMin: lowerBoundDate.toISOString(),
//         },
//         (err, res) => {
//           if (err) reject(err);
//           const events = res.data.items;
//           console.log(events);
//           if (events.length) {
//             events.map(event => {
//               sub.push(parseGoogleEvent(event, myCalendar));
//             });
//           }
//         }
//       );
//       resolve(sub);
//     });
//   });
// };

export const fetchGmailEvents = async selectedYear => {
  const calendar = await fetchGmailAccount('placeholder');
  const calendarResults = new Promise((resolve, reject) => {
    calendar.calendarList.list(
      {
        minAccessRole: 'owner',
      },
      (err, res) => {
        if (err) reject(err);
        const calendarList = res.data.items;
        if (calendarList.length) {
          resolve(calendarList);
        }
      }
    );
  });
  calendarResults.then(data => {
    console.log(data);
    const parsedCalendars = data.map(calendar => parseGoogleCalendar(calendar));
    syncGoogleLocalData(parsedCalendars, SYNC_CALENDAR_LISTS);
    const eventResults = data.map(myCalendar => {
      const upperBoundDate = moment.tz([selectedYear + 1, 11, 31], 'GMT');
      const lowerBoundDate = moment.tz([selectedYear - 1, 0, 1], 'GMT');
      return new Promise((resolve, reject) => {
        // MAX RESULTS IS 250 events fetched, TODO: use pageToken to get all events
        calendar.events.list(
          {
            calendarId: myCalendar.id,
            singleEvents: true,
            timeMax: upperBoundDate.toISOString(),
            timeMin: lowerBoundDate.toISOString(),
          },
          (err, res) => {
            if (err) reject(err);
            const events = res.data.items;
            if (events.length) {
              resolve(events.map(event => parseGoogleEvent(event, myCalendar)));
            }
          }
        );
      });
    });
    Promise.all(eventResults).then(data => {
      let flatData = [];
      console.log(flatData);
      data.map(arrOfEvents => (flatData = [...flatData, ...arrOfEvents]));
      syncGoogleLocalData(flatData, SYNC_CALENDAR_DATA, selectedYear);
    });
  });
};
