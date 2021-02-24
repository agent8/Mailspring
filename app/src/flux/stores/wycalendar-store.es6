/* eslint global-require:0 */
import MailspringStore from 'mailspring-store';
import Actions from '../actions';

class WyCalendarStore extends MailspringStore {
  constructor(props) {
    super(props);

    this.listenTo(Actions.setIcloudCalendarData, this.setIcloudCalendarData);
    this.listenTo(Actions.setIcloudCalendarLists, this.setIcloudCalendarLists);
    this.listenTo(Actions.setIcloudAuth, this.setIcloudAuth);

    this._icloudCalendarData = [];
    this._icloudCalendarLists = [];
    this._icloudAuth = [];
  }

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
}

export default new WyCalendarStore();
