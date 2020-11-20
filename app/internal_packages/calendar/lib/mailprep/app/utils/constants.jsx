/* eslint-disable prefer-destructuring */
import moment from 'moment';
import md5 from 'md5';
// import { ExtendedPropertyDefinition, StringHelper } from 'ews-javascript-api';
import uuidv4 from 'uuid';
import * as windowZones from './windowsZone.json';

export const OUTLOOK = 'OUTLOOK';
export const GOOGLE = 'GOOGLE';
export const EXCHANGE = 'EXCHANGE';
export const CALDAV = 'CALDAV';

export const ICLOUD = 'ICLOUD';
export const FASTMAIL = 'FASTMAIL';
export const YAHOO = 'YAHOO';

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export const dropDownTime = (currentTime) => {
  const timeOptions = [];
  let hour = 0;
  let initialTime = 0;
  let minute;
  let value;
  if (currentTime !== '') {
    initialTime = parseInt(currentTime.substring(0, 2), 10) * 2;
    if (currentTime.substring(2) === '30') {
      initialTime += 1;
    }
  }
  // currentTime algo needs to be tweaked for same time shown in start and end.
  for (let i = initialTime; i < 48; i += 1) {
    // eslint-disable-next-line no-unused-expressions
    i % 2 === 0 ? (minute = '00') : (minute = '30');
    hour = convertHour(Math.floor(i / 2));
    value = hour + minute;
    timeOptions.push({ value, label: value });
  }
  return timeOptions;
};

const convertHour = (i) => {
  if (i < 10) {
    return `0${i.toString()}:`;
  }
  return `${i.toString()}:`;
};

export const filterIntoSchema = (dbEvent, type, owner, local, id, exchangeRecurrence) => {
  const schemaCastedDbObject = {};
  switch (type) {
    case GOOGLE: {
      [
        'kind',
        'etag',
        'extendedProperties',
        'conferenceData',
        'reminders',
        'attachments',
        'hangoutLink'
      ].forEach((e) => delete dbEvent[e]);
      dbEvent.originalId = dbEvent.id;
      dbEvent.id = md5(dbEvent.id);
      dbEvent.creator = dbEvent.creator;
      dbEvent.providerType = GOOGLE;
      dbEvent.owner = owner;
      dbEvent.incomplete = false;
      dbEvent.hide = false;

      return dbEvent;
    }
    case OUTLOOK: {
      ['@odata.etag'].forEach((e) => delete dbEvent[e]);

      schemaCastedDbObject.id = md5(dbEvent.id);
      schemaCastedDbObject.originalId = dbEvent.id;
      schemaCastedDbObject.htmlLink = dbEvent.webLink;
      schemaCastedDbObject.status = dbEvent.isCancelled ? 'cancelled' : 'confirmed';
      schemaCastedDbObject.created = dbEvent.createdDateTime;
      schemaCastedDbObject.updated = dbEvent.lastModifiedDateTime;
      schemaCastedDbObject.summary = dbEvent.subject;
      schemaCastedDbObject.description = dbEvent.bodyPreview; // Might need to use .body instead, but it returns html so idk how to deal w/ it now
      schemaCastedDbObject.location = JSON.stringify(dbEvent.location.coordinates); // We need to convert coordinates coz idk how else to represent it
      schemaCastedDbObject.creator = dbEvent.organizer.emailAddress.address;
      schemaCastedDbObject.organizer = {
        email: dbEvent.organizer.emailAddress.address,
        displayName: dbEvent.organizer.emailAddress.name
      };
      schemaCastedDbObject.start = {
        dateTime: dbEvent.start.dateTime,
        timezone: dbEvent.originalStartTimeZone
      };
      schemaCastedDbObject.end = {
        dateTime: dbEvent.end.dateTime,
        timezone: dbEvent.originalEndTimeZone
      };
      // schemaCastedDbObject.endTimeUnspecified = dbEvent.responseStatus;
      // schemaCastedDbObject.recurrence = dbEvent.recurrence;      // Need to write converted from microsoft graph lib to standard array
      schemaCastedDbObject.recurringEventId =
        dbEvent.seriesMasterId === null || dbEvent.seriesMasterId === undefined
          ? ''
          : dbEvent.seriesMasterId;
      schemaCastedDbObject.originalStartTime = {
        dateTime: dbEvent.originalStartTime,
        timezone: dbEvent.originalStartTimeZone
      };
      // schemaCastedDbObject.transparency = dbEvent.responseStatus;
      schemaCastedDbObject.visibility = 'default';
      schemaCastedDbObject.iCalUID = dbEvent.iCalUId;
      // schemaCastedDbObject.sequence = dbEvent.responseStatus;
      // schemaCastedDbObject.attendees = dbEvent.attendees;
      schemaCastedDbObject.owner = dbEvent.owner;

      // schemaCastedDbObject.anyoneCanAddSelf = dbEvent.responseStatus;
      // schemaCastedDbObject.guestsCanInviteOthers = dbEvent.responseStatus;
      // schemaCastedDbObject.guestsCanModify = dbEvent.responseStatus;
      // schemaCastedDbObject.guestsCanSeeOtherGuests = dbEvent.responseStatus;
      // schemaCastedDbObject.privateCopy = dbEvent.responseStatus;
      // schemaCastedDbObject.locked = dbEvent.responseStatus;
      schemaCastedDbObject.allDay = dbEvent.isAllDay;

      // schemaCastedDbObject.calenderId = dbEvent.responseStatus;
      // schemaCastedDbObject.source = dbEvent.responseStatus;
      schemaCastedDbObject.providerType = OUTLOOK;
      schemaCastedDbObject.incomplete = false;
      schemaCastedDbObject.hide = false;

      return schemaCastedDbObject;
    }
    case EXCHANGE: {
      /*
        Wow, exchange is actually super hard to handle. I never thought it would be this bad. But lets get into the details.

        So, due to how it was originally written for C#, when you create a new appointment, the only variables you have are what you defined
        When you get the item or any classes that inherit items, there is a chance that the variables in items are null/undefined.

        And when an object is null/undefined, due to how C# is built, it will throw an error,
        YOU CANNOT CHECK === UNDEFINED/NULL. That DOES NOT WORK.

        You have to wrap it in a try catch statement, which is really stupid as what if I have a dozen variables that are null/undefined? then what?

        Okay, so now onto how to properly handle it. Argh, can't believe I got stuck on this for so long. fml.

        When a user creates a new event in our calendar, I create an appointment with 4 basic cases.
          1. Subject
          2. Body (Description) / Even thou idk how to get it yet, but figure this out later
          3. Start time / Moment class
          4. End time / Moment class

        A very important thing to note is that if it throws an error, it just says null. It does not say undefined, or what variable it is
        so for code aesthics, I need to have a function that takes in a string, and if it returns an error, do something.

        Now, onto creating a new event.

        When I create a new event, I can ONLY assume I will have a few variables. ID and whatever I defined above.
        THIS MEANS EVEN IF I GET IT FROM THE SERVER, it could still be null. EWS takes awhile to setup all the stuff, which makes sense.

        So, for example, if I create something new, I need to mark it as uncompleted or something
        and the next time, or after a short period of time, request for the new set of data. and unmark it if it is now synced with the server.
        Note: I can't use last modified as last modified is also undefined. fk LOL

        the safest way to know if it is undefined is to check if it is a new object, the deal breaker now is if I should define it in the function params.
        should I add a new field in the events to mark it as new, and ignore? what happens if the user wants it immediatly? then how

        Okay, so if the user don't need it immediatly, that is okay

        but if the user wants to add or edit it imemdiatly, we have an issueeeee, coz I will have lack of information.
        If the user wants it immediatly, I can ??? what can I do LOL

        Talk to shuhao tmr, and ask how you think we should deal with this case.
      */
      const allMapZones = windowZones.default.supplementalData.windowsZones.mapTimezones.windowZone;
      let mapZones;

      if (local) {
        mapZones = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } else {
        // This is because you will get a null error when accessing dbEvent that does not exist.
        // eslint-disable-next-line no-underscore-dangle
        mapZones = allMapZones.filter((zone) => zone._name === dbEvent.TimeZone)[0];
      }

      let tz;
      if (mapZones === undefined || mapZones === null) {
        tz = { _type: 'Atlantic/Reykjavik' }; // Assume default as UTC/GMT
      } else if (local) {
        tz = { _type: mapZones };
      } else {
        // eslint-disable-next-line no-underscore-dangle
        tz = mapZones.mapZone.filter((terrZone) => terrZone._territory === '001')[0]; // This assumes golden territory as discussed previously due to windows timezone.
      }

      schemaCastedDbObject.id = uuidv4();
      schemaCastedDbObject.originalId = dbEvent.Id === null ? id : dbEvent.Id.UniqueId;
      schemaCastedDbObject.start = {
        dateTime: dbEvent.Start.getMomentDate().unix(),
        // eslint-disable-next-line no-underscore-dangle
        timezone: tz._type
        // dateTime: dbEvent.Start.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ')
      };
      schemaCastedDbObject.end = {
        dateTime: dbEvent.End.getMomentDate().unix(),
        // eslint-disable-next-line no-underscore-dangle
        timezone: tz._type
      };
      schemaCastedDbObject.owner = dbEvent.owner === undefined ? owner : dbEvent.owner;
      schemaCastedDbObject.providerType = EXCHANGE;
      schemaCastedDbObject.summary = dbEvent.Subject;
      schemaCastedDbObject.incomplete = false;
      schemaCastedDbObject.local = local;
      schemaCastedDbObject.hide = false;
      // schemaCastedDbObject.attendee = [];

      // The problem here now is that appointment type can be a recurring object but we dk
      // And I cannot access this or icaluid w/o try catch or checking if its local.
      // Therefore, I need to think that if it is a recurring object, and is local, how?
      // Services like outlook just say no to you, lel,
      if (!local) {
        schemaCastedDbObject.isRecurring = dbEvent.AppointmentType !== 'Single';
        schemaCastedDbObject.iCalUID = dbEvent.ICalUid;
        if (schemaCastedDbObject.isRecurring && dbEvent.RecurrenceMasterId) {
          schemaCastedDbObject.recurringEventId = dbEvent.RecurrenceMasterId.UniqueId;
        } else {
          // console.log('Appointment might not have a recurring id');
        }
      } else {
        // If we get here, we assume its a pending object, that might not have legit data.
        // Therefore, iCalUID does not really matter as it will be deleted in the future.
        // In this case, everytime local is true, there will be an id param. I am just re-using that
        schemaCastedDbObject.isRecurring = exchangeRecurrence !== undefined;
        schemaCastedDbObject.iCalUID = id;
        // Completeness only
        if (schemaCastedDbObject.isRecurring) {
          // So recurringEventId keeps the bond between the recurring master object
          schemaCastedDbObject.recurringEventId = exchangeRecurrence.id;
        } else {
          // console.log('Appointment might not have a recurring id');
        }
      }
      // { iCalUID: { value: 'ICalUid', defaultValue: '', type: 'needed' } },

      [
        {
          description: {
            value: 'Body',
            defaultValue: '',
            type: 'optionalFunc',
            func() {
              return dbEvent.Body.text;
            }
          }
        },
        { location: { value: 'Location', defaultValue: '', type: 'optional' } },
        {
          htmlLink: {
            value: 'WebClientReadFormQueryString',
            defaultValue: '',
            type: 'needed'
          }
        },
        {
          allDay: {
            value: 'IsAllDayEvent',
            defaultValue: false,
            type: 'needed'
          }
        },
        // { iCalUID: { value: 'ICalUid', defaultValue: '', type: 'needed' } },
        {
          created: {
            value: 'DateTimeCreated',
            defaultValue: '',
            type: 'neededFunc',
            func() {
              return dbEvent.DateTimeCreated.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ');
            }
          }
        },
        {
          updated: {
            value: 'LastModifiedTime',
            defaultValue: '',
            type: 'neededFunc',
            func() {
              // debugger;
              return dbEvent.LastModifiedTime.getMomentDate().format('YYYY-MM-DDTHH:mm:ssZ');
            }
          }
        },
        {
          status: {
            value: 'IsCancelled',
            defaultValue: 'confirmed',
            type: 'neededFunc',
            func() {
              return dbEvent.IsCancelled === undefined || dbEvent.IsCancelled === null
                ? 'confirmed'
                : 'cancelled';
            }
          }
        },
        {
          organizer: {
            value: 'Organizer',
            defaultValue: '',
            type: 'neededFunc',
            func() {
              return dbEvent.Organizer.address;
            }
          }
        }
      ].forEach((objMightHaveNothing) => {
        Object.keys(objMightHaveNothing).forEach((key) => {
          // console.log(key + ", " + objMightHaveNothing[key]);
          if (objMightHaveNothing[key].type === 'optional') {
            exchangeTryCatchCanBeNull(
              schemaCastedDbObject,
              key,
              dbEvent,
              objMightHaveNothing[key].value,
              objMightHaveNothing[key].defaultValue
            );
          } else if (objMightHaveNothing[key].type === 'optionalFunc') {
            exchangeTryCatchCanBeNullFunc(
              schemaCastedDbObject,
              key,
              dbEvent,
              objMightHaveNothing[key].value,
              objMightHaveNothing[key].defaultValue,
              objMightHaveNothing[key].func
            );
          } else if (objMightHaveNothing[key].type === 'needed') {
            exchangeTryCatchCannotBeNull(
              schemaCastedDbObject,
              key,
              dbEvent,
              objMightHaveNothing[key].value,
              objMightHaveNothing[key].defaultValue
            );
          } else if (objMightHaveNothing[key].type === 'neededFunc') {
            exchangeTryCatchCannotBeNullFunc(
              schemaCastedDbObject,
              key,
              dbEvent,
              objMightHaveNothing[key].value,
              objMightHaveNothing[key].defaultValue,
              objMightHaveNothing[key].func
            );
          }
        });
      });

      // /*
      //   Issues

      //   1. Body is now selecting a class, it should be selecting Body.Text
      //   2. Status, Created, Updated and Organizer are all null due to it being a new object.

      // */
      // try {
      //   // schemaCastedDbObject.htmlLink = dbEvent.WebClientReadFormQueryString === null ? "" : dbEvent.WebClientReadFormQueryString;
      //   // schemaCastedDbObject.status = (dbEvent.IsCancelled === undefined || dbEvent.IsCancelled === null) ? 'confirmed' : 'cancelled';
      //   // schemaCastedDbObject.created = dbEvent.DateTimeCreated.getMomentDate().format("YYYY-MM-DDTHH:mm:ssZ");
      //   // schemaCastedDbObject.updated = dbEvent.LastModifiedTime.getMomentDate().format("YYYY-MM-DDTHH:mm:ssZ");

      //   // schemaCastedDbObject.description = (dbEvent.Body === undefined || dbEvent.Body === null) ? "" : dbEvent.Body; // IDK WHY BODY HAS ISSUE. WHAT.

      //   // schemaCastedDbObject.location = dbEvent.Location === null ? "" : dbEvent.location;
      //   // schemaCastedDbObject.creator = dbEvent.Organizer.address;

      //   // schemaCastedDbObject.organizer = { email: dbEvent.Organizer.address, displayName: dbEvent.Organizer.name };
      //   // schemaCastedDbObject.organizer = { email: dbEvent.Organizer.name, displayName: dbEvent.Organizer.name }; // This makes no sense, address does not exist in the organizer object, LOL

      //   // schemaCastedDbObject.endTimeUnspecified = dbEvent.responseStatus;
      //   // schemaCastedDbObject.recurrence = dbEvent.Recurrence();      // Need to write converted from microsoft EWS to some format.
      //   // schemaCastedDbObject.recurringEventId = dbEvent.ICalRecurrenceId;
      //   // schemaCastedDbObject.originalStartTime = { dateTime: dbEvent.originalStartTime, timezone: dbEvent.originalStartTimeZone };
      //   // schemaCastedDbObject.transparency = dbEvent.responseStatus;
      //   // schemaCastedDbObject.visibility = "default";
      //   // schemaCastedDbObject.iCalUID = dbEvent.ICalUid;
      //   // schemaCastedDbObject.sequence = dbEvent.responseStatus;
      //   // schemaCastedDbObject.attendees = dbEvent.attendees;

      //   // schemaCastedDbObject.anyoneCanAddSelf = dbEvent.responseStatus;
      //   // schemaCastedDbObject.guestsCanInviteOthers = dbEvent.responseStatus;
      //   // schemaCastedDbObject.guestsCanModify = dbEvent.responseStatus;
      //   // schemaCastedDbObject.guestsCanSeeOtherGuests = dbEvent.responseStatus;
      //   // schemaCastedDbObject.privateCopy = dbEvent.responseStatus;
      //   // schemaCastedDbObject.locked = dbEvent.responseStatus;
      //   // schemaCastedDbObject.allDay = dbEvent.IsAllDayEvent;

      //   // schemaCastedDbObject.calenderId = dbEvent.responseStatus;
      //   // schemaCastedDbObject.source = dbEvent.responseStatus;

      //   schemaCastedDbObject.incomplete = false;
      // } catch (e) {
      //   schemaCastedDbObject.incomplete = true;
      //   console.log("Exchange Object " + dbEvent.Subject + " is incomplete", schemaCastedDbObject);
      //   debugger;
      // }
      return schemaCastedDbObject;
    }
    case CALDAV: {
      return dbEvent;
    }
    default: {
      console.log(`Provider ${type} not available`);
    }
  }
};

const exchangeTryCatchCanBeNull = (
  object,
  objectType,
  appointment,
  appointmentType,
  defaultValue
) => {
  try {
    if (appointment[appointmentType] == null) {
      object[objectType] = defaultValue;
    } else {
      object[objectType] = appointment[appointmentType];
    }
  } catch (e) {
    object[objectType] = defaultValue;
  }
};

const exchangeTryCatchCanBeNullFunc = (
  object,
  objectType,
  appointment,
  appointmentType,
  defaultValue,
  func
) => {
  try {
    const value = func();
    if (value == null) {
      object[objectType] = defaultValue;
    } else {
      object[objectType] = value;
    }
  } catch (e) {
    object[objectType] = defaultValue;
  }
};

const exchangeTryCatchCannotBeNull = (
  object,
  objectType,
  appointment,
  appointmentType,
  defaultValue
) => {
  try {
    object[objectType] = appointment[appointmentType];
  } catch (e) {
    object[objectType] = defaultValue;
    object.incomplete = true;
  }
};

const exchangeTryCatchCannotBeNullFunc = (
  object,
  objectType,
  appointment,
  appointmentType,
  defaultValue,
  func
) => {
  try {
    const value = func();
    object[objectType] = value;
  } catch (e) {
    object[objectType] = defaultValue;
    object.incomplete = true;
  }
};

export const filterUsersIntoSchema = (rxObj) => ({
  personId: rxObj.personId,
  originalId: rxObj.originalId,
  email: rxObj.email,
  providerType: rxObj.providerType,
  accessToken: rxObj.accessToken,
  accessTokenExpiry: rxObj.accessTokenExpiry,
  password: rxObj.password
});

export const filterEventIntoSchema = (rxObj) => ({
  allDay: rxObj.allDay,
  id: rxObj.id,
  end: rxObj.end,
  start: rxObj.start,
  created: rxObj.created,
  updated: rxObj.updated,
  summary: rxObj.summary,
  organizer: rxObj.organizer,
  recurrence: rxObj.recurrence,
  iCalUID: rxObj.iCalUID,
  attendees: rxObj.attendees,
  htmlLink: rxObj.htmlLink,
  originalId: rxObj.originalId,
  owner: rxObj.owner,
  incomplete: rxObj.incomplete,
  providerType: rxObj.providerType,
  status: rxObj.status,
  local: rxObj.local,
  hide: rxObj.hide
});
