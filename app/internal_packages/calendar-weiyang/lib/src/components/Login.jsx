import React, { Fragment } from 'react';
import BigButton from './MiniComponents/BigButton';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';
import { getCaldavAccount } from './getCaldavAcc';
import * as PARSER from './parser';
import Actions from '../../../../../src/flux/actions.es6';

const ICLOUD_ACCOUNT = 'ICLOUD_ACCOUNT';
const EWS_ACCOUNT = 'EWS_ACCOUNT';
const YAHOO_ACCOUNT = 'YAHOO_ACCOUNT';

const ICLOUD_URL = 'https://caldav.icloud.com/';

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      email: 'piadruids@gmail.com',
      password: 'xjnf-ttgi-ttyt-jebw',
      accountType: ICLOUD_ACCOUNT,
      calendarData: {},
    };
  }

  handleChange = e => {
    this.setState({ [e.target.name]: e.target.value });
  };
  handleCancel = e => {
    this.props.parentPropFunction(false);
  };
  getCalendarData = async () => {
    const { email, password, accountType } = this.state;
    const res = await getCaldavAccount(email, password, ICLOUD_URL);
    console.log('res', res);
    const calendars = PARSER.parseCal(res.calendars);
    const events = PARSER.parseCalEvents(res.calendars, calendars);
    console.log('events', events);
    const flatEvents = events.reduce((acc, val) => {
      // console.log('accumulator', acc, val);
      return acc.concat(val);
    }, []);
    const filteredEvents = flatEvents.filter(event => event !== '');
    const flatFilteredEvents = filteredEvents.reduce((acc, val) => acc.concat(val), []);
    console.log('flatFilteredEvents', flatFilteredEvents);
    // const eventPersons = PARSER.parseEventPersons(flatFilteredEvents);
    const recurrencePatterns = PARSER.parseRecurrenceEvents(flatFilteredEvents);
    console.log('recurrencePattern', recurrencePatterns);
    const expanded = PARSER.expandRecurEvents(
      flatFilteredEvents.map(calEvent => calEvent.eventData),
      recurrencePatterns
    );
    const finalResult = [
      ...expanded.filter(e => e.isRecurring === true),
      ...flatFilteredEvents
        .filter(e => e.recurData === undefined || e.recurData === null)
        .map(e => e.eventData),
    ];
    finalResult.forEach(e => {
      e.owner = email;
      e.caldavType = accountType;
    });
    console.log('DATA', finalResult);
    return finalResult;
  };

  handleSubmitClick = async e => {
    this.props.parentPropFunction(false);
    Actions.setIcloudCalendarData(await this.getCalendarData());
  };
  render() {
    const { props, state } = this;
    return (
      <Fragment>
        <Dialog onClose={this.handleCancel} open={props.parentPropState} maxWidth="md">
          <DialogContent>
            <form>
              <input
                type="text"
                name="email"
                value={state.email}
                onChange={this.handleChange}
                placeholder="Email"
              />
              <input
                type="password"
                name="password"
                value={state.password}
                onChange={this.handleChange}
                placeholder="Password"
              />
              <label>
                <input
                  type="radio"
                  name="accountType"
                  value={ICLOUD_ACCOUNT}
                  onChange={this.handleChange}
                  defaultChecked
                />
                ICLOUD
              </label>
              <label>
                <input
                  type="radio"
                  name="accountType"
                  value={YAHOO_ACCOUNT}
                  onChange={this.handleChange}
                />
                YAHOO
              </label>
              <label>
                <input
                  type="radio"
                  name="accountType"
                  value={EWS_ACCOUNT}
                  onChange={this.handleChange}
                />
                EWS
              </label>
            </form>
          </DialogContent>
          <DialogActions>
            {/* Save/Cancel buttons */}
            <div className="add-form-button-group">
              <BigButton variant="big-white" onClick={this.handleCancel}>
                Cancel
              </BigButton>
              <BigButton variant="big-blue" onClick={this.handleSubmitClick}>
                Log in
              </BigButton>
            </div>
          </DialogActions>
        </Dialog>
      </Fragment>
    );
  }
}

export default Login;
