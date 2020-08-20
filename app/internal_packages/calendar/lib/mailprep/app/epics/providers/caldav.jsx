import { from, of } from 'rxjs';
import moment from 'moment';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';
import uuidv4 from 'uuid';
import ICAL from 'ical.js';

import { getEventsSuccess, getEventsFailure, postEventSuccess } from '../../actions/events';
import {
  GET_CALDAV_EVENTS_BEGIN,
  EDIT_CALDAV_SINGLE_EVENT_BEGIN,
  EDIT_CALDAV_ALL_EVENT_BEGIN,
  EDIT_CALDAV_FUTURE_EVENT_BEGIN,
  DELETE_CALDAV_SINGLE_EVENT_BEGIN,
  DELETE_CALDAV_ALL_EVENT_BEGIN,
  DELETE_CALDAV_FUTURE_EVENT_BEGIN,
  CREATE_CALDAV_EVENTS_BEGIN
} from '../../actions/providers/caldav';
import { retrieveStoreEvents } from '../../actions/db/events';

import * as Credentials from '../../utils/credentials';
import { asyncGetAllCalDavEvents } from '../../utils/client/caldav';
import * as IcalStringBuilder from '../../utils/icalStringBuilder';
import * as PARSER from '../../utils/parser';
import * as Providers from '../../utils/constants';
import * as dbEventActions from '../../sequelizeDB/operations/events';
import * as dbRpActions from '../../sequelizeDB/operations/recurrencepatterns';

const dav = require('dav');

export const beginGetCaldavEventsEpics = (action$) =>
  action$.pipe(
    ofType(GET_CALDAV_EVENTS_BEGIN),
    mergeMap((action) =>
      from(
        new Promise(async (resolve, reject) => {
          if (action.payload === undefined) {
            reject(getEventsFailure('Caldav user undefined!!'));
          }
          try {
            const allCalDavUserEventsPromise = action.payload.map((user) =>
              asyncGetAllCalDavEvents(user.email, user.password, user.principalUrl, user.caldavType)
            );
            const allCalDavUserEvents = await Promise.all(allCalDavUserEventsPromise);
            resolve(allCalDavUserEvents);
          } catch (e) {
            console.log(e);
            throw e;
          }
        })
      ).pipe(
        map((resp) => getEventsSuccess(resp, Providers.CALDAV, action.payload)),
        catchError((error) => of(error))
      )
    )
  );

export const createCalDavEventEpics = (action$) =>
  action$.pipe(
    ofType(CREATE_CALDAV_EVENTS_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.auth));
        }),
        createCalDavEvent(action.payload)
          .then((resp) =>
            postEventSuccess(
              [resp],
              [action.payload.auth],
              action.payload.providerType,
              action.payload.auth.email,
              action.payload.tempEvents
            )
          )
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const editCalDavSingleEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_CALDAV_SINGLE_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        editCalDavSingle(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const editCalDavAllRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_CALDAV_ALL_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        editCalDavAllRecurrenceEvents(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const editCalDavFutureRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(EDIT_CALDAV_FUTURE_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        editCalDavAllFutureRecurrenceEvents(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const deleteCalDavSingleEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_CALDAV_SINGLE_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        deleteCalDavSingle(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const deleteCalDavAllRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_CALDAV_ALL_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        deleteCalDavAllRecurrenceEvents(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

export const deleteCalDavFutureRecurrenceEventEpics = (action$) =>
  action$.pipe(
    ofType(DELETE_CALDAV_FUTURE_EVENT_BEGIN),
    mergeMap((action) =>
      from([
        new Promise((resolve, reject) => {
          resolve(retrieveStoreEvents(action.payload.user));
        }),
        deleteCalDavAllFutureRecurrenceEvents(action.payload)
          .then(() => retrieveStoreEvents(action.payload.user))
          .catch((err) => console.log(err))
      ]).mergeAll()
    )
  );

const createCalDavEvent = async (payload) => {
  const debug = false;

  // Parse user information from account layer to dav object.
  const xhrObject = new dav.transport.Basic(
    new dav.Credentials({
      username: payload.auth.email,
      password: payload.auth.password
    })
  );

  // console.log(payload);
  // console.log(xhrObject);
  // debugger;

  // Final iCalString to post out
  let newiCalString = '';

  // Caldav calendar link
  // first login = payload.calendar.url, auto login = payload.calendar.calendarUrl (unsure why is there a difference in payload)
  const caldavUrl = payload.calendar.calendarUrl
    ? payload.calendar.calendarUrl
    : payload.calendar.url;

  // // Need calendar system to handle what URL is being parsed. For now, we hard code.
  // ICloud Calendar link
  // const caldavUrl = 'https://caldav.icloud.com/11159534163/calendars/home/';

  // // Yahoo Calendar Link
  // const caldavUrl =
  //   'https://caldav.calendar.yahoo.com/dav/oj242dvo2jivt6lfbyxqfherdqulvbiaprtaw5kv/Calendar/Fong%20Zhi%20Zhong/';

  const newETag = uuidv4();
  const { data } = payload;

  // Builds additional fields that are missing specifically for caldav.
  data.id = uuidv4();
  data.originalId = uuidv4();

  // Repopulate certain fields that are missing
  data.caldavUrl = caldavUrl;
  // data.created = moment().format('YYYY-MM-DDTHH:mm:ssZ');
  // data.updated = moment().format('YYYY-MM-DDTHH:mm:ssZ');
  data.iCalUID = data.originalId;
  // data.owner = payload.auth.email;
  data.providerType = Providers.CALDAV;
  data.caldavType = payload.auth.caldavType;
  // data.isRecurring = data.rrule !== '';
  // console.log(data);
  // debugger;

  if (payload.data.isRecurring) {
    const newRecurrencePattern = {};
    const updatedId = uuidv4();
    const updatedUid = uuidv4();

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

      // if (Array.isArray(jsonRecurr.BYMONTHDAY)) {
      //   jsonRecurr.BYMONTHDAY = `${jsonRecurr.BYMONTHDAY.join(',')}`;
      // } else if (jsonRecurr.BYMONTHDAY === undefined) {
      //   jsonRecurr.BYMONTHDAY = '';
      // }
    }

    Object.assign(newRecurrencePattern, {
      id: updatedId,
      originalId: updatedUid,
      // // // Temp take from the recurrence master first, will take from the UI in future.
      freq,
      interval: jsonRecurr.interval,
      numberOfRepeat: jsonRecurr.count !== undefined ? jsonRecurr.count : 0,
      until: jsonRecurr.until !== undefined ? jsonRecurr.until : null,
      // exDates: pattern.exDates.filter((exDate) =>
      //   moment(exDate).isAfter(moment(data.start.dateTime))
      // ),
      // recurrenceIds: pattern.recurrenceIds.filter((recurrId) =>
      //   moment(recurrId).isAfter(moment(data.start.dateTime))
      // ),
      recurringTypeId: data.start.dateTime.unix(),
      iCalUID: updatedUid,
      byWeekDay: jsonRecurr.BYDAY !== undefined ? jsonRecurr.BYDAY : '',
      byMonth: jsonRecurr.BYMONTH !== undefined ? jsonRecurr.BYMONTH : '',
      // eslint-disable-next-line no-nested-ternary
      byMonthDay: jsonRecurr.BYMONTHDAY !== undefined ? jsonRecurr.BYMONTHDAY : '',
      byYearDay: '',
      bySetPos: jsonRecurr.BYSETPOS !== undefined ? jsonRecurr.BYSETPOS : ''
    });

    // Creates Recurring event.
    newiCalString = IcalStringBuilder.buildICALStringCreateRecurEvent(payload.data, jsonRecurr);
  } else {
    data.isRecurring = false;

    // Creates non Recurring event.
    newiCalString = IcalStringBuilder.buildICALStringCreateEvent(payload.data);
  }
  data.iCALString = newiCalString;

  const calendar = new dav.Calendar();
  calendar.url = caldavUrl;

  const addCalendarObject = {
    data: newiCalString,
    filename: `${newETag}.ics`,
    xhr: xhrObject
  };

  // console.log(calendar);
  // debugger;
  const addResult = await dav.createCalendarObject(calendar, addCalendarObject);

  if (debug) {
    console.log('(postEventsCalDav)', addResult);
  }

  // console.log(addResult);
  // debugger;

  await Promise.all(
    payload.tempEvents.map((tempEvent) => dbEventActions.deleteEventById(tempEvent.id))
  );

  // You have to do a full sync as the .ics endpoint might not be valid
  const allEvents = await asyncGetAllCalDavEvents(
    payload.auth.email,
    payload.auth.password,
    payload.auth.principalUrl,
    payload.auth.caldavType
  );

  // Etag is a real problem here LOL. This does NOT WORK
  const justCreatedEvent = allEvents.filter((e) => e.originalId === data.originalId)[0];
  justCreatedEvent.isMaster = true;
  const appendedResult = await dbEventActions.insertEventsIntoDatabase(justCreatedEvent);
  return allEvents;
};

const editCalDavSingle = async (payload) => {
  const debug = false;
  try {
    let iCalString;

    // #region Getting information
    // Get Information (Sequlize)
    const data = await dbEventActions.getOneEventById(payload.id);
    const { user } = payload;
    // #endregion

    // #region CalDav sending details
    // Needed information for deleting of Caldav information.
    // etag - Event tag, there is the same for calendar if needed.
    //   UUID generated by caldav servers
    // caldavUrl - URL of specific endpoint for deleting single or recurrring events
    const { etag, caldavUrl } = data;

    // Parse user information from account layer to dav object.
    const xhrObject = new dav.transport.Basic(
      new dav.Credentials({
        username: user.email,
        password: user.password
      })
    );
    // Ensure etag is set in option for no 412 http error.
    const option = {
      xhr: xhrObject
    };
    // #endregion

    // #region Updating of Single event, based of Recurring or not
    if (payload.isRecurring) {
      if (debug) {
        const resultCheck = await dbRpActions.getOneRpByOId(data.iCalUID);
        console.log(resultCheck.toJSON());
      }

      dbRpActions.addRecurrenceIdsByOid(data.iCalUID, data.start.dateTime);
      const recurrence = await dbRpActions.getOneRpByOId(data.iCalUID);
      const recurrencePattern = recurrence.toJSON();

      // Builds the iCal string
      iCalString = IcalStringBuilder.buildICALStringUpdateRecurEvent(
        recurrencePattern,
        data,
        payload
      );
      if (debug) {
        console.log(iCalString);
      }
      // console.log(iCalString);
      // debugger;
      // Due to how there is no master,
      // We need to ensure all events that are part of the series
      // have the same iCal string such that we do not have inconsistency.
      // Run a db query, to update them all to the new iCalString.
      await dbEventActions.updateEventiCalString(data.iCalUID, iCalString);
    } else if (!payload.isRecurring && payload.updatedIsRecurring) {
      // if event is originally single and is going to become recurring
      iCalString = IcalStringBuilder.buildICALStringUpdateSingleEvent(
        payload,
        data,
        payload.updatedRrule
      );
      // console.log(iCalString);
      // debugger;
    } else {
      iCalString = IcalStringBuilder.buildICALStringUpdateSingleEvent(payload, data);
      // console.log(iCalString);
      // debugger;
    }
    // #endregion

    // #region Updating Calendar, Local Side
    // single -> recurring event
    if (!payload.isRecurring && payload.updatedIsRecurring) {
      const masterEvent = data; // data = event object retrieved from db
      masterEvent.isRecurring = 1;
      masterEvent.isMaster = 1;
      masterEvent.iCALString = iCalString;
      console.log(masterEvent);
      // debugger;
      // eslint-disable-next-line no-underscore-dangle
      const rruleObj = ICAL.Recur._stringToData(payload.updatedRrule);
      // debugger;
      let untilJson;
      if (rruleObj.until !== undefined) {
        untilJson = rruleObj.until.toJSON();
        untilJson.month -= 1; // Month needs to minus one due to start date
      }
      const recurrencePattern = PARSER.parseRecurrenceEvents([
        {
          eventData: masterEvent,
          recurData: {
            rrule: {
              stringFormat: payload.updatedRrule,
              freq: rruleObj.freq,
              interval: rruleObj.interval !== undefined ? rruleObj.interval : 1,
              until: untilJson,
              count: rruleObj.count
            },
            exDates: [],
            recurrenceIds: [],
            modifiedThenDeleted: false,
            iCALString: payload.updatedRrule
          }
        }
      ]);
      const expandedRecurrEvents = PARSER.parseRecurrence(recurrencePattern[0], masterEvent);
      await dbRpActions.insertOrUpdateRp(recurrencePattern[0]);
      await Promise.all(
        expandedRecurrEvents.map((event) => dbEventActions.insertEventsIntoDatabase(event))
      );
    } else {
      // all other edit single event
      await dbEventActions.updateEventById(payload.id, {
        summary: payload.title,
        allDay: payload.allDay
      });
    }

    if (debug) {
      const alldata = await dbEventActions.getAllEvents();
      console.log(alldata.map((e) => e.toJSON()));
    }
    // #endregion

    // #region Updating Calendar, Server Side
    // To delete a single recurring pattern, the calendar object is different.
    // So we add the string into the object we are PUT-ing to the server
    const calendarObject = {
      url: caldavUrl,
      calendarData: iCalString
    };
    // Result will throw error, we can do a seperate check here if needed.
    const result = await dav.updateCalendarObject(calendarObject, option);
    if (debug) {
      console.log(result);
    }
    // #endregion
  } catch (error) {
    console.log('(editCalDavSingle) Error, retrying with pending action!', error, payload.id);
  }

  // retrieve event from server and force resync the db
  // #region
  const allEvents = await asyncGetAllCalDavEvents(
    payload.user.email,
    payload.user.password,
    payload.user.principalUrl,
    payload.user.caldavType
  );

  // filter out events with the same iCalUID (under the same recurrence series)
  const updatedEvents = allEvents.filter((event) => event.iCalUID === payload.iCalUID);
  await Promise.all(updatedEvents.map((event) => dbEventActions.insertEventsIntoDatabase(event)));
  // #endregion

  payload.props.history.push('/');
  return {
    providerType: Providers.EXCHANGE,
    user: payload.user
  };
};

const editCalDavAllRecurrenceEvents = async (payload) => {
  const debug = false;
  try {
    // #region Getting information
    // Get Information (Sequlize)
    const data = await dbEventActions.getOneEventById(payload.id);
    const { user } = payload;
    // #endregion

    // #region CalDav sending details
    // Needed information for deleting of Caldav information.
    // etag - Event tag, there is the same for calendar if needed.
    //   UUID generated by caldav servers
    // caldavUrl - URL of specific endpoint for deleting single or recurrring events
    const { etag, caldavUrl } = data;

    // Parse user information from account layer to dav object.
    const xhrObject = new dav.transport.Basic(
      new dav.Credentials({
        username: user.email,
        password: user.password
      })
    );
    // Ensure etag is set in option for no 412 http error.
    const option = {
      xhr: xhrObject,
      etag
    };
    // #endregion

    // #region Generation of new iCalString & DB updating
    // For recurring events, we want to just add it to ex dates instead
    // Due to caldav nature, deleting an etag instead of updating results in deleting of
    // entire series.
    // Updating is done by pushing the entire iCal string to the server
    let iCalString = '';

    // recur -> single
    if (!payload.updatedIsRecurring) {
      // delete recurrencePattern
      await dbRpActions.deleteRpByiCalUID(data.iCalUID);

      // retrieve master
      const masterEvent = await dbEventActions.getMasterEventByRecurringEventId(
        data.recurringEventId
      );
      // delete non-master
      await dbEventActions.deleteAllNonMasterEventsByRecurringEventId(data.recurringEventId);

      // update iCal string
      iCalString = IcalStringBuilder.editICALStringRecurringToSingle(payload, masterEvent);
      console.log(iCalString);

      // update db
      await dbEventActions.updateEventById(payload.id, {
        summary: payload.title,
        description: payload.description,
        allDay: payload.allDay,
        start: payload.start,
        end: payload.end,
        location: payload.location,
        organizer: payload.organizer,
        attendee: payload.attendees,
        recurringEventId: null,
        isRecurring: false,
        isMaster: null,
        iCALString: iCalString
      });
    } else {
      // Get recurring pattern to build new iCal string for updating
      const recurrence = await dbRpActions.getOneRpByOId(data.iCalUID);
      const recurrencePattern = recurrence.toJSON();

      // eslint-disable-next-line no-underscore-dangle
      const jsonRecurr = ICAL.Recur._stringToData(payload.rrule);
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

      // Builds the iCal string
      iCalString = IcalStringBuilder.buildICALStringUpdateAllRecurEvent(jsonRecurr, data, payload);
      if (debug) {
        console.log(iCalString);
      }

      // Due to how there is no master,
      // We need to ensure all events that are part of the series
      // have the same iCal string such that we do not have inconsistency.
      // Run a db query, to update them all to the new iCalString.
      await dbEventActions.updateEventiCalString(data.iCalUID, iCalString);

      // However, we need to run an update on all the events that are not edited
      // to ensure that all the fields are updated
      // TO-DO, ADD MORE FIELDS HERE

      // const allSpecificRecurringEvent = await nonEditedRecurringEvent.exec();
      // console.log(allSpecificRecurringEvent);
      const allSpecificRecurringEvent = await dbEventActions.getAllEventByOriginalId(
        payload.originalId
      );

      const newData = allSpecificRecurringEvent
        .map((e) => e.toJSON())
        .filter((e) => {
          const dt = moment.tz(e.start.dateTime, e.start.timezone);
          for (let index = 0; index < recurrencePattern.recurrenceIds.length; index += 1) {
            const element = moment.tz(recurrencePattern.recurrenceIds[index], e.start.timezone);
            if (element.isSame(dt)) {
              return false;
            }
          }
          return true;
        });

      await Promise.all(
        newData.map(
          (e) =>
            dbEventActions.updateEventByiCalUIDandStartDateTime(
              payload.originalId,
              e.start.dateTime
            ),
          {
            summary: payload.title
          }
        )
      );
    }

    // #endregion

    // #region Updating Calendar, Server Side
    const calendarObject = {
      url: caldavUrl,
      calendarData: iCalString
    };

    // Result will throw error, we can do a seperate check here if needed.
    const result = await dav.updateCalendarObject(calendarObject, option);
    if (debug) {
      console.log(result);
    }
    // #endregion

    const allEvents = await dbEventActions.getAllEvents();
    const allRp = await dbRpActions.getAllRp();
    if (debug) {
      console.log(allEvents, allRp);
    }
  } catch (error) {
    console.log(
      '(editCalDavAllRecurrenceEvents) Error, retrying with pending action!',
      error,
      payload.id
    );
    // debugger;
  }
  payload.props.history.push('/');
  return {
    providerType: Providers.EXCHANGE,
    user: payload.user
  };
};

const editCalDavAllFutureRecurrenceEvents = async (payload) => {
  const debug = false;
  try {
    // #region Getting information
    // Get Information (Sequlize)
    const data = await dbEventActions.getOneEventById(payload.id);
    const { user } = payload;
    // #endregion

    // #region CalDav sending details
    // Needed information for deleting of Caldav information.
    // etag - Event tag, there is the same for calendar if needed.
    //   UUID generated by caldav servers
    // caldavUrl - URL of specific endpoint for deleting single or recurrring events
    const { etag, caldavUrl, calendarId, iCalUID } = data;

    // Parse user information from account layer to dav object.
    const xhrObject = new dav.transport.Basic(
      new dav.Credentials({
        username: user.email,
        password: user.password
      })
    );
    // Ensure etag is set in option for no 412 http error.
    const option = {
      xhr: xhrObject,
      etag
    };
    // #endregion

    // #region Recurrence Pattern updating
    const recurPattern = await dbRpActions.getOneRpByOId(data.iCalUID);
    const pattern = recurPattern.toJSON();
    if (debug) {
      console.log(recurPattern.toJSON());
    }

    const updatedId = uuidv4();
    const updatedUid = uuidv4();

    const oldRecurringPattern = {};
    const newRecurrencePattern = {};

    // eslint-disable-next-line no-underscore-dangle
    const jsonRecurr = ICAL.Recur._stringToData(payload.rrule);
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

      // if (Array.isArray(jsonRecurr.BYMONTHDAY)) {
      //   jsonRecurr.BYMONTHDAY = `${jsonRecurr.BYMONTHDAY.join(',')}`;
      // } else if (jsonRecurr.BYMONTHDAY === undefined) {
      //   jsonRecurr.BYMONTHDAY = '';
      // }
    }
    Object.assign(newRecurrencePattern, {
      id: updatedId,
      originalId: updatedUid,
      // // Temp take from the recurrence master first, will take from the UI in future.
      freq: pattern.freq,
      // interval: pattern.interval,
      interval: payload.recurrInterval,
      until: payload.untilDate,
      exDates: pattern.exDates
        .split(',')
        .map((str) => parseInt(str, 10))
        .filter((exDate) =>
          moment
            .tz(exDate * 1000, data.start.timezone)
            .isAfter(moment.tz(data.start.dateTime * 1000, data.start.timezone))
        )
        .join(','),
      recurrenceIds: pattern.recurrenceIds
        .split(',')
        .map((str) => parseInt(str, 10))
        .filter((recurrId) =>
          moment
            .tz(recurrId * 1000, data.start.timezone)
            .isAfter(moment.tz(data.start.dateTime * 1000, data.start.timezone))
        )
        .join(','),
      recurringTypeId: data.start.dateTime,
      iCalUID: updatedUid,
      rrule: jsonRecurr,
      byWeekNo: payload.byWeekNo.charAt(1),
      byWeekDay: jsonRecurr.BYDAY !== undefined ? jsonRecurr.BYDAY : '',
      byMonth: jsonRecurr.BYMONTH !== undefined ? jsonRecurr.BYMONTH : '',
      byMonthDay: jsonRecurr.BYMONTHDAY !== undefined ? jsonRecurr.BYMONTHDAY : ''
    });

    if (
      (pattern.until === undefined || pattern.until === null) &&
      (pattern.numberOfRepeats === undefined || pattern.numberOfRepeats === null)
    ) {
      // No end condition for this, figure out later LOL
    } else if (pattern.until === undefined || pattern.until === null) {
      // Parse deleted and edited instances over.
      const exDates = [];
      if (pattern.exDates !== undefined && pattern.exDates !== null) {
        if (typeof pattern.exDates === 'number') {
          exDates.push(pattern.exDates);
        } else {
          exDates.push(
            ...pattern.exDates
              .split(',')
              .map((str) => parseInt(str, 10))
              .filter((exDate) =>
                moment
                  .tz(exDate * 1000, data.start.timezone)
                  .isBefore(moment.tz(data.start.dateTime * 1000, data.start.timezone))
              )
          );
        }
      }

      const recurrenceIds = [];
      if (pattern.recurrenceIds !== undefined && pattern.recurrenceIds !== null) {
        if (typeof pattern.recurrenceIds === 'number') {
          recurrenceIds.push(pattern.recurrenceIds);
        } else {
          recurrenceIds.push(
            ...pattern.recurrenceIds
              .split(',')
              .map((str) => parseInt(str, 10))
              .filter((recurrenceId) =>
                moment
                  .tz(recurrenceId * 1000, data.start.timezone)
                  .isBefore(moment.tz(data.start.dateTime * 1000, data.start.timezone))
              )
          );
        }
      }
      // The idea here is to first update the old recurrence pattern with until
      // so that we can generate a ruleset as the freq could be a daily/weekly/monthly
      // or have some weird interval.
      // Once we have done that, we filter the exdate and recurrenceids so that the old pattern
      // does not have the extra dates as the series has shortened.
      // As the start date is the same, we set the recurringtypeId as the same.
      // In the future, I need to change the freq and interval based off the UI here.
      // We also need to ensure that the id is the same due to updating of database.
      // Originalid is the caldavUID given by the server.
      Object.assign(oldRecurringPattern, {
        id: pattern.id,
        originalId: pattern.originalId,
        freq: pattern.freq,
        interval: pattern.interval,
        exDates: exDates.join(','),
        recurrenceIds: recurrenceIds.join(','),
        recurringTypeId: pattern.recurringTypeId,
        until: moment
          .tz(data.start.dateTime * 1000, data.start.timezone)
          .subtract(1, 'second')
          .unix(),
        isCount: true,
        byMonthDay: payload.byMonthDay,
        byWeekDay: payload.byWeekDay,
        byWeekNo: payload.byWeekNo
      });

      // We build the ruleset based off the temp pattern, and as we dealing with count,
      // We use the all function to get the length of the input.
      // Parsed into Json for readability and able to be manipulated. RxDocs are not mutable.
      // As we editing this event, we need the minus one.
      const ruleSet = PARSER.buildRuleSet(
        oldRecurringPattern,
        pattern.recurringTypeId,
        data.start.timezone
      );
      // Recur Dates only hold events and not exceptions.
      const recurDates = ruleSet.all().map((date) => date.toJSON());
      // const seriesEndCount = pattern.numberOfRepeats - recurDates.length + 1;
      Object.assign(newRecurrencePattern, {
        numberOfRepeats: payload.untilAfter, // New Rp needs to repeat from that day till the next.
        isCount: true
      });

      // Delete removes the definition as we want to ensure the UI uses count.
      // It checks via undefined, which deletes makes it.
      delete oldRecurringPattern.until;

      // Reassign the values of old pattern, Safety set the exdates and recurrenceids again.
      Object.assign(oldRecurringPattern, {
        // numberOfRepeats: recurDates.length + oldRecurringPattern.recurrenceIds.length, // Old RP needs to repeat till the selected event minus one.
        numberOfRepeats: recurDates.length - 1,
        isCount: true
      });

      await dbRpActions.updateRpByOid(data.iCalUID, {
        numberOfRepeats: recurDates.length - 1, // Old RP needs to repeat till the selected event minus one.
        isCount: true
      });
    } else {
      // Here, we assign the end condition for our recurrence pattern.
      // We set the until, and the UI will take care of the rest.
      Object.assign(newRecurrencePattern, {
        until: pattern.until,
        isCount: false
      });

      // Minus one day, and format it, to ensure that the until is properly formatted.
      // Minus one day due to how expanding of event works for caldav.
      const updatedUntil = moment
        .tz(data.start.dateTime * 1000, data.start.timezone)
        .subtract(1, 'second')
        .unix();

      // Parse deleted and edited instances over.
      const exDates = [];
      if (pattern.exDates !== undefined && pattern.exDates !== null) {
        if (typeof pattern.exDates === 'number') {
          exDates.push(pattern.exDates);
        } else {
          exDates.push(
            ...pattern.exDates
              .split(',')
              .map((str) => parseInt(str, 10))
              .filter((exDate) =>
                moment
                  .tz(exDate * 1000, data.start.timezone)
                  .isBefore(moment.tz(data.start.dateTime * 1000, data.start.timezone))
              )
          );
        }
      }

      const recurrenceIds = [];
      if (pattern.recurrenceIds !== undefined && pattern.recurrenceIds !== null) {
        if (typeof pattern.recurrenceIds === 'number') {
          recurrenceIds.push(pattern.recurrenceIds);
        } else {
          recurrenceIds.push(
            ...pattern.recurrenceIds
              .split(',')
              .map((str) => parseInt(str, 10))
              .filter((recurrenceId) =>
                moment
                  .tz(recurrenceId * 1000, data.start.timezone)
                  .isBefore(moment.tz(data.start.dateTime * 1000, data.start.timezone))
              )
          );
        }
      }

      // Update the old pattern to the start date of the selected event.
      // Ensure that the exdate and recurrenceid does not have duplicates.
      await dbRpActions.updateRpByOid(data.iCalUID, {
        until: updatedUntil,
        isCount: false,
        exDates: exDates.join(','),
        recurrenceIds: recurrenceIds.join(',')
      });
    }
    // Debug, also meant for generating the new icalstring based off the recurrence pattern.
    // const updatedOldRecurPattern = await recurPatternQuery.exec();
    const updatedOldRecurPattern = await dbRpActions.getOneRpByOId(data.iCalUID);
    const updatedOldPattern = updatedOldRecurPattern.toJSON();
    if (debug) {
      console.log(updatedOldPattern);
    }
    // Builds the old iCal string, which has edited based off the recurring pattern.
    const oldiCalString = IcalStringBuilder.buildICALStringUpdateFutureRecurMasterEvent(
      updatedOldPattern,
      data,
      payload
    );
    if (debug) {
      console.log(oldiCalString);
    }
    // Builds the new iCal string, which has been created based off the recurring pattern.
    const newiCalString = IcalStringBuilder.buildICALStringUpdateFutureRecurCreateEvent(
      newRecurrencePattern,
      data,
      payload
    );
    if (debug) {
      console.log(newiCalString);
      console.log('New Recurrence Pattern: ', newRecurrencePattern);
    }
    // Insert the new recurrence pattern into database, as it is new, should not have any issues.
    await dbRpActions.insertOrUpdateRp(newRecurrencePattern);

    // Update the old recurrence pattern with the new iCalString.
    await dbRpActions.updateRpByOid(data.iCalUID, {
      iCALString: updatedOldPattern.iCALString
    });
    // #endregion

    // #region Updating Calendar, Server Side
    const updateCalendarObject = {
      url: caldavUrl,
      calendarData: newiCalString
    };
    // Result will throw error, we can do a seperate check here if needed.
    const updateResult = await dav.updateCalendarObject(updateCalendarObject, option);
    if (debug) {
      console.log(updateResult);
    }
    // #endregion

    // #region Adding Future Events, Server Side
    const calendar = new dav.Calendar();
    calendar.url = caldavUrl;

    const newETag = uuidv4();
    if (debug) {
      console.log(caldavUrl, newETag, etag);
    }
    const addCalendarObject = {
      data: oldiCalString,
      filename: `${newETag}.ics`,
      xhr: xhrObject
    };

    // TODO: create only when the selected event is not the first in the series
    const oldCalendarData = ICAL.parse(oldiCalString);
    const oldvcalendar = new ICAL.Component(oldCalendarData);
    const newCalendarData = ICAL.parse(newiCalString);
    const newvcalendar = new ICAL.Component(newCalendarData);
    // eslint-disable-next-line no-underscore-dangle
    const oldDate = oldvcalendar.getAllSubcomponents('vevent')[0].getFirstPropertyValue('dtstart')
      ._time;
    // eslint-disable-next-line no-underscore-dangle
    const newDate = newvcalendar.getAllSubcomponents('vevent')[0].getFirstPropertyValue('dtstart')
      ._time;

    if (
      oldDate.day !== newDate.day ||
      oldDate.month !== newDate.month ||
      oldDate.year !== newDate.year
    ) {
      const addResult = await dav.createCalendarObject(calendar, addCalendarObject);
      if (debug) {
        console.log(addResult);
      }
    }

    // #endregion

    // #region Delete away all old previous data
    await dbEventActions.deleteEventByOriginaliCalUID(iCalUID);
    // #endregion

    // #region Updating Calendar, Local Side
    // The idea here is using the new iCalString generated, to create the new events to parse in.
    // So we first expand events based off the updated recurrence pattern and master.
    // After that, we append it into the events db for the redux to pick up and update.
    const oldFutureResults = PARSER.parseCalendarData(oldiCalString, etag, caldavUrl, calendarId);
    const oldExpanded = await PARSER.expandRecurEvents(
      oldFutureResults.map((calEvent) => calEvent.eventData)
    );
    const oldFinalResult = [
      ...oldExpanded,
      ...oldFutureResults
        .filter((e) => e.recurData === undefined || e.recurData === null)
        .map((e) => e.eventData)
    ];
    const oldFinalResultPromises = oldFinalResult.map((newEvent) => {
      newEvent.owner = user.email;
      newEvent.caldavType = user.caldavType;

      return dbEventActions.insertEventsIntoDatabase(newEvent);
    });
    // #endregion

    // #region Adding Future Events, Server Side
    // Here, we are roughly doing the same as the updating the calendar itself.
    // However, the problem is the the etag is not part of the iCalString.
    // And as the server does not respond correctly, due to Pg 28 of RFC 4791,
    // We do a full sync of the items, and match the etags to the event itself.
    // We sync the caldav url also, just incase.
    const newFutureResults = PARSER.parseCalendarData(
      newiCalString,
      newETag,
      caldavUrl,
      calendarId
    );
    const newExpanded = await PARSER.expandRecurEvents(
      newFutureResults.map((calEvent) => calEvent.eventData)
    );
    const newFinalResult = [
      ...newExpanded,
      ...newFutureResults
        .filter((e) => e.recurData === undefined || e.recurData === null)
        .map((e) => e.eventData)
    ];

    // You have to do a full sync as the .ics endpoint might not be valid
    const allEvents = await asyncGetAllCalDavEvents(user.email, user.password, user.principalUrl);
    const newFinalResultPromises = newFinalResult.map((newEvent) => {
      newEvent.owner = user.email;
      return dbEventActions.insertEventsIntoDatabase(newEvent);
    });
    const newResult = await Promise.all(newFinalResultPromises);
    const oldResult = await Promise.all(oldFinalResultPromises);
    // console.log(newResult.map((e) => e.toJSON()), oldResult.map((e) => e.toJSON()));

    // Here, we update the etag of every event we have appended into the database,
    // and we update them accordingly after that again.
    const updateEtag = newResult.map((json) => {
      const foundItem = allEvents.filter((event) => event.iCalUID === json.iCalUID)[0];
      json.caldavType = user.caldavType;
      json.etag = foundItem.etag;
      json.caldavUrl = foundItem.caldavUrl;
      return dbEventActions.insertEventsIntoDatabase(json);
    });

    // Ensure that all etags have been updated, before going back to the main screen.
    await Promise.all(updateEtag);
    // #endregion
  } catch (error) {
    console.log(
      '(editCalDavFutureRecurrenceEventEpics) Error, retrying with pending action!',
      error,
      payload.id
    );
  }
  payload.props.history.push('/');
  return {
    providerType: Providers.EXCHANGE,
    user: payload.user
  };
};

const deleteCalDavSingle = async (payload) => {
  const { data, user } = payload;
  const debug = false;

  // Try catch for HTTP errors, offline etc.
  try {
    let result;

    // Needed information for deleting of Caldav information.
    // etag - Event tag, there is the same for calendar if needed.
    //   UUID generated by caldav servers
    // caldavUrl - URL of specific endpoint for deleting single or recurrring events
    const { etag, caldavUrl } = data;

    // Parse user information from account layer to dav object.
    const xhrObject = new dav.transport.Basic(
      new dav.Credentials({
        username: user.email,
        password: user.password
      })
    );
    // Ensure etag is set in option for no 412 http error.
    const option = {
      xhr: xhrObject,
      etag
    };

    // For recurring events, we want to just add it to ex dates instead
    // Due to caldav nature, deleting an etag instead of updating results in deleting of
    // entire series.
    // Updating is done by pushing the entire iCal string to the server
    if (data.isRecurring) {
      // Get recurring pattern to build new iCal string for updating
      const recurrence = await dbRpActions.getOneRpByOId(data.iCalUID);
      const recurrenceObject = recurrence.toJSON();
      // eslint-disable-next-line no-underscore-dangle
      const jsonRecurr = ICAL.Recur._stringToData(recurrenceObject.iCALString);
      // debugger;
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
      // Builds the iCal string
      const iCalString = IcalStringBuilder.buildICALStringDeleteRecurEvent(
        recurrenceObject,
        data.start.dateTime,
        data,
        jsonRecurr
      );
      if (debug) {
        console.log(iCalString);
      }

      // Due to how there is no master,
      // We need to ensure all events that are part of the series
      // have the same iCal string such that we do not have inconsistency.
      // Run a db query, to update them all to the new iCalString.
      await dbEventActions.updateEventiCalString(data.iCalUID, iCalString);

      // To delete a single recurring pattern, the calendar object is different.
      // So we add the string into the object we are PUT-ing to the server
      const calendarData = iCalString;
      const calendarObject = {
        url: caldavUrl,
        calendarData
      };
      // Result will throw error, we can do a seperate check here if needed.
      result = await dav.updateCalendarObject(calendarObject, option);
    } else {
      // As we are deleting a single object, non recurring event
      // It is identified by etag. So for our calendar object,
      // We just need to know the endpoint, which is the caldavUrl
      const calendarObject = {
        url: caldavUrl
      };
      // Result will throw error, we can do a seperate check here if needed.
      result = await dav.deleteCalendarObject(calendarObject, option);
    }
    if (debug) {
      console.log(result);
    }

    // Remove it from the database for updating of UI.
    await dbEventActions.deleteEventById(data.id);

    return { user };
  } catch (caldavError) {
    console.log('Handle Caldav pending action here', caldavError);
  }
};

const deleteCalDavAllRecurrenceEvents = async (payload) => {
  const { data, user } = payload;
  const debug = false;

  try {
    // Needed information for deleting of Caldav information.
    // etag - Event tag, there is the same for calendar if needed.
    //   UUID generated by caldav servers
    // caldavUrl - URL of specific endpoint for deleting single or recurrring events
    const { etag, caldavUrl } = data;

    // Parse user information from account layer to dav object.
    const xhrObject = new dav.transport.Basic(
      new dav.Credentials({
        username: user.email,
        password: user.password
      })
    );
    // Ensure etag is set in option for no 412 http error.
    const option = {
      xhr: xhrObject,
      etag
    };

    // To delete the entire series, find a event with an etag, and run delete on it.
    // Do not need calendar as etag is the only identifier you need.
    const calendarObject = {
      url: caldavUrl
    };
    // Result will throw error, we can do a seperate check here if needed.
    const result = await dav.deleteCalendarObject(calendarObject, option);
    if (debug) {
      console.log(result);
    }

    // Remove all the recurring events accordingly.
    await dbEventActions.deleteEventByOriginalId(data.iCalUID);
    return { user };
  } catch (caldavError) {
    console.log('Handle Caldav pending action here', caldavError);
  }
};

const deleteCalDavAllFutureRecurrenceEvents = async (payload) => {
  const { data, user } = payload;
  const debug = false;

  try {
    // Needed information for deleting of Caldav information.
    // etag - Event tag, there is the same for calendar if needed.
    // UUID generated by caldav servers
    // caldavUrl - URL of specific endpoint for deleting single or recurrring events
    const { etag, caldavUrl } = data;

    // Parse user information from account layer to dav object.
    const xhrObject = new dav.transport.Basic(
      new dav.Credentials({
        username: user.email,
        password: user.password
      })
    );
    // Ensure etag is set in option for no 412 http error.
    const option = {
      xhr: xhrObject,
      etag
    };

    // For recurring events, we want to ensure exdates is clean too.
    // Clean means no duplicate, and has the right values.
    // This ensures that if we re-expand the series, the exdates are not copied over
    // It is starting to look like CalDav is just a storage service, as there can be duplicates.
    // Due to caldav nature, we can just update the end condition accordingly.
    // As we are deleting this and future events, we just need to update the end condition.
    // Updating is done by pushing the entire iCal string to the server
    // Get recurring pattern to build new iCal string for updating
    const recurrence = await dbRpActions.getOneRpByOId(data.iCalUID);
    const recurrencePattern = recurrence.toJSON();
    if (debug) {
      console.log(recurrencePattern);
    }

    // Problem here is that updating the rp based on the exDates and recurringIds.
    // This means we need to remove it from the rp and build the rp based on them.
    // Note that we cannot edit the RxDoc directly, therefore, we use the JsonObject
    // We set the exDates according to if it is before the selected start time.
    // Compared using moment.
    recurrencePattern.exDates = recurrencePattern.exDates
      .split(',')
      .filter((date) =>
        moment
          .tz(date * 1000, data.start.timezone)
          .isBefore(moment.tz(data.start.dateTime * 1000, data.start.timezone), 'day')
      )
      .join(',');

    // Do the same for edited ids.
    recurrencePattern.recurrenceIds = recurrencePattern.recurrenceIds
      .split(',')
      .filter((date) =>
        moment
          .tz(date * 1000, data.start.timezone)
          .isBefore(moment.tz(data.start.dateTime * 1000, data.start.timezone), 'day')
      )
      .join(',');

    const ruleSet = PARSER.buildRuleSet(
      recurrencePattern,
      recurrencePattern.recurringTypeId,
      data.start.timezone
    );
    const recurDates = ruleSet.all().map((date) => date.toJSON());
    const recurrAfterDates = recurDates.filter((date) =>
      moment(date).isSameOrAfter(moment.tz(data.start.dateTime * 1000, data.start.timezone))
    );

    let deleteWholeSeries = false;
    // To settle the end condition
    if (recurrencePattern.numberOfRepeats > 0) {
      recurrencePattern.numberOfRepeats -= recurrAfterDates.length;
      if (recurrencePattern.numberOfRepeats <= 0) {
        deleteWholeSeries = true;
      }
    } else if (recurrencePattern.until !== '') {
      // Need to test util end date, coz date time is ical type.
      const momentSelectedDt = moment
        .tz(data.start.dateTime * 1000, data.start.timezone)
        .add(-1, 'second');
      const momentPreviousDt = moment.tz(
        recurrencePattern.recurringTypeId * 1000,
        data.start.timezone
      );
      // recurrencePattern.until = momentSelectedDt.format('YYYY-MM-DDThh:mm:ss');
      recurrencePattern.until = momentSelectedDt.unix();
      if (momentSelectedDt.isSame(momentPreviousDt, 'day')) {
        deleteWholeSeries = true;
      }
    } else {
      // Yet to figure out how to deal with no end date.
    }

    if (deleteWholeSeries) {
      const calendarObject = {
        url: caldavUrl
      };

      // Result will throw error, we can do a seperate check here if needed.
      const result = await dav.deleteCalendarObject(calendarObject, option);
      await dbEventActions.deleteEventByOriginalId(data.iCalUID);
      await dbRpActions.deleteRpByOid(data.iCalUID);
    } else {
      // Builds the iCal string
      const iCalString = IcalStringBuilder.buildICALStringDeleteRecurEvent(
        recurrencePattern,
        data.start.dateTime,
        data
      );
      if (debug) {
        console.log(iCalString);
      }

      // Due to how there is no master,
      // We need to ensure all events that are part of the series
      // have the same iCal string such that we do not have inconsistency.
      // Run a db query, to update them all to the new iCalString.
      await dbEventActions.updateEventiCalString(data.iCalUID, iCalString);
      recurrencePattern.iCALString = iCalString;
      await dbRpActions.updateRpByOid(data.iCalUID, recurrencePattern);

      // To delete a single recurring pattern, the calendar object is different.
      // So we add the string into the object we are PUT-ing to the server
      const calendarData = iCalString;
      const calendarObject = {
        url: caldavUrl,
        calendarData
      };
      // Result will throw error, we can do a seperate check here if needed.
      const result = await dav.updateCalendarObject(calendarObject, option);
      if (debug) {
        console.log(result);
        const allevents = await dbEventActions.getAllEvents();
        console.log(allevents);
      }

      const deletingEvents = await Promise.all(
        recurrAfterDates.map((date) => {
          if (debug) {
            console.log(data.iCalUID, date);
          }
          return dbEventActions.deleteEventByiCalUIDandStartDateTime(
            data.iCalUID,
            moment(date).unix()
          );
        })
      );

      if (debug) {
        console.log(deletingEvents);
      }
    }
    return { user };
  } catch (caldavError) {
    console.log('Handle Caldav pending action here', caldavError);
  }
};
