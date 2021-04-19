import React, { Fragment } from 'react';
import { Checkbox, FormControlLabel } from '@material-ui/core';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { CALDAV_PROVIDER, GOOGLE_PROVIDER } from './constants';

class CalendarListSidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      icloud: [],
      gmail: [],
      ews: [],
    };
  }
  componentDidUpdate = prevProps => {
    if (prevProps.calendarLists === this.props.calendarLists) {
      return;
    }
    let icloud = [];
    let gmail = [];
    let ews = [];
    this.props.calendarLists.forEach((calendar, id) => {
      switch (calendar.providerType) {
        case CALDAV_PROVIDER:
          icloud.push(calendar);
          break;
        case GOOGLE_PROVIDER:
          gmail.push(calendar);
          break;
        default:
          throw 'no such provider';
      }
      this.setState({
        icloud,
        gmail,
        ews,
      });
    });
  };
  handleChange = e => {
    Actions.toggleCalendarList(e.target.value, e.target.name, e.target.checked);
  };
  render() {
    const { props, state } = this;
    return (
      <Fragment>
        <h3>Icloud</h3> <hr />
        {state.icloud.length > 0 ? (
          state.icloud.map((calendar, id) => {
            console.log(calendar);
            return (
              <FormControlLabel
                key={id}
                control={
                  <Checkbox
                    checked={calendar.checked === 1 || calendar.checked ? true : false}
                    onChange={this.handleChange}
                    name={calendar.calendarId}
                    value={calendar.providerType}
                  />
                }
                label={calendar.name}
              />
            );
          })
        ) : (
          <p>None</p>
        )}
        <h3>Google</h3> <hr />
        {state.gmail.length > 0 ? (
          state.gmail.map((calendar, id) => {
            console.log(calendar);
            return (
              <FormControlLabel
                key={id}
                control={
                  <Checkbox
                    checked={calendar.checked === 1 || calendar.checked ? true : false}
                    onChange={this.handleChange}
                    name={calendar.calendarId}
                    value={calendar.providerType}
                  />
                }
                label={calendar.name}
              />
            );
          })
        ) : (
          <p>None</p>
        )}
        <h3>Exchange</h3> <hr />
        {state.ews.length > 0 ? (
          state.ews.map((calendar, id) => {
            console.log(calendar);
            return (
              <FormControlLabel
                key={id}
                control={
                  <Checkbox
                    checked={calendar.checked === 1 || calendar.checked ? true : false}
                    onChange={this.handleChange}
                    name={calendar.calendarId}
                    value={calendar.providerType}
                  />
                }
                label={calendar.name}
              />
            );
          })
        ) : (
          <p>None</p>
        )}
      </Fragment>
    );
  }
}

export default CalendarListSidebar;
