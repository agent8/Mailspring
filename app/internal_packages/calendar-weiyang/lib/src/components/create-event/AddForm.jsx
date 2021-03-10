/* eslint-disable spellcheck/spell-checker */
import React, { Component, Fragment } from 'react';
import moment from 'moment';
import ICAL from 'ical.js';
import { Actions } from 'mailspring-exports';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';

import Select from 'react-select';
import BigButton from '../MiniComponents/BigButton';
import RoundCheckbox from '../MiniComponents/RoundCheckbox';
import Tabs from '../MiniComponents/Tabs';
import EventTitle from '../MiniComponents/EventTitle';
import Input from '../MiniComponents/Input';
import RRuleGenerator from '../react-rrule-generator/src/lib';

import { createEvent } from './utils/CreateEventUtils';
import WyCalendarStore from '../../../../../../src/flux/stores/wycalendar-store.es6';
import { fetchCaldavEvents } from '../fetch-event/utils/FetchCaldavEvents';
import { ICLOUD_URL } from '../constants';

const START_INDEX_OF_UTC_FORMAT = 17;
const START_INDEX_OF_HOUR = 11;
const END_INDEX_OF_HOUR = 13;
const TIME_OFFSET = 12;
const START_INDEX_OF_DATE = 0;
const END_INDEX_OF_DATE = 11;
const END_INDEX_OF_MINUTE = 16;

const selectCustomStyles = {
  control: provided => ({
    ...provided,
    backgroundColor: '#fff',
    border: '2px solid darkgrey',
    borderRadius: '15px',
    padding: '10px 15px',
    width: '100%',
  }),
  menu: provided => ({
    ...provided,
    backgroundColor: '#f9fafa',
  }),
  option: (provided, state) => ({
    ...provided,
    padding: '1px 12px',
    fontSize: '14px',
    color: 'grey',
    fontWeight: 'bold',
    ...(state.isSelected && { color: 'white' }),
  }),
  groupHeading: provided => ({
    ...provided,
    color: 'black',
  }),
};

export default class AddForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: '',
      desc: '',
      startParsed: '',
      endParsed: '',
      start: '',
      end: '',
      selectedProvider: '',
      selectedCalendar: '',
      rrule: '',
      isRepeating: false,
      dailyRule: '',
      weeklyRule: '',
      monthlyRule: '',
      yearlyRule: '',
      allDay: false,
      activeTab: 'Details',
      guest: '',
      attendees: [],
      location: '',
      // Popup forms
      isShowConfirmForm: false,
      selectedOption: '',

      calendarLists: WyCalendarStore.getIcloudCalendarLists(),
      auth: WyCalendarStore.getIcloudAuth(),
    };
  }
  componentDidMount() {
    const { props } = this;

    const startDateParsed = moment(props.start);
    const endDateParsed = moment(props.end);

    const rruleDaily = ICAL.Recur.fromData({ freq: 'DAILY' });
    const rruleWeekly = ICAL.Recur.fromData({
      freq: 'WEEKLY',
      byday: [startDateParsed.format('dd').toUpperCase()],
      count: 5,
      interval: 1,
    });
    const rruleMonthlyByWeekNoAndDay = ICAL.Recur.fromData({
      freq: 'MONTHLY',
      byday: [startDateParsed.format('dd').toUpperCase()],
      bysetpos: [this.weekOfMonth(startDateParsed)],
      count: 5,
      interval: 1,
    });
    const startDateParsedInUTC = this.processStringForUTC(
      startDateParsed.format('YYYY-MM-DDThh:mm a')
    );
    const endDateParsedInUTC = this.processStringForUTC(endDateParsed.format('YYYY-MM-DDThh:mm a'));
    this.setState({
      startParsed: startDateParsedInUTC,
      endParsed: endDateParsedInUTC,
      start: props.start,
      end: props.end,
      dailyRule: `RRULE:${rruleDaily.toString()}`,
      weeklyRule: `RRULE:${rruleWeekly.toString()}`,
      monthlyRule: `RRULE:${rruleMonthlyByWeekNoAndDay.toString()}`,
    });
  }
  processStringForUTC = dateInString => {
    let dateInStringInUTC;
    if (dateInString.substring(START_INDEX_OF_UTC_FORMAT) === 'pm') {
      const hourInString = parseInt(
        dateInString.substring(START_INDEX_OF_HOUR, END_INDEX_OF_HOUR),
        10
      );
      const hourInStringInUTC = hourInString + TIME_OFFSET;
      dateInStringInUTC =
        dateInString.substring(START_INDEX_OF_DATE, END_INDEX_OF_DATE) +
        hourInStringInUTC.toString() +
        dateInString.substring(END_INDEX_OF_HOUR, END_INDEX_OF_MINUTE);
    } else {
      dateInStringInUTC = dateInString.substring(START_INDEX_OF_DATE, END_INDEX_OF_MINUTE);
    }
    return dateInStringInUTC;
  };
  weekOfMonth = input => {
    const firstDayOfMonth = input.clone().startOf('month');
    const firstDayOfWeek = firstDayOfMonth.clone().startOf('week');

    const offset = firstDayOfMonth.diff(firstDayOfWeek, 'days');

    return Math.ceil((input.date() + offset) / 7);
  };
  handleChange = event => {
    this.setState({ [event.target.name]: event.target.value });
  };
  guestOnKeyDown = event => {
    if (event.keyCode == 13 && event.target.value !== '') {
      const attendees = this.state.attendees;
      attendees.push(event.target.value);
      this.setState({
        guest: '',
        attendees,
      });
    }
  };
  handleRruleChange = rrule => {
    if (rrule === 'never') {
      this.setState({
        isRepeating: false,
      });
      return;
    }
    const { state } = this;
    this.setState({
      rrule,
      isRepeating: true,
    });

    // CHANGING OF DATE DYNAMICALLY
    const rruleObj = ICAL.Recur._stringToData(rrule);
    if (rruleObj.until !== undefined) {
      rruleObj.until.adjust(1, 0, 0, 0, 0);
    }

    if (rrule === null || rruleObj['rrule:freq'] === 'DAILY') {
      return;
    }

    const dayOfWeek = {
      SU: 0,
      MO: 1,
      TU: 2,
      WE: 3,
      TH: 4,
      FR: 5,
      SA: 6,
    };
    // Change Date based on Weekly/Monthly/Yearly
    let newStartDateParsed = moment(state.start);
    let newEndDateParsed = moment(state.end);
    if (rruleObj['rrule:freq'] === 'WEEKLY' && rruleObj.BYDAY !== undefined) {
      let nextDayDiff;
      const currentDay = moment(state.start).day();

      // If only one day is selected, it will be a string. Else it will be an array
      if (Array.isArray(rruleObj.BYDAY)) {
        nextDayDiff =
          dayOfWeek[rruleObj.BYDAY.includes('SU') ? 'SU' : rruleObj.BYDAY[0]] - currentDay;
      } else {
        nextDayDiff = dayOfWeek[rruleObj.BYDAY] - currentDay;
      }

      // Calculate and set the new date
      newStartDateParsed = moment(state.start).add(nextDayDiff, 'days');
      newEndDateParsed = moment(state.end).add(nextDayDiff, 'days');
    } else if (rruleObj['rrule:freq'] === 'MONTHLY') {
      if (rruleObj.BYDAY !== undefined) {
        newStartDateParsed = moment(newStartDateParsed)
          .set('date', 1)
          .isoWeekday(dayOfWeek[rruleObj.BYDAY] + 7 * rruleObj.BYSETPOS);
      } else if (rruleObj.BYMONTHDAY !== undefined) {
        newStartDateParsed = moment(newStartDateParsed).set('date', rruleObj.BYMONTHDAY);
      }
      newEndDateParsed = moment(state.end).add(
        moment(newStartDateParsed).date() - moment(state.end).date(),
        'days'
      );
    } else if (rruleObj['rrule:freq'] === 'YEARLY') {
      const newYear = moment(state.start).year();
      newStartDateParsed = moment()
        .set('year', newYear)
        .set('month', rruleObj.BYMONTH - 1);

      if (rruleObj.BYMONTHDAY !== undefined) {
        newStartDateParsed.set('date', rruleObj.BYMONTHDAY);
      } else {
        newStartDateParsed
          .set('date', 1)
          .isoWeekday(dayOfWeek[rruleObj.BYDAY] + 7 * rruleObj.BYSETPOS);
      }

      newEndDateParsed = moment(state.end)
        .set('year', newYear)
        .set('month', rruleObj.BYMONTH - 1)
        .set('date', newStartDateParsed.date());
    }
    this.setState({
      start: newStartDateParsed,
      end: newEndDateParsed,
      startParsed: this.processStringForUTC(newStartDateParsed.format('YYYY-MM-DDThh:mm')),
      endParsed: this.processStringForUTC(newEndDateParsed.format('YYYY-MM-DDThh:mm')),
    });
  };

  toggleAllDay = e => {
    const { props } = this;
    const { state } = this;

    const startDateParsed = moment(props.start).startOf('day');
    const endDateParsed = moment(props.end);
    // if currently is not all day means its going to switch to all day so format has to
    // in date format and vice versa.
    const startDateParsedInUTC = this.processStringForUTC(
      state.allDay
        ? startDateParsed.format('YYYY-MM-DDThh:mm a')
        : startDateParsed.format('YYYY-MM-DD')
    );
    const endDateParsedInUTC = this.processStringForUTC(
      state.allDay ? endDateParsed.format('YYYY-MM-DDThh:mm a') : endDateParsed.format('YYYY-MM-DD')
    );
    this.setState({
      allDay: e.target.checked,
      startParsed: startDateParsedInUTC,
      endParsed: endDateParsedInUTC,
    });
  };
  backToCalendar = () => {
    this.props.parentPropFunction(false);
  };
  handleCalendarSelect = selectedOption => {
    const mySelectedProvider = this.state.auth.filter(
      account => selectedOption.value.providerType === account.providerType
    );
    const mySelectedCalendar = this.state.calendarLists.filter(
      calendar => selectedOption.value.calendarUrl === calendar.url
    );
    if (mySelectedProvider.length === 0 || mySelectedCalendar.length === 0) {
      console.log('Not supposed to happen');
    }
    this.setState(prevState => ({
      ...prevState,
      selectedProvider: mySelectedProvider[0],
      selectedCalendar: mySelectedCalendar[0],
      selectedOption,
    }));
  };
  handleSubmitClick = event => {
    event.preventDefault();
    const { state } = this;
    // Display confirmation to send modal if there are guests
    if (state.attendees.length !== 0) {
      this.renderPopup();
    } else {
      this.handleSubmit();
    }
  };
  renderPopup = () => {
    const { state } = this;
    Actions.openModal({
      component: (
        <div className="popup-modal">
          <h5>You are about to send an invitation for "{state.title}"</h5>
          <p>Do you want to send "{state.title}" now or continue editing the event?</p>
          <div className="modal-button-group">
            <BigButton type="button" variant="small-blue" onClick={() => Actions.closeModal()}>
              Edit
            </BigButton>
            <BigButton type="button" variant="small-white" onClick={this.handleSubmit}>
              Send
            </BigButton>
          </div>
        </div>
      ),
    });
  };
  determineURL = selectedCalendar => {
    if (selectedCalendar.url.includes('caldav.icloud')) {
      return ICLOUD_URL;
    } else {
      return null;
    }
  };
  handleSubmit = async () => {
    // need to write validation method
    const { props, state } = this;

    // Force user to select a calendar to add to
    if (state.selectedProvider !== '') {
      // extract providerType property from state.SelectedProvider as its own variable
      const { providerType } = state.selectedProvider;
      const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // add owner as organizer
      const attendee =
        state.attendees !== [] ? [...state.attendees, state.selectedProvider.username] : [];

      const dataForEventCreator = {
        summary: state.title === '' ? 'Untitled Event' : state.title,
        description: state.desc,
        start: {
          dateTime: moment.tz(state.startParsed, tzid),
          timezone: tzid,
          day: state.start,
        },
        end: {
          dateTime: moment.tz(state.endParsed, tzid),
          timezone: tzid,
        },
        isRecurring: state.isRepeating,
        rrule: state.rrule.slice(6),
        allDay: state.allDay,
        colorId: state.colorId,
        location: state.location,
        attendee: Object.assign(
          {},
          attendee.map(att => {
            return {
              email: att,
              partstat: att === state.selectedProvider.username ? 'APPROVED' : 'NEEDS-ACTION',
            };
          })
        ),
        organizer: state.selectedProvider.username,
        calendarId: state.selectedCalendar.url,
      };
      const authForEventCreator = state.selectedProvider;
      const calendarForEventCreator = state.selectedCalendar;
      this.props.parentPropFunction(false);
      await createEvent({
        data: dataForEventCreator,
        providerType: providerType,
        auth: authForEventCreator,
        calendar: calendarForEventCreator,
      });
      const finalResult = await fetchCaldavEvents(
        state.selectedProvider.username,
        state.selectedProvider.password,
        this.determineURL(state.selectedCalendar)
      );
      Actions.setIcloudCalendarData(finalResult);
    } else {
      console.log('No provider selected! Disabled adding of events!!');
    }
  };

  CustomToolbar = toolbar => {
    const goToBack = () => {
      toolbar.date.setDate(toolbar.date.getDate() - 1);
      toolbar.onNavigate('<');
    };

    const goToNext = () => {
      toolbar.date.setDate(toolbar.date.getDate() + 1);
      toolbar.onNavigate('>');
    };

    const label = () => {
      const date = moment(toolbar.date);
      return (
        <span className={'sidebar-label'}>
          {date.format('MMM')} {date.format('DD')}, {date.format('YYYY')}
        </span>
      );
    };

    return (
      <div className={'rbc-toolbar'}>
        {label()}
        <div className={'rbc-navigate'}>
          <button className={'rbc-navigate-btn'} onClick={goToBack}>
            &#8249;
          </button>
          <button className={'rbc-navigate-btn'} onClick={goToNext}>
            &#8250;
          </button>
        </div>
      </div>
    );
  };

  generateBarColor = (color, isAllDay) => {
    if (isAllDay) {
      return color ? `event-bar-allday--${color}` : 'event-bar-allday--blue';
    } else {
      return color ? `event-bar--${color}` : 'event-bar--blue';
    }
  };

  handleChangeTab = (event, tabLabel) => {
    this.setState({
      activeTab: tabLabel,
    });
  };

  renderTab = activeTab => {
    switch (activeTab) {
      case 'Details':
        return this.renderAddDetails();
      default:
        return <h1>Error</h1>;
    }
  };

  renderAddDetails = () => {
    const { props, state } = this;

    const selectOptions = [];

    state.calendarLists.forEach(calendar => {
      selectOptions.push({
        label: calendar.name,
        value: {
          providerType: calendar.providerType,
          calendarUrl: calendar.url,
        },
      });
    });

    return (
      <div className="add-form-details">
        <div className="add-form-start-time add-form-grid-item">
          {/* Start Time and Date */}
          <Input
            label="Starts"
            type={state.allDay ? 'date' : 'datetime-local'}
            value={new Date(state.startParsed)}
            name="startParsed"
            onChange={date => this.setState({ startParsed: date })}
          />
        </div>
        <div className="add-form-end-time add-form-grid-item">
          {/* End Time and Date */}
          <Input
            label="Ends"
            type={state.allDay ? 'date' : 'datetime-local'}
            value={new Date(state.endParsed)}
            name="endParsed"
            onChange={date => this.setState({ endParsed: date })}
          />
        </div>
        <div className="add-form-repeat add-form-grid-item">
          {/* RRule selection box */}
          <RRuleGenerator
            key="rrulegenerator"
            onChange={this.handleRruleChange}
            name="rrule"
            value={state.rrule}
            config={{
              hideStart: true,
              hideError: true,
              repeat: ['Never', 'Yearly', 'Monthly', 'Weekly', 'Daily'],
              end: ['On date', 'After'],
            }}
          />
        </div>
        {/* All day radio box */}
        <div className="add-form-all-day add-form-grid-item">
          <div className="all-day-checkbox-container">
            <RoundCheckbox
              id="allday-checkmark"
              checked={state.allDay}
              onChange={this.toggleAllDay}
              label="All day"
            />
          </div>
        </div>
        {/* Add guests input box */}
        <div className="add-form-guests add-form-grid-item">
          <Input
            label="Guests"
            value={state.guest}
            type="text"
            placeholder="Invite guests"
            name="guest"
            onKeyDown={this.guestOnKeyDown}
            onChange={this.handleChange}
          />
          {state.attendees.map((attendee, index) => {
            return (
              <RoundCheckbox
                key={index}
                id={`${index}-guest-checkmark`}
                checked={true}
                onChange={() => {
                  const attendees = state.attendees;
                  attendees.splice(index, 1);
                  this.setState({
                    attendees,
                  });
                }}
                label={attendee}
              />
            );
          })}
        </div>
        {/* Add location */}
        <div className="add-form-location add-form-grid-item">
          <Input
            type="text"
            value={state.location}
            placeholder="Add location"
            name="location"
            onChange={this.handleChange}
          />
        </div>
        {/* Select Calendar */}
        <div className="add-form-calendar add-form-grid-item ">
          {console.log('selectedoption', state.selectedOption)}
          <Select
            options={selectOptions}
            value={state.selectedOption || ''}
            name="selectedCalendar"
            styles={selectCustomStyles}
            onChange={this.handleCalendarSelect}
            placeholder="Select calendar"
            isSearchable={false}
          />
        </div>
        {/* Description Text Area */}
        <div className="add-form-description add-form-grid-item">
          <Input
            type="textarea"
            placeholder="Add description"
            value={state.desc}
            name="desc"
            onChange={this.handleChange}
          />
        </div>
      </div>
    );
  };

  render() {
    const { props, state } = this;
    console.log(state);
    return (
      <Fragment>
        <Dialog onClose={this.backToCalendar} open={props.parentPropState} maxWidth="lg">
          <DialogContent>
            <div className="calendar">
              <div className="add-form-main-panel-container">
                <div className="add-form-main-panel">
                  {/* Add form header */}
                  <div className="add-form-header">
                    {/* Event Title Input */}
                    <EventTitle
                      type="text"
                      value={state.value}
                      name="title"
                      placeholder="Untitled event"
                      onChange={this.handleChange}
                    />
                  </div>

                  {/* Main add event page */}
                  {this.renderAddDetails()}
                </div>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            {/* Save/Cancel buttons */}
            <div className="add-form-button-group">
              <BigButton variant="big-white" onClick={this.backToCalendar}>
                Cancel
              </BigButton>
              <BigButton variant="big-blue" onClick={this.handleSubmitClick}>
                Save
              </BigButton>
            </div>
          </DialogActions>
        </Dialog>
      </Fragment>
    );
  }
}
