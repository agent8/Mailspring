/* eslint global-require:0 */
import MailspringStore from 'mailspring-store';
import Actions from '../actions';

class WyCalendarStore extends MailspringStore {
  constructor(props) {
    super(props);

    this.listenTo(Actions.setIcloudCalendarData, this.setIcloudCalendarData);
    this._icloudCalendarData = [];
  }

  setIcloudCalendarData = data => {
    this._icloudCalendarData = data;
    this.trigger();
  };
  getIcloudCalendarData = () => {
    return this._icloudCalendarData;
  };
}

export default new WyCalendarStore();
