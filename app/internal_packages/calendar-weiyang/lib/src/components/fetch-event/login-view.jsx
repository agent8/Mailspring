import React, { Fragment } from 'react';
import BigButton from '../MiniComponents/big-button';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { fetchCaldavEvents } from './utils/fetch-caldav-event';
import { ICLOUD_ACCOUNT } from '../constants';

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      email: 'piadruids@gmail.com',
      password: '',
      accountType: ICLOUD_ACCOUNT,
      calendarData: {},
    };
  }
  componentDidMount() {
    fetch('calendar/icloud-test.txt')
      .then(res => res.text())
      .then(text =>
        this.setState({
          ...this.state,
          password: text,
        })
      );
  }
  handleChange = e => {
    this.setState({ [e.target.name]: e.target.value });
  };
  handleCancel = e => {
    this.props.parentPropFunction(false);
  };
  getCalendarData = async () => {
    const { email, password, accountType } = this.state;
    const finalResult = await fetchCaldavEvents(email, password, accountType);
    return finalResult;
  };

  handleSubmitClick = async e => {
    this.props.parentPropFunction(false);
    // for icloud CalDav
    await this.getCalendarData();
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
