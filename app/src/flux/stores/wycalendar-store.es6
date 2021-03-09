/* eslint global-require:0 */
import MailspringStore from 'mailspring-store';
import {
  ALL_RECURRING_EVENTS,
  SINGLE_EVENT,
  FUTURE_RECCURRING_EVENTS,
} from '../../../internal_packages/calendar-weiyang/lib/src/components/constants';
import Actions from '../actions';

class WyCalendarStore extends MailspringStore {
  constructor(props) {
    super(props);

    this.listenTo(Actions.setIcloudCalendarData, this.setIcloudCalendarData);
    this.listenTo(Actions.setIcloudCalendarLists, this.setIcloudCalendarLists);
    this.listenTo(Actions.setIcloudAuth, this.setIcloudAuth);
    this.listenTo(Actions.deleteIcloudCalendarData, this.deleteIcloudCalendarData);
    this.listenTo(Actions.setIcloudRpLists, this.setIcloudRpLists);

    this._icloudCalendarData = [];
    this._icloudCalendarLists = [];
    this._icloudAuth = [];
    this._icloudRpLists = [];
  }

  deleteIcloudCalendarData = (dataId, type, dataDatetime = null) => {
    if (type === SINGLE_EVENT) {
      this._icloudCalendarData = this._icloudCalendarData.filter(event => {
        return event.id !== dataId;
      });
    } else if (type === ALL_RECURRING_EVENTS) {
      this._icloudCalendarData = this._icloudCalendarData.filter(event => {
        return event.recurringEventId !== dataId;
      });
    } else if (type == FUTURE_RECCURRING_EVENTS) {
      this._icloudCalendarData = this._icloudCalendarData.filter(event => {
        // include only when 1) iCalUID matches and datetime is earlier. 2) iCalUID doesn't match
        return (
          (event.iCalUID === dataId && event.start.dateTime < dataDatetime) ||
          event.iCalUID !== dataId
        );
      });
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

export default new WyCalendarStore();
