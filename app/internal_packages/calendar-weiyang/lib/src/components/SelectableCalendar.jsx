import React from 'react';
import { Calendar, Views, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Fragment } from 'react';
import AddForm from './AddForm';
import Grid from '@material-ui/core/Grid';
import Login from './Login';
import BigButton from './MiniComponents/BigButton';
import WyCalendarStore from '../../../../../src/flux/stores/wycalendar-store.es6';

const propTypes = {};
const localizer = momentLocalizer(moment);
class SelectableCalendar extends React.Component {
  constructor(...args) {
    super(...args);
    this.state = {
      events: [],
      start: '',
      end: '',
      addFormPopout: false,
      loginFormPopout: false,
      icloudCalendarData: WyCalendarStore.getIcloudCalendarData(),
    };
    this.mounted = false;
  }
  componentDidMount = () => {
    this.mounted = true;
    this.unsubscribers = [];
    this.unsubscribers.push(WyCalendarStore.listen(this.onStoreChange));
  };
  componentWillUnmount() {
    return this.unsubscribers.map(unsubscribe => unsubscribe());
  }
  onStoreChange = () => {
    if (this.mounted) {
      return this.setState(prevState => ({
        ...prevState,
        icloudCalendarData: WyCalendarStore.getIcloudCalendarData(),
      }));
    }
  };
  handleSelect = ({ start, end }) => {
    this.setState(prevState => ({
      ...prevState,
      start: start,
      end: end,
    }));
    this.setAddFormPopout(true);
  };
  setAddFormPopout = boolValue => {
    this.setState(prevState => ({
      ...prevState,
      addFormPopout: boolValue,
    }));
  };
  setLoginFormPopout = boolValue => {
    this.setState(prevState => ({
      ...prevState,
      loginFormPopout: boolValue,
    }));
  };
  formatIcloudCalendarData = () => {
    const formattedIcloudEvent = this.state.icloudCalendarData
      .filter(event => !event.hide)
      .map(event => {
        return {
          id: event.id,
          title: event.summary,
          // The format here is crucial, it converts the unix time, which is in gmt,
          // To the machine timezone, therefore, displaying it accordingly.
          // moment.unix() because time is stored in seconds, not miliseconds.
          end: new Date(moment.unix(event.end.dateTime).format()),
          start: new Date(moment.unix(event.start.dateTime).format()),
          colorId: event.colorId,
          originalId: event.originalId,
          iCalUID: event.iCalUID,
          isRecurring: event.isRecurring,
          providerType: event.providerType,
          caldavType: event.caldavType,
          calendarId: event.calendarId,
          iCalString: event.iCALString,
          isAllDay: event.isAllDay,
          attendee: event.attendee ? JSON.parse(event.attendee) : undefined,
          organizer: event.organizer,
          owner: event.owner,
          isMaster: event.isMaster,
        };
      });
    return formattedIcloudEvent;
  };
  render() {
    console.log('reflux data', this.state.icloudCalendarData);
    const formattedIcloudEvent = this.formatIcloudCalendarData();
    return (
      <Fragment>
        {this.state.addFormPopout ? (
          <AddForm
            start={this.state.start}
            end={this.state.end}
            parentPropFunction={this.setAddFormPopout}
            parentPropState={this.state.addFormPopout}
          />
        ) : null}
        <Grid container spacing={3}>
          <Grid item xs={9}>
            <Calendar
              selectable
              localizer={localizer}
              events={formattedIcloudEvent}
              defaultView={Views.MONTH}
              onSelectEvent={event => console.log('test')}
              onSelectSlot={this.handleSelect}
            />
          </Grid>
          <Grid item xs={3}>
            <Login
              parentPropFunction={this.setLoginFormPopout}
              parentPropState={this.state.loginFormPopout}
            />
            <BigButton variant="small-blue" onClick={() => this.setLoginFormPopout(true)}>
              Login
            </BigButton>
          </Grid>
        </Grid>
      </Fragment>
    );
  }
}

SelectableCalendar.propTypes = propTypes;

export default SelectableCalendar;
