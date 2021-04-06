import React, { Fragment } from 'react';
import { Checkbox, FormControlLabel } from '@material-ui/core';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { ICLOUD_ACCOUNT } from './constants';

class CalendarListView extends React.Component {
  constructor(props) {
    super(props);
  }
  componentDidMount = () => {
    this.setState(state => ({
      ...state,
    }));
  };
  handleChange = e => {
    console.log(e.target.checked);
    Actions.toggleCalendarLists(ICLOUD_ACCOUNT, e.target.name, e.target.checked);
  };
  render() {
    const { props, state } = this;
    return (
      <Fragment>
        {props.calendarLists.map((calendar, id) => {
          console.log(calendar);
          return (
            <FormControlLabel
              key={id}
              control={
                <Checkbox
                  checked={calendar.checked === 1 || calendar.checked ? true : false}
                  onChange={this.handleChange}
                  name={calendar.calendarId}
                />
              }
              label={calendar.name}
            />
          );
        })}
      </Fragment>
    );
  }
}

export default CalendarListView;
