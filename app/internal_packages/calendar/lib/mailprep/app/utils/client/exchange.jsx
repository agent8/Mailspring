import md5 from 'md5';
import {
  ExchangeService,
  DateTime,
  Uri,
  WellKnownFolderName,
  CalendarView,
  ExchangeCredentials,
  Appointment,
  SendInvitationsMode,
  Item,
  PropertySet,
  ItemSchema,
  ConflictResolutionMode,
  SendInvitationsOrCancellationsMode,
  MessageBody,
  ItemId,
  BasePropertySet,
  ExtendedPropertyDefinition,
  BodyType,
  FolderView,
  DeleteMode,
  AppointmentSchema,
  AppointmentType,
  Recurrence,
  DailyPattern,
  DayOfTheWeek,
  Month,
  DayOfTheWeekIndex
} from 'ews-javascript-api';
import moment from 'moment';
import uuidv4 from 'uuid';
import ICAL from 'ical.js';
import * as ProviderTypes from '../constants';
import {
  deleteEventSuccess,
  editEventSuccess,
  apiFailure,
  postEventSuccess
} from '../../actions/events';
import * as dbEventActions from '../../sequelizeDB/operations/events';
import * as dbRpActions from '../../sequelizeDB/operations/recurrencepatterns';
import * as ExchangeBasics from './exchangebasics';

const uuidv1 = require('uuid/v1');

export const filterExchangeUser = (jsonObj) => ({
  personId: uuidv4(),
  originalId: md5(jsonObj.username),
  email: jsonObj.username,
  providerType: ProviderTypes.EXCHANGE,
  password: jsonObj.password
});

export const asyncCreateExchangeEvent = async (username, password, url, payload) => {
  try {
    const exch = new ExchangeService();
    exch.Url = new Uri(url);
    exch.Credentials = new ExchangeCredentials(username, password);

    const startDate = new DateTime(
      moment.tz(payload.start.dateTime * 1000, payload.start.timezone)
    );

    const newEvent = new Appointment(exch);
    newEvent.Subject = payload.summary;
    newEvent.Body = new MessageBody(payload.description);
    newEvent.Start = new DateTime(startDate);
    newEvent.End = new DateTime(moment.tz(payload.end.dateTime * 1000, payload.end.timezone));

    if (payload.isRecurring) {
      const newRecurrencePattern = {};
      const updatedId = uuidv1();
      const updatedUid = uuidv1();
      const rrule = await dbRpActions.getOneRpByOId(payload.recurringEventId);

      // eslint-disable-next-line no-underscore-dangle
      const jsonRecurr = ICAL.Recur._stringToData(rrule.toJSON().iCALString);
      const ewsReucrr = createNewEwsRecurrenceObj(
        jsonRecurr.freq,
        [0, jsonRecurr.BYDAY, 0, 0],
        jsonRecurr.interval,
        startDate,
        jsonRecurr.until,
        jsonRecurr.count,
        jsonRecurr.BYMONTH,
        jsonRecurr.BYMONTHDAY,
        jsonRecurr.BYDAY,
        jsonRecurr.BYSETPOS
      );
      newEvent.Recurrence = ewsReucrr;
    }

    let uploadingCalendar;
    await exch
      .FindFolders(WellKnownFolderName.Calendar, new FolderView(10))
      .then((result) => {
        // eslint-disable-next-line prefer-destructuring
        uploadingCalendar = result.folders.filter(
          (folder) => folder.DisplayName === 'Uploading Calendar'
        )[0];
      })
      .catch((error) => {
        // If we get here, it means pending action has failed, and therefore
        // It is time to exit and not bother trying.
        // Let the next pending action retry on its own.
        throw error;
      });
    debugger;

    return await newEvent.Save(uploadingCalendar.Id, SendInvitationsMode.SendToAllAndSaveCopy).then(
      async () => {
        const item = await Item.Bind(exch, newEvent.Id);
        const returnEvents = [];

        if (item.AppointmentType === 'Single') {
          const promiseArr = [
            dbEventActions.deleteEventByOriginaliCalUID(payload.iCalUID),
            dbEventActions.insertEventsIntoDatabase(
              ProviderTypes.filterIntoSchema(item, ProviderTypes.EXCHANGE, username, false)
            )
          ];
          await Promise.all(promiseArr);
          returnEvents.push(item);
        } else if (item.AppointmentType === 'RecurringMaster') {
          debugger;
          // If it is a recurring master event, we need to rely on ews to expand our events.
          const allExchangeEvents = await ExchangeBasics.asyncGetAllExchangeEvents(exch);
          const newRecurrExpandedEvents = allExchangeEvents
            .filter((serverEvent) => serverEvent.ICalUid === item.ICalUid)
            .map((newExpandedSingleEvent) => {
              newExpandedSingleEvent.RecurrenceMasterId = item.Id;
              return newExpandedSingleEvent;
            });

          const rpList = await dbRpActions.getAllRp();
          // // If you want the old recurring events, this is how to filter it.
          // const oldRecurrExpandedEvents = allExchangeEvents
          //   .filter((serverEvent) => serverEvent.ICalUid !== item.ICalUid)
          //   .map((oldExpandedSingleEvent) => {
          //     const prevRp = rpList.filter((rp) => rp.iCalUID === oldExpandedSingleEvent.ICalUid);
          //     console.log(prevRp, oldExpandedSingleEvent);
          //     // debugger;
          //     if (oldExpandedSingleEvent.IsRecurring && prevRp.length > 0) {
          //       oldExpandedSingleEvent.RecurrenceMasterId = {
          //         UniqueId: prevRp[0].originalId
          //       };
          //     }
          //     return oldExpandedSingleEvent;
          //   });

          // const promiseArr = [
          //   dbEventActions.deleteEventByOriginaliCalUID(payload.iCalUID),
          //   dbRpActions.deleteRpByiCalUID(payload.iCalUID),
          //   dbRpActions.insertOrUpdateRp(
          //     parseEwsRecurringPatterns(
          //       item.Id.UniqueId,
          //       item.Recurrence,
          //       item.ICalUid,
          //       null,
          //       null
          //     )
          //   ),
          //   newRecurrExpandedEvents.map((newServerEvent) =>
          //     dbEventActions.insertEventsIntoDatabase(
          //       ProviderTypes.filterIntoSchema(
          //         newServerEvent,
          //         ProviderTypes.EXCHANGE,
          //         username,
          //         false
          //       )
          //     )
          //   )
          // ];
          // await Promise.all(promiseArr);
          debugger;

          // Nuke the temp events first, because network managed to get the ID of the posting event.
          await dbEventActions.deleteEventByOriginaliCalUID(payload.iCalUID);

          // Nuke the temp RP, because network managed to get the ID of the posting event.
          await dbRpActions.deleteRpByiCalUID(payload.iCalUID);

          // Insert in the new RP
          await dbRpActions.insertOrUpdateRp(
            parseEwsRecurringPatterns(item.Id.UniqueId, item.Recurrence, item.ICalUid, null, null)
          );

          // Insert in the new events
          await Promise.all(
            newRecurrExpandedEvents.map((newServerEvent) =>
              dbEventActions.insertEventsIntoDatabase(
                ProviderTypes.filterIntoSchema(
                  newServerEvent,
                  ProviderTypes.EXCHANGE,
                  username,
                  false
                )
              )
            )
          );
          returnEvents.push(...newRecurrExpandedEvents);
        }
        return postEventSuccess(returnEvents, 'EXCHANGE', username);
      },
      (error) => {
        throw error;
      }
    );
  } catch (error) {
    console.log('(asyncCreateExchangeEvent) Error: ', error);
    throw error;
  }
};

export const asyncUpdateExchangeEvent = async (singleAppointment, user, callback) => {
  try {
    return await singleAppointment
      .Update(ConflictResolutionMode.AlwaysOverwrite, SendInvitationsOrCancellationsMode.SendToNone)
      .then(
        async (success) => {
          const additonalProps = new PropertySet(
            BasePropertySet.FirstClassProperties,
            ItemSchema.Body
          );
          additonalProps.RequestedBodyType = BodyType.Text;

          const exch = new ExchangeService();
          exch.Url = new Uri('https://outlook.office365.com/Ews/Exchange.asmx');
          exch.Credentials = new ExchangeCredentials(user.email, user.password);

          const newEvent = await exch.BindToItems([singleAppointment.Id], additonalProps);
          const updatedItem = newEvent.responses[0].Item;
          const localDbCopy = await dbEventActions.getOneEventByOriginalId(
            singleAppointment.Id.UniqueId
          );
          updatedItem.RecurrenceMasterId = { UniqueId: localDbCopy.recurringEventId };

          const filteredItem = ProviderTypes.filterIntoSchema(
            updatedItem,
            ProviderTypes.EXCHANGE,
            user.email,
            false
          );

          filteredItem.id = localDbCopy.id;
          await dbEventActions.updateEventByOriginalId(singleAppointment.Id.UniqueId, filteredItem);
          callback();
          return editEventSuccess(updatedItem);
        },
        (error) => {
          throw error;
        }
      );
  } catch (error) {
    console.log('(asyncUpdateExchangeEvent) Error: ', error);
    throw error;
  }
};

export const asyncUpdateRecurrExchangeSeries = async (singleAppointment, user, callback) => {
  try {
    return await singleAppointment
      .Update(ConflictResolutionMode.AlwaysOverwrite, SendInvitationsOrCancellationsMode.SendToNone)
      .then(
        async (success) => {
          const updatedItem = await ExchangeBasics.asyncGetSingleExchangeEvent(
            user.email,
            user.password,
            'https://outlook.office365.com/Ews/Exchange.asmx',
            singleAppointment.Id.UniqueId
          );
          const localDbItems = await dbEventActions.getAllEventsByRecurringEventId(
            singleAppointment.Id.UniqueId
          );

          await Promise.all(
            localDbItems.map((localRecurringItem) =>
              dbEventActions.updateEventRecurringEventId(localRecurringItem.recurringEventId, {
                // TO-DO, add more values for updating.
                summary: updatedItem.Subject
              })
            )
          );
          await callback();
          return editEventSuccess(updatedItem);
        },
        (error) => {
          throw error;
        }
      );
  } catch (error) {
    console.log('(asyncUpdateRecurrExchangeSeries) Error: ', error);
    throw error;
  }
};

export const asyncDeleteExchangeEvent = async (singleAppointment, user, callback) => {
  try {
    return await singleAppointment.Delete(DeleteMode.MoveToDeletedItems).then(
      async (success) => {
        await dbEventActions.deleteEventByOriginalId(singleAppointment.Id.UniqueId);
        callback();
        return deleteEventSuccess(singleAppointment.Id.UniqueId, user);
      },
      (error) => {
        console.log('error:', error);
        throw error;
      }
    );
  } catch (error) {
    console.log('(asyncDeleteExchangeEvent) Error: ', error);
    throw error;
  }
};

export const asyncGetRecurrAndSingleExchangeEvents = async (exch) => {
  const exchangeEvents = await ExchangeBasics.asyncGetAllExchangeEvents(exch);

  const arrayOfNonRecurrIds = [];
  const mapOfRecurrEvents = new Map();
  exchangeEvents.forEach((event) => {
    if (event.AppointmentType === 'Single') {
      arrayOfNonRecurrIds.push(new ItemId(event.Id.UniqueId));
    } else {
      let arrayOfRecurrIds = mapOfRecurrEvents.get(event.ICalUid);
      if (arrayOfRecurrIds === undefined) {
        arrayOfRecurrIds = [];
      }

      arrayOfRecurrIds.push(event);
      mapOfRecurrEvents.set(event.ICalUid, arrayOfRecurrIds);
    }
  });

  const exchangeEventsWithBody = await ExchangeBasics.asyncGetExchangeBodyEvents(
    exch,
    arrayOfNonRecurrIds,
    exchangeEvents
  );

  const recurrMasterEvents = await ExchangeBasics.asyncGetExchangeRecurrMasterEvents(exch);
  try {
    for (const [key, value] of mapOfRecurrEvents) {
      const recurrMasterId = recurrMasterEvents.get(key).Id;
      value.forEach((event) => (event.RecurrenceMasterId = recurrMasterId));
      exchangeEventsWithBody.push(...value);
    }
  } catch (e) {
    console.log('Mapping of recursive master event to expanded events has issue!', e);
  }

  return exchangeEventsWithBody;
};

export const parseEwsRecurringPatterns = (
  id,
  ews,
  iCalUID,
  deletedOccurrences,
  editedOccurrences
  // eslint-disable-next-line arrow-body-style
) => {
  return {
    id: uuidv4(),
    originalId: id,
    freq: parseEwsFreq(ews.XmlElementName),
    interval: ews.Interval === undefined || ews.Interval === null ? 0 : parseInt(ews.Interval, 10),
    recurringTypeId: ews.StartDate.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ'),
    until: ews.EndDate === null ? '' : ews.EndDate.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ'),
    iCalUID,
    // TO-DO, actually populate this properly.
    exDates:
      deletedOccurrences === null
        ? ''
        : deletedOccurrences.Items.map((deletedOccur) =>
            deletedOccur.OriginalStart.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ')
          )
            .filter(
              (deletedRecurrString) =>
                moment(deletedRecurrString).isAfter(ews.StartDate.getMomentDate()) &&
                (ews.EndDate === null ||
                  moment(deletedRecurrString).isBefore(ews.EndDate.getMomentDate()))
            )
            .join(','),
    recurrenceIds:
      editedOccurrences === null
        ? ''
        : editedOccurrences.Items.map((editedOccur) =>
            editedOccur.OriginalStart.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ')
          )
            .filter(
              (editedRecurrString) =>
                moment(editedRecurrString).isAfter(ews.StartDate.getMomentDate()) &&
                (ews.EndDate === null ||
                  moment(editedRecurrString).isBefore(ews.EndDate.getMomentDate()))
            )
            .join(','),
    modifiedThenDeleted: false,
    weeklyPattern:
      ews.XmlElementName === 'WeeklyRecurrence'
        ? convertDaysToArray(ews.DaysOfTheWeek.items).join(',')
        : '',
    numberOfRepeats: ews.NumberOfOccurrences === null ? 0 : ews.NumberOfOccurrences,
    byWeekNo:
      ews.DayOfTheWeekIndex === undefined || ews.DayOfTheWeekIndex === null
        ? '()'
        : parseEwsWeekDayIndex(ews.DayOfTheWeekIndex),
    byWeekDay:
      // eslint-disable-next-line no-nested-ternary
      ews.DaysOfTheWeek !== undefined && ews.DaysOfTheWeek !== null
        ? parseEwsWeekDay(ews.DaysOfTheWeek)
        : ews.DayOfTheWeek !== undefined && ews.DayOfTheWeek !== null
        ? parseEwsWeekDay({ items: [ews.DayOfTheWeek] })
        : '()',
    byMonth: ews.Month === undefined || ews.Month === null ? '()' : parseEwsMonth(ews.Month),
    byMonthDay:
      ews.DayOfMonth === undefined || ews.DayOfMonth === null ? '()' : `(${ews.DayOfMonth})`
  };
};

const convertDaysToArray = (arrayVals) => {
  const arr = [0, 0, 0, 0, 0, 0, 0];
  arrayVals.forEach((val) => (arr[val] = 1));
  return arr;
};

const parseEwsWeekDayIndex = (ewsEnumDayOfTheWeekIndex) => {
  let val = '';
  switch (ewsEnumDayOfTheWeekIndex) {
    case DayOfTheWeekIndex.First:
      val = '0';
      break;
    case DayOfTheWeekIndex.Second:
      val = '1';
      break;
    case DayOfTheWeekIndex.Third:
      val = '2';
      break;
    case DayOfTheWeekIndex.Fourth:
      val = '3';
      break;
    case DayOfTheWeekIndex.Last:
      val = '-1';
      break;
    default:
      break;
  }
  return `(${val})`;
};

const parseEwsWeekDay = (ewsEnumDayOfTheWeek) => {
  let val = '';
  ewsEnumDayOfTheWeek.items.forEach((item) => {
    let out = '';
    switch (item) {
      case DayOfTheWeek.Monday || 1:
        out = 'MO';
        break;
      case DayOfTheWeek.Tuesday || 2:
        out = 'TU';
        break;
      case DayOfTheWeek.Wednesday || 3:
        out = 'WE';
        break;
      case DayOfTheWeek.Thursday || 4:
        out = 'TH';
        break;
      case DayOfTheWeek.Friday || 5:
        out = 'FR';
        break;
      case DayOfTheWeek.Saturday || 6:
        out = 'SA';
        break;
      case DayOfTheWeek.Sunday || 0:
        out = 'SU';
        break;
      default:
        console.log('ERROR, WUT');
        break;
    }
    val += `${out},`;
  });
  return `(${val.slice(0, -1)})`;
};

const parseWeekNoToEwsDayOfTheWeekIndex = (weekNo) => {
  switch (weekNo) {
    case 1:
      return DayOfTheWeekIndex.First;
    case 2:
      return DayOfTheWeekIndex.Second;
    case 3:
      return DayOfTheWeekIndex.Third;
    case 4:
      return DayOfTheWeekIndex.Fourth;
    case 5:
      return DayOfTheWeekIndex.Last;
    default:
      console.log('ERROR, WUT');
  }
};

const parseWeekDayToEwsDayOfTheWeek = (weekDay) => {
  switch (weekDay) {
    case 0:
      return DayOfTheWeek.Sunday;
    case 1:
      return DayOfTheWeek.Monday;
    case 2:
      return DayOfTheWeek.Tuesday;
    case 3:
      return DayOfTheWeek.Wednesday;
    case 4:
      return DayOfTheWeek.Thursday;
    case 5:
      return DayOfTheWeek.Friday;
    case 6:
      return DayOfTheWeek.Saturday;
    default:
      console.log('ERROR, WUT');
  }
};

const parseEwsMonth = (ewsEnumMonth) => {
  let val = '';
  switch (ewsEnumMonth) {
    case Month.January:
      val = '1';
      break;
    case Month.February:
      val = '2';
      break;
    case Month.March:
      val = '3';
      break;
    case Month.April:
      val = '4';
      break;
    case Month.May:
      val = '5';
      break;
    case Month.June:
      val = '6';
      break;
    case Month.July:
      val = '7';
      break;
    case Month.August:
      val = '8';
      break;
    case Month.September:
      val = '9';
      break;
    case Month.October:
      val = '10';
      break;
    case Month.November:
      val = '11';
      break;
    case Month.December:
      val = '12';
      break;
    default:
      break;
  }
  return `(${val})`;
};

const parseEwsFreq = (ewsAppointmentPattern) => {
  switch (ewsAppointmentPattern) {
    case 'DailyRecurrence':
      return 'DAILY';
    case 'AbsoluteMonthlyRecurrence':
      return 'MONTHLY';
    case 'RelativeMonthlyRecurrence':
      return 'MONTHLY';
    case 'RelativeYearlyRecurrence':
      return 'YEARLY';
    case 'WeeklyRecurrence':
      return 'WEEKLY';
    case 'AbsoluteYearlyRecurrence':
      return 'YEARLY';
    default:
      break;
  }
};

const parseStringToEwsWeekDay = (stringEwsWeekDay) => {
  switch (stringEwsWeekDay) {
    case 'MO':
      return DayOfTheWeek.Monday;
    case 'TU':
      return DayOfTheWeek.Tuesday;
    case 'WE':
      return DayOfTheWeek.Wednesday;
    case 'TH':
      return DayOfTheWeek.Thursday;
    case 'FR':
      return DayOfTheWeek.Friday;
    case 'SA':
      return DayOfTheWeek.Saturday;
    case 'SU':
      return DayOfTheWeek.Sunday;
    default:
      break;
  }
};

export const editEwsRecurrenceObj = (
  firstOption, // Daily, Weekly, Monthly or Yearly.
  secondOption, // Weekly, which dates.
  recurrInterval, // Recurring Intervals.
  ewsRecurr, // Origianl Recurring interval.
  untilType, // End Type, Never, On, or After x amount.
  untilDate, // End Type, On Value, String, Date time.
  untilAfter, // End Type, After Value, String, but number parsed.
  byMonth, // Used for Monthly/Yearly, Repeat on which month.
  byMonthDay, // Used for Monthly/Yearly, Repeat on which day of a month
  byWeekDay, // Used for Weekly/Monthly/Yearly, Repeat on which week day, E.g. Mon, tues
  byWeekNo // Used for Weekly/Monthly/Yearly, Repeat on a specified week number. E.g. 1-4, or last.
) => {
  // debugger;
  let recurrObj;
  switch (firstOption) {
    case 0:
    case 'DAILY':
      recurrObj = new Recurrence.DailyPattern();
      break;
    case 1:
    case 'WEEKLY':
      recurrObj = new Recurrence.WeeklyPattern();

      const DayOfWeekArr = [];
      for (let i = 0; i < secondOption[1].length; i += 1) {
        if (secondOption[1][i] === 1) {
          recurrObj.DaysOfTheWeek.Add(i);
        }
      }
      break;
    case 2:
    case 'MONTHLY':
      // We assume EWS only allows one month day due to its API limitation.
      if (secondOption[2] === 0) {
        recurrObj = new Recurrence.MonthlyPattern();
        // Slice off the (), and take the number by parsing, but ensure that if empty, not NaN.
        recurrObj.DayOfMonth = byMonthDay === '()' ? 0 : parseInt(byMonthDay.slice(1, -1), 10);
      } else {
        const dayOfWeekIndexNum = parseInt(byWeekNo.slice(1, -1), 10);
        recurrObj = new Recurrence.RelativeMonthlyPattern();
        recurrObj.DayOfTheWeek = parseStringToEwsWeekDay(byWeekDay.slice(1, -1));
        recurrObj.DayOfTheWeekIndex = dayOfWeekIndexNum;
      }
      break;
    case 3:
    case 'YEARLY':
      const parsedMonth = byMonth === '()' ? 0 : parseInt(byMonth.slice(1, -1), 10);
      if (secondOption[3] === 0) {
        // Slice off the (), and take the number by parsing, but ensure that if empty, not NaN.
        recurrObj = new Recurrence.YearlyPattern();
        recurrObj.DayOfMonth = byMonthDay === '()' ? 0 : parseInt(byMonthDay.slice(1, -1), 10);
      } else {
        const dayOfWeekIndexNum = parseInt(byWeekNo.slice(1, -1), 10);
        recurrObj = new Recurrence.RelativeYearlyPattern();
        recurrObj.DayOfTheWeek = parseStringToEwsWeekDay(byWeekDay.slice(1, -1));
        recurrObj.DayOfTheWeekIndex = dayOfWeekIndexNum;
      }
      recurrObj.Month = parsedMonth;
      break;
    default:
      console.log('(editEwsRecurrenceObj) Default 1');
      return -1;
  }

  recurrObj.StartDate = ewsRecurr.StartDate;

  switch (untilType) {
    case 'o':
      // Filter to just Y/M/D, don't need any time.
      recurrObj.EndDate = new DateTime(moment(untilDate));
      break;
    case 'a':
      // Ensure it is a number.
      recurrObj.NumberOfOccurrences = parseInt(untilAfter, 10);
      break;
    case 'n':
      // No end, rip. Constant expansion here we go.
      recurrObj.HasEnd = false;
      break;
    default:
      console.log('(editEwsRecurrenceObj) Default 2');
      return -1;
  }

  recurrObj.Interval = recurrInterval.toString();
  return recurrObj;
};

export const createNewEwsRecurrenceObj = (
  firstOption, // Daily, Weekly, Monthly or Yearly.
  secondOption, // Weekly, which dates.
  recurrInterval, // Recurring Intervals.
  startDate, // Start date of recurrence.
  // untilType, // End Type, Never, On, or After x amount.
  untilDate, // End Type, On Value, String, Date time.
  untilAfter, // End Type, After Value, String, but number parsed.
  byMonth, // Used for Monthly/Yearly, Repeat on which month.
  byMonthDay, // Used for Monthly/Yearly, Repeat on which day of a month
  byWeekDay, // Used for Weekly/Monthly/Yearly, Repeat on which week day, E.g. Mon, tues
  byWeekNo // Used for Weekly/Monthly/Yearly, Repeat on a specified week number. E.g. 1-4, or last.
) => {
  let recurrObj;
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
  switch (firstOption) {
    case 'DAILY':
      recurrObj = new Recurrence.DailyPattern();
      break;
    case 'WEEKLY':
      recurrObj = new Recurrence.WeeklyPattern();
      let option = [0, 0, 0, 0, 0, 0, 0];
      if (typeof secondOption[1] === 'string') {
        option[parseStringToEwsWeekDay(secondOption[1])] = 1;
      } else {
        // secondOption[1].forEach((e) => {
        //   option[parseStringToEwsWeekDay(e)] = 1;
        // });

        option = secondOption[1].map((val) => parseInt(val, 10));
      }

      const DayOfWeekArr = [];
      for (let i = 0; i < option.length; i += 1) {
        if (option[i] === 1) {
          recurrObj.DaysOfTheWeek.Add(i);
        }
      }
      break;
    case 'MONTHLY':
      // We assume EWS only allows one month day due to its API limitation.
      // If it is a single number, its a single day.
      if (typeof byMonthDay === 'number') {
        recurrObj = new Recurrence.MonthlyPattern();
        recurrObj.DayOfMonth = parseInt(byMonthDay, 10);
      } else if (byWeekNo !== '' && byWeekDay !== '') {
        let dayOfWeekIndexNum = parseInt(byWeekNo, 10);
        if (dayOfWeekIndexNum === -1) {
          // debugger;
          dayOfWeekIndexNum = 5; // When it is the last weekend all the time/ ??? how to handle
        }
        dayOfWeekIndexNum -= 1; // Becuz exchange feels like saying 0 is the first week

        recurrObj = new Recurrence.RelativeMonthlyPattern();
        recurrObj.DayOfTheWeek = parseStringToEwsWeekDay(byWeekDay);
        recurrObj.DayOfTheWeekIndex = dayOfWeekIndexNum;
      } else {
        const splitByMonthDay = byMonthDay
          .slice(1, -1)
          .split(',')
          .filter((str) => str !== '');
        if (splitByMonthDay.length > 0) {
          // debugger;
          // As ews can only allow you to loop on one event,
          // we find what day of week and week of month the event is repeating on
          // and loop on those.
          recurrObj = new Recurrence.RelativeMonthlyPattern();
          recurrObj.DayOfTheWeek = parseWeekDayToEwsDayOfTheWeek(startDate.DayOfWeek);
          recurrObj.DayOfTheWeekIndex = parseWeekNoToEwsDayOfTheWeekIndex(
            Math.ceil(startDate.getMomentDate().date() / 7)
          );
        } else {
          // We need to take the day that the event was created.
          recurrObj = new Recurrence.MonthlyPattern();
          recurrObj.DayOfMonth = parseInt(startDate.Day, 10);
        }
      }
      break;
    case 'YEARLY':
      const parsedMonth = parseInt(byMonth, 10);
      // debugger;
      if (byMonthDay !== undefined) {
        // Slice off the (), and take the number by parsing, but ensure that if empty, not NaN.
        recurrObj = new Recurrence.YearlyPattern();
        recurrObj.DayOfMonth = parseInt(byMonthDay, 10);
      } else {
        recurrObj = new Recurrence.RelativeYearlyPattern();

        let dayOfWeekIndexNum = parseInt(byWeekNo, 10);
        if (dayOfWeekIndexNum === -1) {
          // debugger;
          dayOfWeekIndexNum = 5; // When it is the last weekend all the time/ ??? how to handle
        }
        dayOfWeekIndexNum -= 1; // Becuz exchange feels like saying 0 is the first week

        recurrObj.DayOfTheWeek = parseStringToEwsWeekDay(byWeekDay);
        recurrObj.DayOfTheWeekIndex = dayOfWeekIndexNum;
      }
      recurrObj.Month = parsedMonth;
      break;
    default:
      console.log('(createNewEwsRecurrenceObj) Default 1');
      return -1;
  }

  recurrObj.StartDate = startDate;
  if (untilAfter !== undefined && untilAfter !== null) {
    recurrObj.NumberOfOccurrences = parseInt(untilAfter, 10);
  } else if (untilDate !== undefined && untilDate !== null) {
    recurrObj.EndDate = new DateTime(moment.tz(untilDate.toUnixTime() * 1000, tzid));
  } else {
    recurrObj.HasEnd = false;
  }
  // switch (untilType) {
  //   case 'o':
  //     // Filter to just Y/M/D, don't need any time.
  //     recurrObj.EndDate = new DateTime(moment(untilDate));
  //     break;
  //   case 'a':
  //     // Ensure it is a number.
  //     recurrObj.NumberOfOccurrences = parseInt(untilAfter, 10);
  //     break;
  //   case 'n':
  //     // No end, rip. Constant expansion here we go.
  //     recurrObj.HasEnd = false;
  //     break;
  //   default:
  //     console.log('(editEwsRecurrenceObj) Default 2');
  //     return -1;
  // }

  // recurrObj.Interval = recurrInterval.toString();
  recurrObj.Interval = 1; // We gonna assume 1,
  return recurrObj;
};
