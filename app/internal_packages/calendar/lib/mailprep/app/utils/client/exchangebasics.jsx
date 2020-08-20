import {
  ExchangeService,
  Uri,
  ExchangeCredentials,
  Appointment,
  ItemId,
  CalendarView,
  DateTime,
  WellKnownFolderName,
  PropertySet,
  BasePropertySet,
  ItemSchema,
  BodyType,
  ItemView,
  AppointmentSchema,
  FolderView
} from 'ews-javascript-api';
import moment from 'moment';
import * as dbRpActions from '../../sequelizeDB/operations/recurrencepatterns';
import { parseEwsRecurringPatterns } from './exchange';

/*
  Goal: Get a single appointment from the server
  Why: For certain CRUD operations and chaining use cases.
    Wrapped for easier understanding
  How: 1 EWS API call on the server with ID,
*/
export const asyncGetSingleExchangeEvent = async (username, password, url, itemId) => {
  try {
    const exch = new ExchangeService();
    exch.Url = new Uri(url);
    exch.Credentials = new ExchangeCredentials(username, password);

    const appointment = await Appointment.Bind(exch, new ItemId(itemId));
    return appointment;
  } catch (error) {
    console.log('(asyncGetSingleExchangeEvent) Error: ', error);
    throw error;
  }
};

/*
  Goal: Get all non complex defined properties.
  Why: We needed a list of ID if we want to get complex properties.
    Information like body are not defined and throw an error
  How: 1 + n EWS API call on the server
    1 call for finding the proper calendar to pull from
    n calls for the list of time between certain time defined by you.

    Another factor to take into account is the use of different calendars
    Here, I am using a different calendar and not the main calendar as
    you might have history of events and you cannot delete the main calendar if anything goes wrong.
    Therefore, I made a ews call to pull the list of calendar from the server
    and find a calendar named 'Uploading Calendar' to get all the main events from.
*/
export const asyncGetAllExchangeEvents = async (exch) => {
  let view;
  let exchangeEvents = [];
  const results = [];

  function loopEvents(response) {
    exchangeEvents = exchangeEvents.concat(response.Items);
  }
  const a = moment.unix(1451653200).add(23, 'month');
  let prev = moment.unix(1451653200);
  const b = moment.unix(1704114000); // Just some random super large time.

  let uploadingCalendar;
  await exch.FindFolders(WellKnownFolderName.Calendar, new FolderView(10)).then((result) => {
    // eslint-disable-next-line prefer-destructuring
    uploadingCalendar = result.folders.filter(
      (folder) => folder.DisplayName === 'Uploading Calendar'
    )[0];
  });

  // 23 months because you can only pull 2 years at a time.
  // 23 because laze to calculate the last month addition
  for (let m = moment(a); m.isBefore(b); m.add(23, 'month')) {
    view = new CalendarView(new DateTime(prev), new DateTime(m));
    try {
      results.push(
        exch.FindAppointments(uploadingCalendar, view).then(
          (response) => loopEvents(response),
          (error) => {
            throw error;
          }
        )
      );
    } catch (error) {
      throw error;
    }
    prev = prev.add(23, 'month');
  }
  await Promise.all(results);
  // debugger;
  return exchangeEvents;
};

/*
  Goal: Update all the exchange events with the right description
  Why: To get all the events complex properties, in this case, description.
    Can be further extended to add more complex properties if needed.
  How: 1 EWS API call on the server with IDs, with the propertyset defined
    PropertySets are used to get additional informaton.
    Array of Non Recurr Ids as we assume recurr Ids have complex properties and handled different.
    Array as it is a bulk request and not for each event.
    RequestedBodyType MUST be defined as BodyType.Text, else it returns in HTML.
*/
export const asyncGetExchangeBodyEvents = async (exch, arrayOfNonRecurrIds, exchangeEvents) => {
  const exchangeEventsWithBody = [];

  const additonalProps = new PropertySet(BasePropertySet.IdOnly, ItemSchema.Body);
  additonalProps.RequestedBodyType = BodyType.Text;

  await exch.BindToItems(arrayOfNonRecurrIds, additonalProps).then(
    (resp) => {
      resp.responses.forEach((singleAppointment) => {
        const fullSizeAppointment = exchangeEvents.filter(
          (event) => event.Id.UniqueId === singleAppointment.item.Id.UniqueId
        )[0];
        fullSizeAppointment.Body = singleAppointment.item.Body.text;
        exchangeEventsWithBody.push(fullSizeAppointment);
      });
    },
    (error) => {
      console.log(error); // I got ECONNRESET or something the last time, idk how to break this so that I can ensure stability, figure out later.
      throw error;
    }
  );

  return exchangeEventsWithBody;
};

/*
  Goal: Get only recurrence master events and parse into rp database.
  Why: Recurrence Master events are needed for certain CRUD ops, like deleting all events.
  How: 3 EWS API call on the server/
    1 call for finding the proper calendar to pull from
    1 call for finding the appointments in the found calendar, re-using the prev result.
    1 call for finding all the complex properties needed for our database.

    PropertySets are used to get additional informaton.
      For recurrence,
        Modified Occurrences and Deleted Occurrences are complex properties
        Appends to recurrenceIds and exDates accordingly.

    RequestedBodyType MUST be defined as BodyType.Text, else it returns in HTML.
*/
export const asyncGetExchangeRecurrMasterEvents = async (exch) => {
  let view;
  const exchangeEvents = new Map();
  const results = [];
  const debug = false;

  try {
    let uploadingCalendar;
    await exch.FindFolders(WellKnownFolderName.Calendar, new FolderView(10)).then((result) => {
      // eslint-disable-next-line prefer-destructuring
      uploadingCalendar = result.folders.filter(
        (folder) => folder.DisplayName === 'Uploading Calendar'
      )[0];
    });

    // I added 10 incase there are additional items, doesn't harm the api.
    await exch
      .FindItems(uploadingCalendar.Id, new ItemView(uploadingCalendar.TotalCount + 10))
      .then((resp) => resp.Items.filter((item) => item.AppointmentType === 'RecurringMaster'))
      .then((recurringMasterEvents) => {
        const setKeyId = new Set();
        recurringMasterEvents.forEach((item) => setKeyId.add(new ItemId(item.Id.UniqueId)));
        const additonalProps = new PropertySet(BasePropertySet.IdOnly, [
          AppointmentSchema.Recurrence,
          AppointmentSchema.Body,
          AppointmentSchema.Subject,
          AppointmentSchema.AppointmentType,
          AppointmentSchema.IsRecurring,
          AppointmentSchema.Start,
          AppointmentSchema.StartTimeZone,
          AppointmentSchema.TimeZone,
          AppointmentSchema.EndTimeZone,
          AppointmentSchema.End,
          AppointmentSchema.ICalUid,
          AppointmentSchema.ICalRecurrenceId,
          AppointmentSchema.LastOccurrence,
          AppointmentSchema.ModifiedOccurrences,
          AppointmentSchema.DeletedOccurrences
        ]);
        additonalProps.RequestedBodyType = BodyType.Text;
        const promiseArr = [];
        if (setKeyId.size > 0) {
          promiseArr.push(exch.BindToItems([...setKeyId], additonalProps));
        }
        return Promise.all(promiseArr);
      })
      .then((recurrence) => {
        const promiseArr = [];
        if (recurrence.length > 0) {
          recurrence[0].Responses.filter((resp) => resp.errorCode === 0)
            .map((resp) => resp.Item)
            .map(async (event) => {
              const dbRecurrencePattern = parseEwsRecurringPatterns(
                event.Id.UniqueId,
                event.Recurrence,
                event.ICalUid,
                event.DeletedOccurrences,
                event.ModifiedOccurrences
              );
              exchangeEvents.set(event.ICalUid, event);

              promiseArr.push(dbRpActions.getOneRpByOId(event.Id.UniqueId));
            });
        }
        return Promise.all(promiseArr);
      })
      .then((existInDb) => {
        exchangeEvents.forEach((event, eventId) => {
          const prevDbObj = existInDb
            .filter((dbRecurrencePattern) => dbRecurrencePattern !== null)
            .filter((dbRecurrencePattern) => dbRecurrencePattern.iCalUID === eventId);

          if (debug) {
            console.log(prevDbObj, event, eventId, existInDb);
          }
          if (prevDbObj.length > 0) {
            if (prevDbObj.length > 1) {
              console.log('Duplicated database issue for recurrence pattern. Check please.');
            }

            const recurrencePattern = parseEwsRecurringPatterns(
              event.Id.UniqueId,
              event.Recurrence,
              event.ICalUid,
              event.DeletedOccurrences,
              event.ModifiedOccurrences
            );
            if (debug) {
              console.log(recurrencePattern);
              // debugger;
            }

            results.push(
              dbRpActions.updateRpByOid(prevDbObj[0].originalId, {
                recurringTypeId: recurrencePattern.recurringTypeId,
                originalId: recurrencePattern.originalId,
                freq: recurrencePattern.freq,
                interval: recurrencePattern.interval,
                until: recurrencePattern.until,
                exDates: recurrencePattern.exDates,
                recurrenceIds: recurrencePattern.recurrenceIds,
                modifiedThenDeleted: recurrencePattern.modifiedThenDeleted,
                weeklyPattern: recurrencePattern.weeklyPattern,
                numberOfRepeats: recurrencePattern.numberOfRepeats,
                iCalUID: recurrencePattern.iCalUID,
                byWeekNo: recurrencePattern.byWeekNo,
                byWeekDay: recurrencePattern.byWeekDay,
                byMonth: recurrencePattern.byMonth,
                byMonthDay: recurrencePattern.byMonthDay
              })
            );
          } else {
            const recurrencePattern = parseEwsRecurringPatterns(
              event.Id.UniqueId,
              event.Recurrence,
              event.ICalUid,
              event.DeletedOccurrences,
              event.ModifiedOccurrences
            );
            results.push(dbRpActions.insertOrUpdateRp(recurrencePattern));
          }
        });
      });
  } catch (error) {
    console.log(error);
  }

  await Promise.all(results);
  return exchangeEvents;
};
