import path from 'path';
import fs from 'fs';
import Sequelize, { Model, DataTypes } from 'sequelize';
import Accounts from './schemas/accounts';
import Calendars from './schemas/calendars';
import EventPersons from './schemas/eventPersons';
import Events from './schemas/events';
import PendingActions from './schemas/pendingActions';
import RecurrencePatterns from './schemas/recurrencePatterns';

let db;
export const getdb = async () => {
  if (db) {
    // db.sync to ensure that all tables are loaded onto the db
    await db.sync();
    return db;
  }
  const configDirPath = AppEnv.getConfigDirPath();
  const dbPath = path.join(configDirPath, 'calendar-db');
  // const configDirPath = './app/internal_packages/calendar/lib/mailprep/app';
  // const dbPath = path.join(configDirPath, 'calendar-db');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath);
  }
  console.log('****storage', `${dbPath}/calendar-db.sqlite`);
  db = new Sequelize({
    dialect: 'sqlite',
    storage: `calendar-db.sqlite`,
    logging: false,
    storage: `${dbPath}/calendar-db.sqlite`
  });

  // #region Users Init
  Accounts.init(
    {
      personId: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      originalId: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      providerType: {
        type: Sequelize.STRING
      },
      accessToken: {
        type: Sequelize.STRING
      },
      accessTokenExpiry: {
        type: Sequelize.INTEGER
      },
      password: {
        type: Sequelize.STRING
      },
      homeUrl: {
        type: Sequelize.STRING
      },
      principalUrl: {
        type: Sequelize.STRING
      },
      caldavType: {
        type: Sequelize.STRING
      },
      json: {
        type: Sequelize.STRING
      }
    },
    {
      sequelize: db,
      modelName: 'accounts'
    }
  );
  // #endregion

  // #region Calendars Init
  Calendars.init(
    {
      calendarUrl: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      ownerId: {
        type: Sequelize.STRING
      },
      displayName: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.STRING
      },
      location: {
        type: Sequelize.STRING
      },
      timezone: {
        type: Sequelize.STRING
      },
      color: {
        type: Sequelize.STRING
      },
      ctag: {
        type: Sequelize.STRING
      },
      json: {
        type: Sequelize.STRING
      }
    },
    {
      sequelize: db,
      modelName: 'calendars'
    }
  );
  // #endregion

  // #region Events Init
  Events.init(
    {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      originalId: {
        type: Sequelize.STRING
      },
      htmlLink: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'confirmed'
      },
      created: {
        type: Sequelize.STRING
      },
      updated: {
        type: Sequelize.STRING
      },
      summary: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.STRING,
        defaultValue: 'confirmed'
      },
      location: {
        type: Sequelize.STRING,
        defaultValue: 'confirmed'
      },
      colorId: {
        type: Sequelize.STRING
      },
      creator: {
        type: Sequelize.STRING
      },
      organizer: {
        type: Sequelize.STRING
      },
      start: {
        type: Sequelize.JSON
      },
      end: {
        type: Sequelize.JSON
      },
      endTimeUnspecified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      recurrence: {
        type: Sequelize.ARRAY(Sequelize.RANGE(Sequelize.STRING))
      },
      recurringEventId: {
        type: Sequelize.STRING
      },
      originalStartTime: {
        type: Sequelize.JSON
      },
      transparency: {
        type: Sequelize.STRING
      },
      visibility: {
        type: Sequelize.STRING
      },
      iCalUID: {
        type: Sequelize.STRING
      },
      sequence: {
        type: Sequelize.INTEGER
      },
      attendee: {
        type: DataTypes.STRING
      },
      anyoneCanAddSelf: {
        type: Sequelize.BOOLEAN
      },
      guestsCanInviteOthers: {
        type: Sequelize.BOOLEAN
      },
      guestsCanModify: {
        type: Sequelize.BOOLEAN
      },
      guestsCanSeeOtherGuests: {
        type: Sequelize.BOOLEAN
      },
      privateCopy: {
        type: Sequelize.BOOLEAN
      },
      locked: {
        type: Sequelize.BOOLEAN
      },
      allDay: {
        type: Sequelize.BOOLEAN
      },
      calendarId: {
        type: Sequelize.STRING
      },
      hangoutLink: {
        type: Sequelize.STRING
      },
      source: {
        type: Sequelize.JSON
      },
      providerType: {
        type: Sequelize.STRING
      },
      caldavType: {
        type: Sequelize.STRING
      },
      owner: {
        // email that it belongs to as exchange users might not have email
        type: Sequelize.STRING
      },
      incomplete: {
        // incomplete is a flag to mark that it was just created and might not be complete
        type: Sequelize.BOOLEAN
      },
      local: {
        // local for dealing with pending actions
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      hide: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdOffline: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      isRecurring: {
        type: Sequelize.BOOLEAN
      },
      isModifiedThenDeleted: {
        type: Sequelize.BOOLEAN
      },
      caldavUrl: {
        type: Sequelize.STRING
      },
      etag: {
        type: Sequelize.STRING
      },
      iCALString: {
        type: Sequelize.TEXT
      },
      isMaster: {
        type: Sequelize.BOOLEAN
      }
    },
    {
      sequelize: db,
      modelName: 'events'
    }
  );
  // #endregion

  // #region PendingActions Init
  PendingActions.init(
    {
      uniqueId: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      eventId: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.STRING
      },
      recurrenceType: {
        type: Sequelize.STRING
      }
    },
    {
      sequelize: db,
      modelName: 'pendingactions'
    }
  );
  // #endregion

  // #region Recurrence{atterns Init
  RecurrencePatterns.init(
    {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      recurringTypeId: {
        type: Sequelize.STRING
      },
      originalId: {
        type: Sequelize.STRING
      },
      freq: {
        type: Sequelize.STRING
      },
      interval: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      until: {
        type: Sequelize.STRING
      },

      wkSt: {
        type: Sequelize.STRING
      },

      exDates: {
        type: DataTypes.STRING,
        defaultValue: ''
      },
      recurrenceIds: {
        type: Sequelize.STRING,
        defaultValue: ''
      },

      modifiedThenDeleted: {
        type: Sequelize.BOOLEAN
      },
      weeklyPattern: {
        // type: Sequelize.ARRAY(Sequelize.RANGE(Sequelize.INTEGER))
        type: Sequelize.STRING
      },

      numberOfRepeats: {
        type: Sequelize.INTEGER
      },
      isCount: {
        type: Sequelize.BOOLEAN
      },

      iCalUID: {
        type: Sequelize.STRING
      },
      iCALString: {
        type: Sequelize.STRING
      },

      byWeekNo: {
        type: Sequelize.STRING,
        default: ''
      },
      byWeekDay: {
        type: Sequelize.STRING,
        default: ''
      },
      byMonth: {
        type: Sequelize.STRING,
        defaultValue: ''
      },
      byMonthDay: {
        type: Sequelize.STRING,
        defaultValue: ''
      },
      byYearDay: {
        type: Sequelize.STRING,
        defaultValue: ''
      },

      byHour: {
        type: Sequelize.STRING,
        defaultValue: ''
      },
      byMinute: {
        type: Sequelize.STRING,
        default: ''
      },
      bySecond: {
        type: Sequelize.STRING,
        defaultValue: ''
      },
      byEaster: {
        type: Sequelize.STRING,
        defaultValue: ''
      },
      bySetPos: {
        type: Sequelize.STRING,
        defaultValue: ''
      }
    },
    {
      sequelize: db,
      modelName: 'recurrencepatterns'
    }
  );
  // #endregion

  // #region EventPersons Init
  EventPersons.init(
    {
      eventPersonId: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      eventId: {
        type: Sequelize.STRING
      },
      personId: {
        type: Sequelize.STRING
      }
    },
    {
      sequelize: db,
      modelName: 'eventpersons'
    }
  );
  // #endregion

  // #region Setting associations
  Accounts.hasMany(Calendars, {
    foreignKey: {
      name: 'ownerId'
    },
    onDelete: 'CASCADE'
  });
  Calendars.belongsTo(Accounts, {
    foreignKey: {
      name: 'ownerId'
    }
  });

  Calendars.hasMany(Events, {
    foreignKey: {
      name: 'calendarId'
    },
    onDelete: 'CASCADE'
  });
  Events.belongsTo(Calendars, {
    foreignKey: {
      name: 'calendarId'
    }
  });

  Events.hasMany(EventPersons, {
    onDelete: 'CASCADE'
  });
  EventPersons.belongsTo(Events);

  Events.hasMany(RecurrencePatterns, {
    onDelete: 'CASCADE'
  });
  RecurrencePatterns.belongsTo(Events);

  Events.hasMany(PendingActions, {
    onDelete: 'CASCADE'
  });
  PendingActions.belongsTo(Events);

  // #endregion

  // db functions are async, wait for db to be fully loaded before returning it.
  await db.sync();
  return db;
};

export default getdb;
