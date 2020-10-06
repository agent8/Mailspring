/* eslint-disable no-underscore-dangle */
import React, { Component } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import ICAL from 'ical.js';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom';
// import Modal from 'react-modal';
import { Modal } from 'mailspring-component-kit'
import Select from 'react-select'

import RRuleGenerator from '../react-rrule-generator/src/lib';
import BigButton from '../library/BigButton';
import EventTitle from '../library/EventTitle';
import Input from '../library/Input';
import DropDown from '../library/DropDown/DropDown';
import DropDownGroup from '../library/DropDown/DropDownGroup';
import DropDownItem from '../library/DropDown/DropDownItem';
import RoundCheckbox from '../library/RoundCheckbox';
import Tabs from '../library/Tabs/Tabs';
import Tab from '../library/Tabs/Tab';
import DatePicker from 'react-datepicker';


const START_INDEX_OF_UTC_FORMAT = 17;
const START_INDEX_OF_HOUR = 11;
const END_INDEX_OF_HOUR = 13;
const TIME_OFFSET = 12;
const START_INDEX_OF_DATE = 0;
const END_INDEX_OF_DATE = 11;
const END_INDEX_OF_MINUTE = 16;

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);
const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    width: '32%',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)'
  }
};
const selectCustomStyles = {
  control: (provided) => ({
    ...provided,
    backgroundColor: '#fff',
    border: '2px solid darkgrey',
    borderRadius: '15px',
    padding: '10px 15px',
    width: '100%',
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: '#f9fafa'
  }),
  option: (provided, state) => ({
    ...provided,
    padding: '1px 12px',
    fontSize: '14px',
    color: 'grey',
    fontWeight: 'bold',
    ...(state.isSelected && { color: 'white' }),
  }),
  groupHeading: (provided) => ({
    ...provided,
    color: 'black'
  })
}

export default class AddEvent extends Component {
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
      // rrule: 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYSETPOS=1;BYDAY=MO',
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

  componentWillMount() {
    const { props } = this;
    const { state } = this;

    const startDateParsed = moment(props.match.params.start);
    const endDateParsed = moment(props.match.params.end);

    const rruleDaily = ICAL.Recur.fromData({ freq: 'DAILY' });
    const rruleWeekly = ICAL.Recur.fromData({
      freq: 'WEEKLY',
      byday: [startDateParsed.format('dd').toUpperCase()],
      count: 5,
      interval: 1
    });
    const rruleMonthlyByMonthDay = ICAL.Recur.fromData({
      freq: 'MONTHLY',
      bymonthday: [startDateParsed.date()],
      count: 5,
      interval: 1
    });
    const rruleMonthlyByWeekNoAndDay = ICAL.Recur.fromData({
      freq: 'MONTHLY',
      byday: [startDateParsed.format('dd').toUpperCase()],
      bysetpos: [this.weekOfMonth(startDateParsed)],
      count: 5,
      interval: 1
    });
    const startDateParsedInUTC = this.processStringForUTC(
      startDateParsed.format('YYYY-MM-DDThh:mm a')
    );
    const endDateParsedInUTC = this.processStringForUTC(endDateParsed.format('YYYY-MM-DDThh:mm a'));
    this.setState({
      startParsed: startDateParsedInUTC,
      endParsed: endDateParsedInUTC,
      start: props.match.params.start,
      end: props.match.params.end,
      dailyRule: `RRULE:${rruleDaily.toString()}`,
      weeklyRule: `RRULE:${rruleWeekly.toString()}`,
      monthlyRule: `RRULE:${rruleMonthlyByWeekNoAndDay.toString()}`,
      // rrule: `RRULE:${rruleMonthlyByWeekNoAndDay.toString()}`
    });
  }

  processStringForUTC = (dateInString) => {
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

  weekOfMonth = (input) => {
    const firstDayOfMonth = input.clone().startOf('month');
    const firstDayOfWeek = firstDayOfMonth.clone().startOf('week');

    const offset = firstDayOfMonth.diff(firstDayOfWeek, 'days');

    return Math.ceil((input.date() + offset) / 7);
  };

  handleChange = (event) => {
    this.setState({ [event.target.name]: event.target.value });
  };

  guestOnKeyDown = (event) => {
    if (event.keyCode == 13 && event.target.value !== '') {
      const attendees = this.state.attendees;
      attendees.push(event.target.value)
      this.setState({
        guest: '',
        attendees
      });
    }
  }

  handleRruleChange = (rrule) => {
    if (rrule === 'never') {
      this.setState({
        isRepeating: false
      })
      return;
    }
    const { state } = this;
    this.setState({
      rrule,
      isRepeating: true
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
      SA: 6
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
      // const newYear =
      //   moment(state.start).month() > rruleObj.BYMONTH
      //     ? moment(state.start).year() + 1
      //     : moment(state.start).year();
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
      endParsed: this.processStringForUTC(newEndDateParsed.format('YYYY-MM-DDThh:mm'))
    });
  };

  toggleRecurr = (e) => {
    this.setState({ isRepeating: e.target.checked });
  };

  toggleAllDay = (e) => {
    const { props } = this;
    const { state } = this;

    const startDateParsed = moment(props.match.params.start).startOf('day');
    const endDateParsed = moment(props.match.params.end)
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
      endParsed: endDateParsedInUTC
    });
  };

  backToCalendar = (e) => {
    const { props } = this;
    props.history.push('/');
  };

  handleCalendarSelect = name => (target) => {
    this.setState((state, props) => {

      const selectedProvider = props.calendarsList.filter((account) =>
        account.calendars.filter((cal) => cal.uuid === target.value)
      );
      const selectedCalendar = selectedProvider[0].calendars.find(
        (cal) => cal.uuid === target.value
      );
      return {
        [name]: selectedCalendar,
        selectedCalendarName: selectedCalendar.displayName,
        selectedProvider: selectedProvider[0] ? selectedProvider[0].provider : '',
        colorId: selectedCalendar.color
      };
    });
  };

  handleSubmitClick = (event) => {
    event.preventDefault();
    const { props, state } = this;
    // Display confirmation to send modal if there are guests
    if (state.attendees.length !== 0) {
      this.setState({
        isShowConfirmForm: true
      })
    } else {
      this.handleSubmit();
    }
  }

  renderPopup = (state) => {
    return state.isShowConfirmForm ?
      (<Modal isOpen={state.isShowConfirmForm} style={customStyles} onRequestClose={() => this.setState({ isShowConfirmForm: false })}>
        <p>You are about to send an invitation for "{state.title}"</p>
        <p>Do you want to send "{state.title}" now or continue editing the event?</p>
        <button type="button" onClick={() => this.setState({ isShowConfirmForm: false })}>
          Edit
      </button>
        <button type="button" onClick={this.handleSubmit}>
          Send
      </button>
      </Modal>) : null;
  }

  handleSubmit = async () => {
    // need to write validation method
    const { props, state } = this;

    // Force user to select a calendar to add to
    if (state.selectedProvider !== '') {
      // Abstract providerType property from state.SelectedProvider as its own variable
      const { providerType } = JSON.parse(state.selectedProvider);
      const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // add owner as organizer
      const attendee = state.attendees !== [] ? [...state.attendees, JSON.parse(state.selectedProvider).email] : []
      props.postEventBegin(
        {
          summary: state.title === '' ? 'Untitled Event' : state.title,
          description: state.desc,
          start: {
            dateTime: moment.tz(state.startParsed, tzid),
            timezone: tzid,
            day: state.start
          },
          end: {
            dateTime: moment.tz(state.endParsed, tzid),
            timezone: tzid
          },
          isRecurring: state.isRepeating,
          rrule: state.rrule.slice(6),
          allDay: state.allDay,
          colorId: state.colorId,
          location: state.location,
          attendee: Object.assign({}, attendee.map(att => {
            return {
              email: att,
              partstat: att === JSON.parse(state.selectedProvider).email ? 'APPROVED' : 'NEEDS-ACTION'
            }
          })),
          organizer: JSON.parse(state.selectedProvider).email,
          calendarId: state.selectedCalendar.calendarUrl
        },
        JSON.parse(state.selectedProvider),
        providerType,
        state.selectedCalendar
      );
      props.history.push('/');
    } else {
      console.log('No provider selected! Disabled adding of events!!');
    }
  };

  CustomToolbar = (toolbar) => {
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
        <span className={'sidebar-label'}>{date.format('MMM')} {date.format('DD')}, {date.format('YYYY')}</span>
      );
    };

    return (
      <div className={'rbc-toolbar'}>
        {label()}
        <div className={'rbc-navigate'}>
          <button className={'rbc-navigate-btn'} onClick={goToBack}>&#8249;</button>
          <button className={'rbc-navigate-btn'} onClick={goToNext}>&#8250;</button>
        </div>
      </div >
    );
  };

  generateBarColor = (color, isAllDay) => {
    if (isAllDay) {
      return color ? `event-bar-allday--${color}` : 'event-bar-allday--blue'
    } else {
      return color ? `event-bar--${color}` : 'event-bar--blue'
    }
  }

  renderCalendar = (props) => {
    const visibleEvents = props.visibleEvents;

    return (
      <DragAndDropCalendar
        defaultDate={new Date(this.state.startParsed)}
        localizer={localizer}
        events={visibleEvents}
        defaultView={'day'}
        views={{
          day: true
        }}
        popup
        eventPropGetter={event => ({ className: this.generateBarColor(event.colorId, event.isAllDay) })}
        components={{
          toolbar: this.CustomToolbar
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
          week: true
        }}
        popup
        eventPropGetter={event => ({ className: this.generateBarColor(event.colorId, event.isAllDay) })}
      />
    );
  }

  handleChangeTab = (event, tabLabel) => {
    this.setState({
      activeTab: tabLabel
    });
  }

  renderTab = (activeTab) => {
    switch (activeTab) {
      case "Details":
        return this.renderAddDetails();
        break;
      case "Find a Time":
        return this.renderFindATime();
        break;
      default:
        return (<h1>Error</h1>)
        break;
    }
  }

  renderAddDetails = () => {
    const { props, state } = this;

    const selectOptions = [];
    props.calendarsList.forEach(account => {
      const options = [];
      account.calendars.forEach(calendar => {
        options.push({ value: calendar.uuid, label: calendar.displayName })
      })
      selectOptions.push({ label: account.email, options: options })
    });

    return (<div className="add-form-details">
      <div className="add-form-start-time add-form-grid-item">
        {/* Start Time and Date */}
        <Input
          label="Starts"
          type={state.allDay ? 'date' : "datetime-local"}
          value={new Date(state.startParsed)}
          name="startParsed"
          onChange={date => this.setState({ startParsed: date })}
        />

      </div>
      <div className="add-form-end-time add-form-grid-item">
        {/* End Time and Date */}
        <Input
          label="Ends"
          type={state.allDay ? 'date' : "datetime-local"}
          value={new Date(state.endParsed)}
          name="endParsed"
          onChange={date => this.setState({ endParsed: date })}
        />
      </div>
      <div className="add-form-repeat add-form-grid-item">
        <RRuleGenerator
          key="rrulegenerator"
          onChange={this.handleRruleChange}
          name="rrule"
          value={state.rrule}
          config={{
            hideStart: true,
            hideError: true,
            repeat: ["Never", "Yearly", "Monthly", "Weekly", "Daily"],
            end: ['On date', 'After'],
          }}
        />
      </div>
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
              id={`${index}-guest-checkmark`}
              checked={true}
              onChange={() => {
                const attendees = state.attendees;
                attendees.splice(index, 1);
                this.setState({
                  attendees
                });
              }
              }
              label={attendee}
            />);
        })}
      </div>
      <div className="add-form-location add-form-grid-item">
        <Input
          type="text"
          value={state.location}
          placeholder="Add location"
          name="location"
          onChange={this.handleChange}
        />
      </div>
      <div className="add-form-calendar add-form-grid-item ">
        {/* Select Calendar */}

        <Select
          options={selectOptions}
          name="selectedCalendar"
          styles={selectCustomStyles}
          onChange={this.handleCalendarSelect("selectedCalendar")}
          placeholder="Select calendar"
          isSearchable={false} />
        {/* <DropDown
        value={state.selectedCalendar.uuid}
        type="select"
        onChange={this.handleCalendarSelect}
        name="selectedCalendar"
        placeholder="Select calendar"
        hiddenPlaceholder
      >
        {props.calendarsList.map((account) => (
          <DropDownGroup
            key={account.uuid}
            label={`${account.email} (${
              account.caldavType ? account.caldavType : account.type
            })`}
          >
            {account.calendars.map((calendar) => (
              <DropDownItem key={calendar.ctag} value={calendar.uuid}>
                {calendar.displayName}
              </DropDownItem>
            ))}
          </DropDownGroup>
        ))}
      </DropDown> */}
      </div>
      <div className="add-form-description add-form-grid-item">
        {/* Text Area */}
        <Input
          type="textarea"
          placeholder="Add description"
          value={state.desc}
          name="desc"
          onChange={this.handleChange}
        />
      </div>
    </div>);
  }

  render() {
    const providers = [];
    const { props, state } = this;
    for (const providerIndivAccount of Object.keys(props.providers)) {
      props.providers[providerIndivAccount].map((data) => providers.push(data));
    }

    return (
      <div className="calendar">
        {this.renderPopup(state)}
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
              {/* Save/Cancel buttons */}
              <div className="add-form-button-group">
                <BigButton variant="big-white" onClick={this.backToCalendar}>
                  Cancel
                </BigButton>
                <BigButton variant="big-blue" onClick={this.handleSubmitClick}>
                  Save
                </BigButton>
              </div>
            </div>
            {/* Details / Find a Time tab toggle */}
            <Tabs
              handleChangeTab={this.handleChangeTab}
              activeTab={state.activeTab}
              tabList={["Details", "Find a Time"]}
            />
            {this.renderTab(state.activeTab)}


            <div className="add-form-find-a-time" />
          </div>
        </div>
        <div className="sidebar">
          {this.renderCalendar(props)}
        </div>
      </div>
    );
  }
}
