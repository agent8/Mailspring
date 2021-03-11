import React, { Children } from 'react';
import { Calendar, Views, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Fragment } from 'react';
import AddForm from './create-event/add-event-form';
import EditForm from './edit-event/edit-event-form';
import Grid from '@material-ui/core/Grid';
import Login from './fetch-event/login-view';
import BigButton from './MiniComponents/big-button';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  deleteSingleEvent,
  deleteAllEvents,
  deleteFutureEvents,
} from './delete-event/delete-event-utils';

const dateClassStyleWrapper = ({ children, value }) =>
  React.cloneElement(Children.only(children), {
    style: {
      ...children.style,
      // backgroundColor: value < CURRENT_DATE ? 'lightgreen' : 'lightblue'
    },
  });
const propTypes = {};
const localizer = momentLocalizer(moment);
class SelectableCalendar extends React.Component {
  constructor(...args) {
    super(...args);
    this.state = {
      events: [],
      start: '',
      end: '',
      editId: '',
      addFormPopout: false,
      editFormPopout: false,
      loginFormPopout: false,
      icloudCalendarData: CalendarPluginStore.getIcloudCalendarData(),
    };
    this.mounted = false;
  }
  componentDidMount = () => {
    this.mounted = true;
    this.unsubscribers = [];
    this.unsubscribers.push(CalendarPluginStore.listen(this.onStoreChange));
  };
  componentWillUnmount() {
    return this.unsubscribers.map(unsubscribe => unsubscribe());
  }
  onStoreChange = () => {
    if (this.mounted) {
      return this.setState(prevState => ({
        ...prevState,
        icloudCalendarData: CalendarPluginStore.getIcloudCalendarData(),
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
  setEditFormPopout = boolValue => {
    this.setState(prevState => ({
      ...prevState,
      editFormPopout: boolValue,
    }));
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
  generateBarColor = (calColor, isAllDay, attendees, organizer, owner) => {
    let color = calColor;
    if (attendees && attendees[0] && owner !== organizer) {
      // if owner and organizer is different, it is an invited event
      const ownerIndex = Object.keys(attendees).filter(key => attendees[key]['email'] === owner);
      color =
        attendees[ownerIndex] && attendees[ownerIndex]['partstat'] === 'NEEDS-ACTION'
          ? 'invite'
          : calColor;
    }
    if (isAllDay) {
      return color ? `event-bar-allday--${color}` : 'event-bar-allday--blue';
    } else {
      return color ? `event-bar--${color}` : 'event-bar--blue';
    }
  };
  handleEventClick = async (event, target) => {
    const eventPresent = CalendarPluginStore.getIcloudCalendarData().filter(
      storedEvent => storedEvent.id === event.id
    );
    if (eventPresent.length === 0) {
      console.log('Event not in reflux');
      return;
    }
    this.setState(prevState => ({
      ...prevState,
      editId: event.id,
    }));
    this.renderEventPopup(event, target);
  };
  closeModal = () => {
    Actions.closePopover();
    Actions.closeModal();
  };
  handleDeleteEvent = event => {
    if (event.isRecurring) {
      Actions.openModal({
        component: (
          <div className="popup-modal">
            <h5>You're deleting an event</h5>
            <p>
              Do you want to delete all occurrences of this event, or only the selected occurrence?
            </p>
            <div className="modal-button-group">
              <BigButton variant="small-blue" onClick={() => Actions.closeModal()}>
                Cancel
              </BigButton>
              {event.isMaster ? (
                <BigButton
                  variant="small-white"
                  onClick={() => this.deleteAllRecurrenceEvent(event)}
                >
                  Delete All
                </BigButton>
              ) : (
                <BigButton
                  variant="small-white"
                  onClick={() => this.deleteFutureRecurrenceEvent(event)}
                >
                  Delete All Future Events
                </BigButton>
              )}
              <BigButton variant="small-white" onClick={() => this.deleteEvent(event)}>
                Delete Only This Event
              </BigButton>
            </div>
          </div>
        ),
        width: 510,
        height: 170,
      });
    } else {
      this.deleteEvent(event);
    }
  };
  // #region Delete functionality
  deleteEvent = event => {
    deleteSingleEvent(event.id);
    this.closeModal();
  };

  deleteAllRecurrenceEvent = event => {
    deleteAllEvents(event.id);
    this.closeModal();
  };

  deleteFutureRecurrenceEvent = event => {
    deleteFutureEvents(event.id);
    this.closeModal();
  };
  editEvent = event => {
    const { props } = this;
  };

  renderEventPopup = (event, target) => {
    Actions.openPopover(
      <div style={{ height: 300, width: 400 }}>
        <div className="modal-btn-grp">
          <button className="modal-btn" type="button" onClick={() => this.handleDeleteEvent(event)}>
            &#128465;
          </button>
          <button className="modal-btn" type="button" onClick={() => this.editEvent(event)}>
            &#9998;
          </button>
          <button className="modal-btn" type="button" onClick={this.closeModal}>
            &#120;
          </button>
        </div>

        <div style={{ paddingLeft: 10, paddingRight: 10 }}>
          <h4 ref={subtitle => (this.subtitle = subtitle)}>{event.title}</h4>
          <p className="modal-date-text">
            {moment(event.start).format('MMMM D YYYY, h:mm a')} -{' '}
            {moment(event.end).format('MMMM D YYYY, h:mm a')}
          </p>
          {event.attendee && Object.keys(event.attendee).length > 1 ? (
            <div>
              <p>{Object.keys(event.attendee).length} Guests</p>
              {Object.keys(event.attendee).map((key, index) =>
                event.owner === event.organizer &&
                event.attendee[key]['email'] === event.owner ? null : (
                  <p key={index}>{event.attendee[key]['email']}</p>
                )
              )}
            </div>
          ) : null}
        </div>
      </div>,
      {
        // originRect,
        originRect: { top: target.clientY, left: target.clientX },
        disablePointer: true,
        direction: 'right',
        className: 'popout-container',
      }
    );
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
        {this.state.editFormPopout ? (
          <EditForm
            id={this.state.editId}
            parentPropFunction={this.setEditFormPopout}
            parentPropState={this.state.editFormPopout}
          />
        ) : null}
        <Grid container spacing={3}>
          <Grid item xs={9}>
            <Calendar
              selectable
              localizer={localizer}
              events={formattedIcloudEvent}
              views={{
                month: true,
                week: true,
                day: true,
              }}
              resizable
              onNavigate={date => {
                this.setState({
                  dateSelected: date,
                  dateSelectedTimeStamp: moment(date).unix(),
                });
              }}
              eventPropGetter={event => ({
                className: this.generateBarColor(
                  event.colorId,
                  event.isAllDay,
                  event.attendee,
                  event.organizer,
                  event.owner
                ),
              })}
              components={{
                dateCellWrapper: dateClassStyleWrapper,
              }}
              onSelectSlot={this.handleSelect}
              onSelectEvent={(event, target) => {
                target.persist();
                this.handleEventClick(event, target);
              }}
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
