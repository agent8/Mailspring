/* eslint-disable spellcheck/spell-checker */
import React, { Component, Fragment } from 'react';
import moment from 'moment';
import ICAL from 'ical.js';
import { Actions } from 'mailspring-exports';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';

import Select from 'react-select';
import BigButton from './BigButton';
import RoundCheckbox from './RoundCheckbox';
import Tabs from './Tabs';
import EventTitle from './EventTitle';
import Input from './Input';
import RRuleGenerator from './react-rrule-generator/src/lib';

const START_INDEX_OF_UTC_FORMAT = 17;
const START_INDEX_OF_HOUR = 11;
const END_INDEX_OF_HOUR = 13;
const TIME_OFFSET = 12;
const START_INDEX_OF_DATE = 0;
const END_INDEX_OF_DATE = 11;
const END_INDEX_OF_MINUTE = 16;

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

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
  handleCalendarSelect = name => target => {
    this.setState((state, props) => {
      const selectedProvider = props.calendarsList.find(account =>
        account.calendars.find(cal => cal.uuid === target.value)
      );
      const selectedCalendar = selectedProvider.calendars.find(cal => cal.uuid === target.value);
      return {
        [name]: selectedCalendar,
        selectedCalendarName: selectedCalendar.displayName,
        selectedProvider: selectedProvider ? selectedProvider.provider : '',
        colorId: selectedCalendar.color,
      };
    });
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

  handleSubmit = async () => {
    console.log('SUBMIT TEST');
    this.props.parentPropFunction(false);
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

  renderCalendar = props => {
    const visibleEvents = props.visibleEvents;

    return (
      <DragAndDropCalendar
        defaultDate={new Date(this.state.startParsed)}
        localizer={localizer}
        events={visibleEvents}
        defaultView={'day'}
        views={{
          day: true,
        }}
        popup
        eventPropGetter={event => ({
          className: this.generateBarColor(event.colorId, event.isAllDay),
        })}
        components={{
          toolbar: this.CustomToolbar,
        }}
      />
    );
  };

  renderFindATime = () => {
    const { props } = this;
    const visibleEvents = props.visibleEvents;

    return (
      <DragAndDropCalendar
        localizer={localizer}
        events={visibleEvents}
        defaultView={'week'}
        views={{
          week: true,
        }}
        popup
        eventPropGetter={event => ({
          className: this.generateBarColor(event.colorId, event.isAllDay),
        })}
      />
    );
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
      case 'Find a Time':
        return this.renderFindATime();
      default:
        return <h1>Error</h1>;
    }
  };

  renderAddDetails = () => {
    const { props, state } = this;

    const selectOptions = [];
    // props.calendarsList.forEach(account => {
    //   const options = [];
    //   account.calendars.forEach(calendar => {
    //     options.push({ value: calendar.uuid, label: calendar.displayName });
    //   });
    //   selectOptions.push({ label: account.email, options: options });
    // });

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
          <Select
            options={selectOptions}
            name="selectedCalendar"
            styles={selectCustomStyles}
            onChange={console.log('select changed')}
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

                  {/* Details or Find a Time tab toggle */}
                  {/* <Tabs
                    handleChangeTab={this.handleChangeTab}
                    activeTab={state.activeTab}
                    tabList={["Details", "Find a Time"]}
                  /> */}

                  {/* Main add event page */}
                  {this.renderAddDetails()}

                  {/* Find a Time tab */}
                  {/* <div className="add-form-find-a-time" /> */}
                </div>
              </div>
              {/* <div className="sidebar">{this.renderCalendar(props)}</div> */}
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
