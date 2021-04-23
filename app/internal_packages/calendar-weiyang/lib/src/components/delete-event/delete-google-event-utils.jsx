import { Actions, AccountStore } from 'mailspring-exports';
import {
  DELETE_ALL_RECURRING_EVENTS,
  DELETE_FUTURE_RECCURRING_EVENTS,
  DELETE_SINGLE_EVENT,
  GOOGLE_PROVIDER,
  NOTHING_TO_RESOLVE,
} from '../constants';
import { fetchGmailAccount } from '../fetch-event/utils/get-caldav-account';

export const deleteGoogleSingle = async payload => {
  const { data, user } = payload;
  // account to be used to fetch gmail account once production client id is ready to be used
  const [account] = AccountStore.accounts().filter(
    account => account.emailAddress == user.username && account.provider === 'gmail'
  );
  const services = await fetchGmailAccount(account);
  services.events.delete(
    {
      calendarId: data.calendarId,
      eventId: data.id,
      //sendUpdates: send notif to guests
    },
    (err, res) => {
      // empty response if successful
      if (err) return err;
      Actions.deleteCalendarData(GOOGLE_PROVIDER, data.id, DELETE_SINGLE_EVENT);
    }
  );
};

export const deleteGoogleAll = async payload => {
  const { data, user } = payload;
  // account to be used to fetch gmail account once production client id is ready to be used
  const [account] = AccountStore.accounts().filter(
    account => account.emailAddress == user.username && account.provider === 'gmail'
  );
  const services = await fetchGmailAccount(account);
  services.events.delete(
    {
      calendarId: data.calendarId,
      eventId: data.recurringEventId,
    },
    (err, res) => {
      if (err) return err;
      Actions.deleteCalendarData(GOOGLE_PROVIDER, data.iCalUID, DELETE_ALL_RECURRING_EVENTS);
    }
  );
};
const generateDeleteFuturePattern = (recurringPatternToEdit, data, services, user) => {
  let [rrule] = recurringPatternToEdit.recurrence;
  let results = null;
  if (rrule.match(/COUNT/g)) {
    // To edit the COUNT rrule, we order fetched events by start time, search for corresponding event id that user selected event
    // The index in the ordered array will be the new COUNT
    results = new Promise((resolve, reject) => {
      // MAX RESULTS IS 2500 events fetched, TODO: use pageToken to get all events
      // page token isn't used for this case as it is virtually impossible(there is still a chance though) that
      // a user would exceed the 2500 limit for a single recurring event. If page token is used, one must
      // take note that there might be a chance of infinite recursion if RRULE is infinite, ie no UNTIL/COUNT rrule.
      services.events.list(
        {
          calendarId: data.calendarId,
          iCalUID: data.iCalUID,
          orderBy: 'startTime',
          showDeleted: true, // ensure ordering by including deleted to make sure COUNT is correct
          singleEvents: true,
          maxResults: 2500,
        },
        (err, res) => {
          if (err) reject(err);
          let newCount = null;
          let items = res.data.items;
          items.forEach((event, idx) => (event.id === data.id ? (newCount = idx) : null));
          if (newCount === null) {
            reject(
              'Unable to find corresponding id while deleting google future recurrence events'
            );
          } else if (newCount === 0) {
            // delete all event
            const payload = { data, user };
            deleteGoogleAll(payload);
            resolve(NOTHING_TO_RESOLVE);
          } else {
            const updatedCountRrule = 'COUNT=' + newCount.toString();
            const originalCountRrule = rrule.match(/COUNT=[1-9]\d*/g);
            recurringPatternToEdit.recurrence = [
              rrule.replace(originalCountRrule, updatedCountRrule),
            ];
            resolve(recurringPatternToEdit);
          }
        }
      );
    });
  } else {
    // if UNTIL rrule, or infinite rrule(neither UNTIL nor COUNT), we set UNTIL in both
    results = new Promise((resolve, reject) => {
      // MAX RESULTS IS 2500 events fetched, TODO: use pageToken to get all events
      services.events.list(
        {
          calendarId: data.calendarId,
          iCalUID: data.iCalUID,
          orderBy: 'startTime',
          singleEvents: true,
          maxResults: 1,
        },
        (err, res) => {
          if (err) reject(err);
          let firstEvent = null;
          const items = res.data.items;
          // 'items' will definitely contain at least 1 event, because user is trying to delete at least 1 event
          if (items.length > 0) {
            firstEvent = items[0];
          } else {
            reject('Unable to find the first event of selected iCalUID');
          }
          // pre-edited datetime
          const originalStartTime = firstEvent.originalStartTime.dateTime
            ? firstEvent.originalStartTime.dateTime
            : firstEvent.originalStartTime.date;
          // edited datetime
          const currentDateTime = firstEvent.start.dateTime
            ? firstEvent.start.dateTime
            : firstEvent.start.date;
          // choose the earliest datetime out of original&latest from first event fetched from server
          const dateTime =
            new Date(originalStartTime).getTime() > new Date(currentDateTime).getTime()
              ? currentDateTime
              : originalStartTime;
          let firstEventUnix = new Date(dateTime).getTime() / 1000; // convert from millis to seconds
          console.log(firstEventUnix);
          // choose earliest datetime out of original&latest from local db
          const localDataStartTime =
            data.start.dateTime > data.originalStartTime.dateTime
              ? data.originalStartTime.dateTime
              : data.start.dateTime;
          if (localDataStartTime <= firstEventUnix) {
            // delete all events - user clicked the very first event for deletion
            const payload = { data, user };
            deleteGoogleAll(payload);
            resolve(NOTHING_TO_RESOLVE);
          } else {
            let updatedUntilRrule = new Date(localDataStartTime * 1000 - 1)
              .toISOString()
              .replace(/(-|:|\....)/g, '');
            updatedUntilRrule = 'UNTIL=' + updatedUntilRrule;
            if (rrule.match(/UNTIL=/g)) {
              const nonAllDayRrule = rrule.match(
                /UNTIL=\d{4}(0[1-9]|1[0-2])(0[1-9]|[1-2]\d|3[0-1])T([0-1]\d|2[0-3])[0-5]\d[0-5]\dZ?/g
              );
              const allDayRrule = rrule.match(/UNTIL=(20\d{2})(\d{2})(\d{2})/g);
              // all day and non day events has different datetime rrule
              recurringPatternToEdit.recurrence = [
                rrule.replace(
                  nonAllDayRrule === null ? allDayRrule : nonAllDayRrule,
                  updatedUntilRrule
                ),
              ];
            } else {
              // deleting infinite recurring events by adding a UNTIL rrule
              recurringPatternToEdit.recurrence = [rrule + ';' + updatedUntilRrule + ';'];
            }
            resolve(recurringPatternToEdit);
          }
        }
      );
    });
  }
  return results;
};

export const deleteGoogleFuture = async payload => {
  const { data, user } = payload;
  // account to be used to fetch gmail account once production client id is ready to be used
  const [account] = AccountStore.accounts().filter(
    account => account.emailAddress == user.username && account.provider === 'gmail'
  );
  const services = await fetchGmailAccount(account);
  const recurringResults = new Promise((resolve, reject) => {
    services.events.list(
      {
        calendarId: data.calendarId,
        iCalUID: data.iCalUID,
      },
      (err, res) => {
        if (err) reject(err);
        console.log(res.data.items);
        const [foundRecurItem] = res.data.items.filter(item => item.recurrence !== undefined);
        if (foundRecurItem === undefined) {
          reject('Unable to find recurrence while deleting future events');
        }
        resolve(foundRecurItem);
      }
    );
  });
  recurringResults
    .then(recurringPatternToEdit => {
      return generateDeleteFuturePattern(recurringPatternToEdit, data, services, user);
    })
    .then(res => {
      console.log(res);
      if (res !== NOTHING_TO_RESOLVE) {
        services.events.update(
          {
            calendarId: data.calendarId,
            eventId: data.recurringEventId,
            requestBody: res,
          },
          (err, res) => {
            if (err) return err;
            Actions.deleteCalendarData(
              GOOGLE_PROVIDER,
              data.recurringEventId,
              DELETE_FUTURE_RECCURRING_EVENTS,
              data.start.dateTime
            );
          }
        );
      }
    })
    .catch(err => {
      throw err;
    });
};
