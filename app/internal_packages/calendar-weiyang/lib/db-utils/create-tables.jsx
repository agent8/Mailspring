/* eslint-disable spellcheck/spell-checker */
export const CREATE_TABLE_CALENDAR_DATA =
  'CREATE TABLE IF NOT EXISTS CalendarData(\
    attendee TEXT NULL, \
    caldavType TEXT NULL, \
    id TEXT PRIMARY KEY NOT NULL, \
    caldavUrl TEXT NULL, \
    calendarId TEXT NULL, \
    colorId TEXT NULL, \
    created INTEGER NULL, \
    description TEXT NULL, \
    end TEXT NULL, \
    etag TEXT NULL, \
    iCALString TEXT NULL, \
    iCalUID TEXT NULL, \
    isAllDay INTEGER NULL, \
    isMaster INTEGER NULL, \
    isRecurring INTEGER NULL, \
    location TEXT NULL, \
    organizer TEXT NULL, \
    originalId TEXT NULL, \
    originalStartTime TEXT NULL, \
    owner TEXT NULL, \
    providerType TEXT NOT NULL, \
    recurringEventId TEXT NULL, \
    start TEXT NULL, \
    summary TEXT NULL, \
    updated INTEGER NULL);';

export const CREATE_TABLE_RECURRENCE_PATTERN =
  'CREATE TABLE IF NOT EXISTS RecurrencePattern(\
    byEaster TEXT NULL, \
    byHour TEXT NULL, \
    byMinute TEXT, \
    byMonth TEXT NULL, \
    byMonthDay TEXT NULL, \
    bySecond TEXT NULL, \
    bySetPos TEXT NULL, \
    byWeekDay TEXT NULL, \
    byWeekNo TEXT NULL, \
    byYearDay TEXT NULL, \
    colorId TEXT NULL, \
    exDates TEXT NULL, \
    freq TEXT NULL, \
    iCALString TEXT NULL, \
    iCalUID TEXT NULL, \
    id TEXT NOT NULL PRIMARY KEY, \
    interval INTEGER NULL, \
    isAllDay INTEGER NULL, \
    modifiedThenDeleted INTEGER NULL, \
    numberOfRepeats INTEGER NULL, \
    originalId TEXT NULL, \
    recurrenceIds TEXT NOT NULL, \
    recurringTypeId INTEGER NULL, \
    until TEXT NULL, \
    weeklyPattern TEXT NULL, \
    wkSt TEXT NULL);';

export const CREATE_TABLE_CALENDAR =
  'CREATE TABLE IF NOT EXISTS Calendar(\
    calendarId TEXT PRIMARY KEY NOT NULL, \
    checked INTEGER NOT NULL, \
    description TEXT NULL, \
    name TEXT NULL, \
    ownerId TEXT NULL, \
    providerType TEXT NULL, \
    timezone TEXT NULL, \
    url TEXT NULL);';

export const CREATE_TABLE_AUTH =
  'CREATE TABLE IF NOT EXISTS Auth(\
    providerType TEXT NOT NULL, \
    caldavType TEXT NULL, \
    username TEXT NOT NULL, \
    password TEXT NOT NULL);';

export const CREATE_TABLE_PENDING_TASKS =
  'CREATE TABLE IF NOT EXISTS PendingTask(\
    id INTEGER PRIMARY KEY AUTOINCREMENT, \
    createdAt TEXT NOT NULL, \
    providerType TEXT NOT NULL, \
    taskType TEXT NOT NULL, \
    authDetails TEXT NOT NULL, \
    calendarDetails TEXT NOT NULL, \
    noOfTries INTEGER NOT NULL);';
