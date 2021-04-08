/* eslint global-require:0 */
import MailspringStore from 'mailspring-store';
import {
  CREATE_TABLE_AUTH,
  CREATE_TABLE_CALENDAR,
  CREATE_TABLE_CALENDAR_DATA,
  CREATE_TABLE_PENDING_TASKS,
  CREATE_TABLE_RECURRENCE_PATTERN,
} from '../../../internal_packages/calendar-weiyang/lib/db-utils/create-tables';
import {
  FETCH_AUTH,
  FETCH_CALENDAR,
  FETCH_CALENDAR_DATA,
  FETCH_RECURRENCE_PATTERN,
} from '../../../internal_packages/calendar-weiyang/lib/db-utils/fetch-db';
import {
  DELETE_ALL_RECURRING_EVENTS,
  DELETE_SINGLE_EVENT,
  DELETE_FUTURE_RECCURRING_EVENTS,
  UPDATE_ALL_RECURRING_EVENTS,
  UPDATE_SINGLE_EVENT,
  UPDATE_FUTURE_RECURRING_EVENTS,
  UPDATE_ICALSTRING,
  DELETE_NON_MASTER_EVENTS,
  UPDATE_MASTER_EVENT,
  DB_ROUTE,
  CALDAV_PROVIDER,
  ICLOUD_ACCOUNT,
  GMAIL_ACCOUNT,
  EWS_ACCOUNT,
  ICLOUD_URL,
} from '../../../internal_packages/calendar-weiyang/lib/src/components/constants';
import { fetchCaldavEvents } from '../../../internal_packages/calendar-weiyang/lib/src/components/fetch-event/utils/fetch-caldav-event';
import Actions from '../actions';
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(process.cwd(), DB_ROUTE);

class CalendarPluginStore extends MailspringStore {
  constructor(props) {
    super(props);

    this.listenTo(Actions.addIcloudCalendarData, this.addIcloudCalendarData);
    this.listenTo(Actions.deleteIcloudCalendarData, this.deleteIcloudCalendarData);
    this.listenTo(Actions.updateIcloudCalendarData, this.updateIcloudCalendarData);

    this.listenTo(Actions.upsertIcloudRpLists, this.upsertIcloudRpLists);
    this.listenTo(Actions.deleteIcloudRpLists, this.deleteIcloudRpLists);

    this.listenTo(Actions.addIcloudCalendarLists, this.addIcloudCalendarLists);
    this.listenTo(Actions.toggleCalendarLists, this.toggleCalendarLists);
    this.listenTo(Actions.deleteIcloudCalendarLists, this.deleteIcloudCalendarLists);

    this.listenTo(Actions.setAuth, this.setAuth);

    this.listenTo(Actions.closeDb, this.closeDb);

    this.listenTo(Actions.fetchTrigger, this.fetchTrigger);

    this._calendarData = {
      icloud: [],
      gmail: [],
      ews: [],
    };
    this._calendarLists = {
      icloud: [],
      gmail: [],
      ews: [],
    };
    this._auth = {
      icloud: [],
      gmail: [],
      ews: [],
    };
    this._recurPatternLists = {
      icloud: [],
      gmail: [],
      ews: [],
    };
    this._userDb = new sqlite3.Database(dbPath, err => {
      if (err) {
        return console.log('error connecting to db', err.message);
      }
      console.log('connected to db');
    });
    this._userDb.serialize(() => {
      // Create table if doesn't exist
      this._userDb.run(CREATE_TABLE_AUTH);
      this._userDb.run(CREATE_TABLE_CALENDAR);
      this._userDb.run(CREATE_TABLE_CALENDAR_DATA);
      this._userDb.run(CREATE_TABLE_PENDING_TASKS);
      this._userDb.run(CREATE_TABLE_RECURRENCE_PATTERN);

      this._userDb.all(FETCH_CALENDAR_DATA, [], (err, rows) => {
        if (err) {
          throw err;
        }
        rows.forEach(row => {
          console.log('calendar data row', row);
          if (row.providerType === CALDAV_PROVIDER && row.caldavType === ICLOUD_URL) {
            row.start = JSON.parse(row.start);
            row.end = JSON.parse(row.end);
            row.originalStartTime = JSON.parse(row.originalStartTime);
            this._calendarData.icloud.push(row);
          }
        });
        console.log(this._calendarData);
      });

      this._userDb.all(FETCH_RECURRENCE_PATTERN, [], (err, rows) => {
        if (err) {
          throw err;
        }
        // TODO gotta check if EWS has recurpatterns, and how to separate gmail/icloud caldav
        this._recurPatternLists.icloud = [...this._recurPatternLists.icloud, ...rows];
        console.log(this._recurPatternLists);
      });

      this._userDb.all(FETCH_CALENDAR, [], (err, rows) => {
        if (err) {
          throw err;
        }
        console.log(rows);
        rows.forEach(row => {
          if (row.providerType === CALDAV_PROVIDER && row.url.includes('icloud')) {
            this._calendarLists.icloud.push(row);
          }
        });
        console.log(this._calendarLists);
      });

      this._userDb.all(FETCH_AUTH, [], (err, rows) => {
        if (err) {
          throw err;
        }
        rows.forEach(row => {
          if (row.providerType === CALDAV_PROVIDER && row.caldavType === ICLOUD_ACCOUNT) {
            this._auth.icloud.push(row);
            fetchCaldavEvents(row.username, row.password, ICLOUD_URL);
            // periodic background sync
            console.log('appenv mainwindow', AppEnv.isMainwindow);
            if (AppEnv.isMainwindow) {
              setInterval(() => {
                console.log('testing interval every 3min');
                fetchCaldavEvents(row.username, row.password, ICLOUD_URL);
              }, 1000 * 60 * 3);
            }
          }
        });
      });
    });
  }

  closeDb = () => {
    this._userDb.close(err => {
      return err ? console.log('error while closing db', err) : null;
    });
  };
  fetchTrigger = () => {
    this.trigger();
  };

  parseCalendarDataIntoDBformat = event => {
    const dbFormat = [
      event.attendee,
      event.caldavType,
      event.id,
      event.caldavUrl,
      event.calendarId,
      event.colorId,
      event.created,
      event.description,
      JSON.stringify(event.end),
      event.etag,
      event.iCALString,
      event.iCalUID,
      event.isAllDay,
      event.isMaster,
      event.isRecurring,
      event.location,
      event.organizer,
      event.originalId,
      JSON.stringify(event.originalStartTime),
      event.owner,
      event.providerType,
      event.recurringEventId,
      JSON.stringify(event.start),
      event.summary,
      event.updated,
    ];
    return dbFormat;
  };
  parseRecurrencePatternIntoDbFormat = rp => {
    const dbFormat = [
      rp.byEaster,
      rp.byHour,
      rp.byMinute,
      rp.byMonth,
      rp.byMonthDay,
      rp.bySecond,
      rp.bySetPos,
      rp.byWeekDay,
      rp.byWeekNo,
      rp.byYearDay,
      rp.colorId,
      rp.exDates,
      rp.freq,
      rp.iCALString,
      rp.iCalUID,
      rp.id,
      rp.interval,
      rp.isAllDay,
      rp.modifiedThenDeleted,
      rp.numberOfRepeats,
      rp.originalId,
      rp.recurrenceIds,
      rp.recurringTypeId,
      rp.until,
      rp.weeklyPattern,
      rp.wkSt,
    ];
    return dbFormat;
  };
  parseCalendarIntoDbFormat = calendar => {
    const dbFormat = [
      calendar.calendarId,
      calendar.checked,
      calendar.description,
      calendar.name,
      calendar.ownerId,
      calendar.providerType,
      calendar.timezone,
      calendar.url,
    ];
    return dbFormat;
  };
  parseAuthIntoDbFormat = auth => {
    const dbFormat = [auth.providerType, auth.caldavType, auth.username, auth.password];
    return dbFormat;
  };

  deleteIcloudRpLists = toBeDeletedId => {
    this._recurPatternLists.icloud = this._recurPatternLists.icloud.filter(
      rp => rp.iCalUID !== toBeDeletedId
    );
    this._userDb.run(`DELETE FROM RecurrencePattern WHERE iCalUID=?`, toBeDeletedId, err => {
      if (err) {
        return console.log(err.message);
      }
    });
  };
  toggleCalendarLists = (type, calendarId, value) => {
    let sqlCommand = '';
    let prepareStatement = '';
    let values = null;
    switch (type) {
      case ICLOUD_ACCOUNT:
        this._calendarLists.icloud.forEach(calendar => {
          if (calendar.calendarId === calendarId) {
            calendar.checked = value;
          }
        });
        sqlCommand = 'UPDATE Calendar SET checked=? WHERE calendarId=?';
        prepareStatement = this._userDb.prepare(sqlCommand);
        values = [value, calendarId];
        prepareStatement.run(values, err => {
          if (err) {
            return console.log(err.message);
          }
        });
        break;
      default:
        throw 'no such provider';
    }
    this.trigger();
  };
  addIcloudCalendarLists = calendarLists => {
    if (calendarLists.length > 0) {
      this._calendarLists.icloud = [...this._calendarLists.icloud, ...calendarLists];
      let placeholders = '(?,?,?,?,?,?,?,?)';
      let sqlCommand =
        'INSERT INTO Calendar(calendarId, checked, description, name, ownerId, providerType, timezone, url) VALUES' +
        placeholders;
      let prepareStatement = this._userDb.prepare(sqlCommand);
      let values = calendarLists.map(calendar => this.parseCalendarIntoDbFormat(calendar));
      for (const value of values) {
        prepareStatement.run(value, err => {
          if (err) {
            return console.log(err);
          }
        });
      }
      prepareStatement.finalize();
      this.trigger();
    }
  };
  deleteIcloudCalendarLists = toBeDeleted => {
    this._calendarLists.icloud.filter(calendar => calendar.calendarId !== toBeDeleted.calendarId);
    this._userDb.run(`DELETE FROM Calendar WHERE calendarId=?`, toBeDeleted.calendarId, err => {
      if (err) {
        return console.log(err.message);
      }
    });
    this.trigger();
  };
  addIcloudCalendarData = events => {
    if (events.length > 0) {
      // remove any related event by iCalUID since new expanded events to be added would have similar copies
      this._calendarData.icloud = this._calendarData.icloud.filter(
        evt => evt.iCalUID !== events[0].iCalUID
      );
      this._userDb.run(`DELETE FROM CalendarData WHERE iCalUID=?`, events[0].iCalUID, err => {
        if (err) {
          return console.log(err.message);
        }
      });

      // add the events
      this._calendarData.icloud = [...this._calendarData.icloud, ...events];
      let placeholders = '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      let sqlCommand =
        'INSERT INTO CalendarData(attendee, caldavType, id, caldavUrl, calendarId, colorId, created, description, end, etag, iCALString, iCalUID, isAllDay, isMaster, isRecurring, location, organizer, originalId, originalStartTime, owner, providerType, recurringEventId, start, summary, updated) VALUES' +
        placeholders;
      let prepareStatement = this._userDb.prepare(sqlCommand);
      let values = events.map(event => this.parseCalendarDataIntoDBformat(event));
      for (const value of values) {
        prepareStatement.run(value, err => {
          if (err) {
            return console.log(err);
          }
        });
      }
      prepareStatement.finalize();
      this.trigger();
    }
  };

  upsertIcloudRpLists = editedRp => {
    // Insert if rp doesn't exist, update if it exist
    let foundRpIndex = null;
    let foundRp = [];
    let sqlCommand = '';
    let values = '';
    let prepareStatement = '';
    foundRp = this._recurPatternLists.icloud.filter((originalRp, idx) => {
      if (originalRp.iCalUID === editedRp.iCalUID) {
        foundRpIndex = idx;
        return originalRp;
      }
    });
    if (foundRpIndex === null) {
      // inserting new rp
      this._recurPatternLists.icloud = [...this._recurPatternLists.icloud, editedRp];
      sqlCommand =
        'INSERT INTO RecurrencePattern(byEaster, byHour, byMinute, byMonth, byMonthDay, bySecond, bySetPos, byWeekDay, byWeekNo, byYearDay, colorId, exDates, freq, iCALString, iCalUID, id, interval, isAllDay, modifiedThenDeleted, numberOfRepeats, originalId, recurrenceIds, recurringTypeId, until, weeklyPattern, wkSt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      prepareStatement = this._userDb.prepare(sqlCommand);
      values = this.parseRecurrencePatternIntoDbFormat(editedRp);
      prepareStatement.run(values, err => {
        if (err) {
          return console.log(err.message);
        }
      });
      prepareStatement.finalize();
    } else if (foundRp.length === 1) {
      // updating old rp
      editedRp.id = foundRp[0].id; // assign back local id
      this._recurPatternLists.icloud[foundRpIndex] = {
        ...this._recurPatternLists.icloud[foundRpIndex],
        ...editedRp,
      };
      sqlCommand =
        'UPDATE RecurrencePattern SET byEaster=?, byHour=?, byMinute=?, byMonth=?, byMonthDay=?, bySecond=?, bySetPos=?, byWeekDay=?, byWeekNo=?, byYearDay=?, colorId=?, exDates=?, freq=?, iCALString=?, iCalUID=?, id=?, interval=?, isAllDay=?, modifiedThenDeleted=?, numberOfRepeats=?, originalId=?, recurrenceIds=?, recurringTypeId=?, until=?, weeklyPattern=?, wkSt=? WHERE id=?';
      prepareStatement = this._userDb.prepare(sqlCommand);
      values = [
        this.parseRecurrencePatternIntoDbFormat(this._recurPatternLists[foundRpIndex]),
        foundRp[0].id,
      ];
      prepareStatement.run(values, err => {
        if (err) {
          return console.log(err.message);
        }
      });
      prepareStatement.finalize();
    } else {
      console.log('Duplicate recurrence pattern in reflux store');
    }
  };

  updateIcloudCalendarData = (id, editedData, updateType, dataDateTime = null) => {
    let toBeEditedEventIds = [];
    let toBeEditedEvents = [];
    let sqlCommand = '';
    let values = '';
    let prepareStatement = '';
    switch (updateType) {
      case UPDATE_SINGLE_EVENT:
      case UPDATE_MASTER_EVENT:
        // update single event via id
        toBeEditedEvents = this._calendarData.icloud.filter((event, eventId) => {
          if (event.id === id) {
            toBeEditedEventIds.push(eventId);
            return event;
          }
        });
        break;
      case UPDATE_FUTURE_RECURRING_EVENTS:
        // updates future events via iCalUID and datetime restriction
        toBeEditedEvents = this._calendarData.icloud.filter((event, eventId) => {
          if (event.iCalUID === id && event.start.dateTime >= dataDateTime) {
            toBeEditedEventIds.push(eventId);
            return event;
          }
        });
        break;
      case UPDATE_ICALSTRING:
      case UPDATE_ALL_RECURRING_EVENTS:
        // updates icalstring/all events via iCalUID
        toBeEditedEvents = this._calendarData.icloud.filter((event, eventId) => {
          if (event.iCalUID === id) {
            toBeEditedEventIds.push(eventId);
            return event;
          }
        });
        break;
      default:
        console.log('Should not reach here');
    }
    for (let i = 0; i < toBeEditedEventIds.length; i++) {
      let toBeEditedId = toBeEditedEventIds[i];
      this._calendarData.icloud[toBeEditedId] = { ...toBeEditedEvents[i], ...editedData };
      sqlCommand =
        'UPDATE CalendarData SET attendee=?, caldavType=?, id=?, caldavUrl=?, calendarId=?, colorId=?, created=?, description=?, end=?, etag=?, iCALString=?, iCALUID=?, isAllDay=?, isMaster=?, isRecurring=?, location=?, organizer=?, originalId=?, originalStartTime=?, owner=?, providerType=?, recurringEventId=?, start=?, summary=?, updated=? WHERE id=?';
      prepareStatement = this._userDb.prepare(sqlCommand);
      values = [
        this.parseCalendarDataIntoDBformat(this._calendarData.icloud[toBeEditedId]),
        toBeEditedEvents[i].id,
      ];
      prepareStatement.run(values, err => {
        if (err) {
          return console.log(err.message);
        }
      });
    }
    prepareStatement.finalize();
    this.trigger();
  };

  deleteIcloudCalendarData = (dataId, deleteType, dataDatetime = null) => {
    switch (deleteType) {
      case DELETE_SINGLE_EVENT:
        // delete via local id
        this._calendarData.icloud = this._calendarData.icloud.filter(event => {
          return event.id !== dataId;
        });
        this._userDb.run(`DELETE FROM CalendarData WHERE id=?`, dataId, err => {
          if (err) {
            return console.log(err.message);
          }
        });
        break;
      case DELETE_ALL_RECURRING_EVENTS:
        // delete via recurringEventId
        this._calendarData.icloud = this._calendarData.icloud.filter(event => {
          return event.recurringEventId !== dataId;
        });
        this._userDb.run(`DELETE FROM CalendarData WHERE recurringEventId=?`, dataId, err => {
          if (err) {
            return console.log(err.message);
          }
        });
        break;
      case DELETE_FUTURE_RECCURRING_EVENTS:
        // delete via iCalUID
        this._calendarData.icloud = this._calendarData.icloud.filter(event => {
          // delete events that are equal or later than datetime and id matches
          if (!(event.iCalUID === dataId && event.start.dateTime >= dataDatetime)) {
            return event;
          } else {
            this._userDb.run(`DELETE FROM CalendarData WHERE id=?`, event.id, err => {
              if (err) {
                return console.log(err.message);
              }
            });
          }
        });
        break;
      case DELETE_NON_MASTER_EVENTS:
        this._calendarData.icloud = this._calendarData.icloud.filter(event => {
          // deletes event that are not master and id matches
          if (
            !(
              event.recurringEventId === dataId &&
              (event.isMaster === null || event.isMaster === undefined || !event.isMaster)
            )
          ) {
            return event;
          } else {
            this._userDb.run(`DELETE FROM CalendarData WHERE id=?`, event.id, err => {
              if (err) {
                return console.log(err.message);
              }
            });
          }
        });
        break;
      default:
        console.log('Should not reach here');
    }
    this.trigger();
  };

  setAuth = (authData, type) => {
    switch (type) {
      case ICLOUD_ACCOUNT:
        // check if account exist
        // eslint-disable-next-line no-case-declarations
        const [authExists] = this._auth.icloud.filter(
          account =>
            account.username === authData.username &&
            account.password === authData.password &&
            account.providerType === authData.providerType
        );
        if (authExists === undefined) {
          this._auth.icloud = [...this._auth.icloud, authData];

          let placeholders = '(?,?,?,?)';
          let sqlCommand =
            'INSERT INTO Auth(providerType, caldavType, username, password) VALUES' + placeholders;
          let prepareStatement = this._userDb.prepare(sqlCommand);
          let values = this.parseAuthIntoDbFormat(authData);
          prepareStatement.run(values, err => {
            if (err) {
              return console.log(err);
            }
          });
        }
        break;
      default:
        throw 'no such provider';
    }
    this.trigger();
  };

  getCalendarData = type => {
    switch (type) {
      case ICLOUD_ACCOUNT:
        return this._calendarData.icloud;
      case EWS_ACCOUNT:
        return this._calendarData.ews;
      case GMAIL_ACCOUNT:
        return this._calendarData.gmail;
      default:
        return this._calendarData.icloud.concat(this._calendarData.ews, this._calendarData.gmail);
    }
  };
  getCalendarLists = type => {
    switch (type) {
      case ICLOUD_ACCOUNT:
        return this._calendarLists.icloud;
      case EWS_ACCOUNT:
        return this._calendarLists.ews;
      case GMAIL_ACCOUNT:
        return this._calendarLists.gmail;
      default:
        return this._calendarLists.icloud.concat(
          this._calendarLists.ews,
          this._calendarLists.gmail
        );
    }
  };
  getAuth = type => {
    switch (type) {
      case ICLOUD_ACCOUNT:
        return this._auth.icloud;
      case EWS_ACCOUNT:
        return this._auth.ews;
      case GMAIL_ACCOUNT:
        return this._auth.gmail;
      default:
        return this._auth.icloud.concat(this._auth.ews, this._auth.gmail);
    }
  };
  getRpLists = type => {
    switch (type) {
      case ICLOUD_ACCOUNT:
        return this._recurPatternLists.icloud;
      case EWS_ACCOUNT:
        return this._recurPatternLists.ews;
      case GMAIL_ACCOUNT:
        return this._recurPatternLists.gmail;
      default:
        return this._recurPatternLists.icloud.concat(
          this._recurPatternLists.ews,
          this._recurPatternLists.gmail
        );
    }
  };
}

export default new CalendarPluginStore();
