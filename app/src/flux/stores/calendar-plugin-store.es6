/* eslint global-require:0 */
import MailspringStore from 'mailspring-store';
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
  UPSERT_RECURRENCE_PATTERN,
  UPDATE_RECURRENCE_PATTERN,
} from '../../../internal_packages/calendar-weiyang/lib/src/components/constants';
import Actions from '../actions';

class CalendarPluginStore extends MailspringStore {
  constructor(props) {
    super(props);

    this.listenTo(Actions.setIcloudCalendarData, this.setIcloudCalendarData);
    this.listenTo(Actions.addIcloudCalendarData, this.addIcloudCalendarData);
    this.listenTo(Actions.setIcloudCalendarLists, this.setIcloudCalendarLists);
    this.listenTo(Actions.setIcloudAuth, this.setIcloudAuth);
    this.listenTo(Actions.deleteIcloudCalendarData, this.deleteIcloudCalendarData);
    this.listenTo(Actions.setIcloudRpLists, this.setIcloudRpLists);
    this.listenTo(Actions.deleteIcloudRpLists, this.deleteIcloudRpLists);
    this.listenTo(Actions.updateIcloudCalendarData, this.updateIcloudCalendarData);
    this.listenTo(Actions.updateIcloudRpLists, this.updateIcloudRpLists);

    this._icloudCalendarData = [];
    this._icloudCalendarLists = [];
    this._icloudAuth = [];
    this._icloudRpLists = [];
  }

  deleteIcloudRpLists = toBeDeletedId => {
    this._icloudRpLists = this._icloudRpLists.filter(rp => rp.iCalUID !== toBeDeletedId);
  };

  addIcloudCalendarData = events => {
    if (events.length > 0) {
      // remove any related event by iCalUID since new events to be added would have similar copies
      this._icloudCalendarData = this._icloudCalendarData.filter(
        evt => evt.iCalUID !== events[0].iCalUID
      );
      this._icloudCalendarData = [...this._icloudCalendarData, ...events];
      this.trigger();
    }
  };

  updateIcloudRpLists = (editedRp, updateType, id = null) => {
    let foundRpIndex = null;
    let foundRp = [];
    switch (updateType) {
      case UPSERT_RECURRENCE_PATTERN:
        foundRp = this._icloudRpLists.filter((originalRp, idx) => {
          if (originalRp.iCalUID === editedRp.iCalUID) {
            foundRpIndex = idx;
            return originalRp;
          }
        });
        if (foundRpIndex === null) {
          // inserting new rp
          this._icloudRpLists = [...this._icloudRpLists, editedRp];
        } else if (foundRp.length === 1) {
          // updating old rp
          editedRp.id = foundRp[0].id; // assign back local id
          this._icloudRpLists[foundRpIndex] = editedRp;
        } else {
          console.log('Duplicate recurrence pattern in reflux store');
        }
        break;
      case UPDATE_RECURRENCE_PATTERN:
        // update rp via originalId
        foundRp = this._icloudRpLists.filter((originalRp, idx) => {
          if (originalRp.originalId === id) {
            foundRpIndex = idx;
            return originalRp;
          }
        });
        this._icloudRpLists[foundRpIndex] = { ...this._icloudRpLists[foundRpIndex], ...editedRp };
        break;
    }
  };

  updateIcloudCalendarData = (id, editedData, updateType, dataDateTime = null) => {
    let toBeEditedEventIds = [];
    let toBeEditedEvents = [];
    switch (updateType) {
      case UPDATE_SINGLE_EVENT:
      case UPDATE_MASTER_EVENT:
        // update single event via id
        toBeEditedEvents = this._icloudCalendarData.filter((event, eventId) => {
          if (event.id === id) {
            toBeEditedEventIds.push(eventId);
            return event;
          }
        });
        break;
      case UPDATE_FUTURE_RECURRING_EVENTS:
        // updates future events via iCalUID and datetime restriction
        toBeEditedEvents = this._icloudCalendarData.filter((event, eventId) => {
          if (event.iCalUID === id && event.start.dateTime >= dataDateTime) {
            toBeEditedEventIds.push(eventId);
            return event;
          }
        });
        break;
      case UPDATE_ICALSTRING:
      case UPDATE_ALL_RECURRING_EVENTS:
        // updates icalstring/all events via iCalUID
        toBeEditedEvents = this._icloudCalendarData.filter((event, eventId) => {
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
      this._icloudCalendarData[toBeEditedId] = { ...toBeEditedEvents[i], ...editedData };
    }
    this.trigger();
  };

  deleteIcloudCalendarData = (dataId, deleteType, dataDatetime = null) => {
    switch (deleteType) {
      case DELETE_SINGLE_EVENT:
        // delete via local id
        this._icloudCalendarData = this._icloudCalendarData.filter(event => {
          return event.id !== dataId;
        });
        break;
      case DELETE_ALL_RECURRING_EVENTS:
        // delete via recurringEventId
        this._icloudCalendarData = this._icloudCalendarData.filter(event => {
          return event.recurringEventId !== dataId;
        });
        break;
      case DELETE_FUTURE_RECCURRING_EVENTS:
        // delete via iCalUID
        this._icloudCalendarData = this._icloudCalendarData.filter(event => {
          // delete events that are equal or later than datetime and id matches
          return !(event.iCalUID === dataId && event.start.dateTime >= dataDatetime);
        });
        break;
      case DELETE_NON_MASTER_EVENTS:
        this._icloudCalendarData = this._icloudCalendarData.filter(event => {
          // deletes event that are not master and id matches
          return !(
            event.recurringEventId === dataId &&
            (event.isMaster === null || event.isMaster === undefined || !event.isMaster)
          );
        });
        break;
      default:
        console.log('Should not reach here');
    }
    this.trigger();
  };
  setIcloudCalendarData = data => {
    this._icloudCalendarData = [...data];
    this.trigger();
  };
  setIcloudCalendarLists = calendarLists => {
    this._icloudCalendarLists = [...calendarLists];
    this.trigger();
  };
  setIcloudAuth = authData => {
    // if authData exists, array length is 1
    const authExists = this._icloudAuth.filter(
      account =>
        account.username === authData.username &&
        account.password === authData.password &&
        account.providerType === authData.providerType
    );
    if (authExists.length === 0) {
      this._icloudAuth = [...this._icloudAuth, authData];
    }
    this.trigger();
  };
  getIcloudCalendarData = () => {
    return this._icloudCalendarData;
  };
  getIcloudCalendarLists = () => {
    return this._icloudCalendarLists;
  };
  getIcloudAuth = () => {
    return this._icloudAuth;
  };
  setIcloudRpLists = rpLists => {
    this._icloudRpLists = [...rpLists];
  };
  getIcloudRpLists = () => {
    return this._icloudRpLists;
  };
}

export default new CalendarPluginStore();
