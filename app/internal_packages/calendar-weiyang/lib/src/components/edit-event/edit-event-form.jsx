import React, { Fragment } from 'react';
import moment from 'moment-timezone';
import Select from 'react-select';
import EventTitle from '../MiniComponents/event-title';
import BigButton from '../MiniComponents/big-button';
import Input from '../MiniComponents/input';
import RoundCheckbox from '../MiniComponents/round-checkbox';
import ICAL from 'ical.js';
import RRuleGenerator from '../react-rrule-generator/src/lib';
import * as recurrenceOptions from '../common-utils/recurrence-options';
import { Actions, CalendarPluginStore } from 'mailspring-exports';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';
import {
  editAllReccurenceEvent,
  editFutureReccurenceEvent,
  editSingleEvent,
} from '../edit-event/utils/edit-event-utils';
import { fetchCaldavEvents } from '../fetch-event/utils/fetch-events-utils';
import { ICLOUD_ACCOUNT } from '../constants';

const START_INDEX_OF_UTC_FORMAT = 17;
const START_INDEX_OF_HOUR = 11;
const END_INDEX_OF_HOUR = 13;
const TIME_OFFSET = 12;
const START_INDEX_OF_DATE = 0;
const END_INDEX_OF_DATE = 11;
const END_INDEX_OF_MINUTE = 16;

const selectStyles = {
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
};

export default class EditForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      location: '',
      id: '',
      title: '',
      description: '',
      start: {},
      end: {},
      colorId: '',
      visibility: '',
      calendarId: '',
      // Guest related
      guest: '',
      organizer: '',
      attendees: [],
      partstat: '',

      isAllDay: false,
      conference: '',
      hangoutLink: '',
      startDay: '',
      endDay: '',
      originalId: '',
      oldEventJson: {},
      oldRpJson: {},
      showRruleGenerator: false,
      visibleStart: new Date(),
      visibleEnd: new Date(),

      updatedIsRecurring: false,
      updatedRrule: '',
      updatedStartDateTime: new Date(),
      updatedEndDateTime: new Date(),
      updateAttendees: [],
      updatedLocation: '',
      updatedConference: '',

      initialRrule: '',
      isRecurring: false,
      isMaster: false,
      recurringEventId: '',
      thirdOptionAfter: 5,
      recurrInterval: 1, // for repeated interval
      firstSelectedOption: 1, // for selecting day, week, monthly, year, default = week
      selectedSecondRecurrOption: recurrenceOptions.selectedSecondRecurrOption, // for storing what has been selected, only indexes 1,2 are used as 1 = week, 2 = month.
      secondRecurrOptions: recurrenceOptions.weekRecurrOptions,
      thirdRecurrOptions: 'n',
      recurringMasterId: '',
      recurrStartDate: '',
      recurrEndDate: '',
      recurrPatternId: '',

      recurrByMonth: '',
      recurrByMonthDay: '',
      recurrByWeekDay: '',
      recurrByWeekNo: '',
      activeTab: 'Details',

      // Update form
      isShowUpdateForm: false,

      confirmationPopup: false,
    };
  }
  setConfirmationPopup = boolValue => {
    this.setState(prevState => ({
      ...prevState,
      confirmationPopup: boolValue,
    }));
  };
  componentDidMount() {
    const { props, state } = this;
    this.retrieveEvent(props.id);
  }

  processStringForUTC = dateInString => {
    let dateInStringInUTC;
    if (dateInString.substring(START_INDEX_OF_UTC_FORMAT) === 'pm') {
      const hourInString = parseInt(
        dateInString.substring(START_INDEX_OF_HOUR, END_INDEX_OF_HOUR),
        10
      );
      const hourInStringInUTC = hourInString + TIME_OFFSET;
      console.log(hourInStringInUTC.toString());
      dateInStringInUTC =
        dateInString.substring(START_INDEX_OF_DATE, END_INDEX_OF_DATE) +
        hourInStringInUTC.toString() +
        dateInString.substring(END_INDEX_OF_HOUR, END_INDEX_OF_MINUTE);
    } else {
      dateInStringInUTC = dateInString.substring(START_INDEX_OF_DATE, END_INDEX_OF_MINUTE);
    }
    return dateInStringInUTC;
  };

  handleChange = event => {
    if (event.target !== undefined) {
      this.setState({
        [event.target.name]: event.target.value,
      });
    } else {
      this.setState({
        [event.name]: event.value,
      });
    }
  };

  guestOnKeyDown = event => {
    if (event.keyCode == 13 && event.target.value !== '') {
      let attendees = this.state.attendees;
      attendees[Object.keys(attendees).length] = {
        email: event.target.value,
        partstat: 'NEEDS-ACTION',
      };
      this.setState({
        guest: '',
        attendees,
      });
    }
  };

  handleInputChange = event => {
    const { target } = event;
    const { value } = target;
    const { name } = target;
    this.setState({
      [name]: value,
    });
  };

  handleCheckboxChange = event => {
    const { state } = this;

    const startDateParsed = moment(state.start.dateTime * 1000).startOf('day');
    const endDateParsed = moment(state.end.dateTime * 1000);
    // if currently is not all day means its going to switch to all day so format has to
    // in date format and vice versa.
    const startDateParsedInUTC = this.processStringForUTC(
      state.isAllDay
        ? startDateParsed.format('YYYY-MM-DDThh:mm a')
        : startDateParsed.format('YYYY-MM-DD')
    );
    const endDateParsedInUTC = this.processStringForUTC(
      state.isAllDay ? endDateParsed.format('YYYY-MM-DDThh:mm a') : endDateParsed.format('YYYY-MM-DD')
    );

    this.setState({
      isAllDay: event.target.checked,
      updatedStartDateTime: startDateParsedInUTC,
      updatedEndDateTime: endDateParsedInUTC,
    });
  };

  handleEditEvent = () => {
    const { state } = this;
    const attendees = state.attendees;
    Object.keys(attendees).map(key => {
      if (attendees[key].email === state.owner) {
        attendees[key].partstat = state.partstat !== '' ? state.partstat : 'NEEDS-ACTION';
        this.setState({ attendees });
      }
    });
    if (state.initialRrule && (state.initialRrule !== state.updatedRrule || state.isRecurring)) {
      this.setConfirmationPopup(true);
    } else {
      this.editEvent();
    }
  };
  updateStoreFromServer = async () => {
    const { state } = this;
    // only ical caldav currently
    const [user] = CalendarPluginStore.getAuth(ICLOUD_ACCOUNT).filter(
      auth => auth.username === state.owner
    );
    const finalResult = await fetchCaldavEvents(user.username, user.password, state.providerType);
    Actions.setCalendarData(finalResult, ICLOUD_ACCOUNT);
  };
  editEvent = () => {
    const { props, state } = this;
    // using ical caldav only for now
    const [user] = CalendarPluginStore.getAuth(ICLOUD_ACCOUNT).filter(auth => auth.username === state.owner);
    const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = {
      id: state.id,
      calendarId: state.calendarId,
      title: state.title,
      description: state.description,
      location: state.location,
      organizer: state.organizer,
      attendee: state.attendees,
      originalId: state.originalId,
      iCalUID: state.iCalUID,
      isAllDay: state.isAllDay,
      start: moment.tz(state.updatedStartDateTime, tzid),
      end: moment.tz(state.updatedEndDateTime, tzid),
      isRecurring: state.isRecurring,
      updatedIsRecurring: state.updatedIsRecurring,
      updatedRrule: state.updatedRrule,
      user,
      props,
      providerType: state.providerType,
      oldEventJson: state.oldEventJson,
      oldRpJson: state.oldRpJson,
    };
    // debugger;
    editSingleEvent(payload);
    // this.updateStoreFromServer();
    this.backToCalendar();
  };

  editAllRecurrenceEvent = () => {
    const { props, state } = this;
    // using ical caldav only for now
    const [user] = CalendarPluginStore.getAuth(ICLOUD_ACCOUNT).filter(
      auth => auth.username === state.owner
    );
    const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const payload = {
      // Unique Id
      id: state.id,
      calendarId: state.calendarId,
      // Updating fields
      title: state.title,
      description: state.description,
      colorId: state.colorId,
      location: state.location,
      organizer: state.organizer,
      attendee: state.attendees,
      originalId: state.originalId,
      iCalUID: state.iCalUID,
      isAllDay: state.isAllDay,
      start: moment.tz(state.updatedStartDateTime, tzid),
      end: moment.tz(state.updatedEndDateTime, tzid),
      providerType: state.providerType,
      tzid,

      // Recurrence pattern details
      recurringEventId: state.recurringEventId,
      firstOption: state.firstSelectedOption,
      secondOption: state.selectedSecondRecurrOption,
      recurrInterval: state.recurrInterval,
      recurrPatternId: state.recurrPatternId,
      untilType: state.thirdRecurrOptions,
      untilDate: state.recurrEndDate,
      untilAfter: state.thirdOptionAfter,
      byMonth: state.recurrByMonth,
      byMonthDay: state.recurrByMonthDay,
      byWeekDay: state.recurrByWeekDay,
      byWeekNo: state.recurrByWeekNo,
      isRecurring: state.isRecurring,
      updatedRrule: state.updatedRrule,

      // Updated fields
      updatedIsRecurring: state.updatedIsRecurring,

      // User and moving information
      user,
      props,

      // Past event incase of error
      oldEventJson: state.oldEventJson,
      oldRpJson: state.oldRpJson,
    };
    // debugger;
    editAllReccurenceEvent(payload);
    // this.updateStoreFromServer();
    this.backToCalendar();
  };
  editFutureRecurrenceEvent = () => {
    const { props, state } = this;
    const [user] = CalendarPluginStore.getAuth(ICLOUD_ACCOUNT).filter(
      auth => auth.username === state.owner
    );
    const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = {
      // Unique Id
      id: state.id,

      // Updating fields
      title: state.title,
      description: state.description,
      location: state.location,
      organizer: state.organizer,
      attendee: state.attendees,
      originalId: state.originalId,
      iCalUID: state.iCalUID,
      isAllDay: state.isAllDay,
      start: moment.tz(state.updatedStartDateTime, tzid),
      end: moment.tz(state.updatedEndDateTime, tzid),
      providerType: state.providerType,
      tzid,

      // Recurrence pattern details
      recurringEventId: state.recurringEventId,
      firstOption: state.firstSelectedOption,
      secondOption: state.selectedSecondRecurrOption,
      recurrInterval: state.recurrInterval,
      recurrPatternId: state.recurrPatternId,
      untilType: state.thirdRecurrOptions,
      untilDate: state.recurrEndDate,
      untilAfter: state.thirdOptionAfter,
      byMonth: state.recurrByMonth,
      byMonthDay: state.recurrByMonthDay,
      byWeekDay: state.recurrByWeekDay,
      byWeekNo: state.recurrByWeekNo,
      isRecurring: state.isRecurring,
      rrule: state.updatedRrule,

      // User and moving information
      user,
      props,

      // Past event incase of error
      oldEventJson: state.oldEventJson,
      oldRpJson: state.oldRpJson,
    };
    // debugger;
    editFutureReccurenceEvent(payload);
    // this.updateStoreFromServer();
    this.backToCalendar();
  };

  backToCalendar = () => {
    const { props } = this;
    props.parentPropFunction(false);
  };

  /*
    In order to edit a generic event, we have to choose for each individual event.

    Google - Retrive ID from our local DB and post with the ID, Google handles everything else
    Outlook - Same as google
    Exchange - This one requires more thought.
      Exchange updates the data different. Not a post request. A function call in the ews-javascript-api call.
      Have to think how to call the function when I might not have the object. This means that perhaps I should store the object in the main object.
      In order to retrive the event, I need to make a query from the script to get the javascript ews object. However, once I have it, I can update it easily.
  */
  retrieveEvent = id => {
    const [eventPresent] = CalendarPluginStore.getCalendarData(ICLOUD_ACCOUNT).filter(
      storedEvent => storedEvent.id === id
    );

    // Remember to moment.unix because dateTime is stored in seconds instead of miliseconds
    const text = recurrenceOptions.parseString(
      Math.ceil(moment.unix(eventPresent.start.dateTime).date() / 7)
    );
    const secondRecurrOptions = recurrenceOptions.secondRecurrOptions(eventPresent.start, text);

    if (eventPresent.isRecurring) {
      const [eventRecurrence] = CalendarPluginStore.getRpLists(ICLOUD_ACCOUNT).filter(
        storedRp => storedRp.originalId === eventPresent.recurringEventId
      );
      const thirdRecurrChoice = recurrenceOptions.parseThirdRecurrOption(
        eventRecurrence.until,
        eventRecurrence.numberOfRepeats
      );

      const firstSelected = recurrenceOptions.parseFreq(eventRecurrence.freq);
      const secondSelected = recurrenceOptions.parseFreqNumber(firstSelected);

      let monthlySelected = 0;
      let yearlySelected = 0;
      if (secondSelected === 'month') {
        if (eventRecurrence.byMonthDay === '()') {
          monthlySelected = 1;
        } else {
          monthlySelected = 0;
        }
      } else if (secondSelected === 'year') {
        if (eventRecurrence.byMonthDay === '()') {
          yearlySelected = 1;
        } else {
          yearlySelected = 0;
        }
      }

      if (firstSelected === 1) {
        this.setState({
          selectedSecondRecurrOption: [
            0,
            eventRecurrence.weeklyPattern
              .split(',')
              .filter(e => e !== '')
              .map(e => parseInt(e, 10)),
            0,
            0,
          ],
        });
      } else if (firstSelected === 2) {
        this.setState({
          selectedSecondRecurrOption: [
            0,
            eventRecurrence.weeklyPattern
              .split(',')
              .filter(e => e !== '')
              .map(e => parseInt(e, 10)),
            monthlySelected,
            0,
          ],
        });
      } else if (firstSelected === 3) {
        this.setState({
          selectedSecondRecurrOption: [
            0,
            eventRecurrence.weeklyPattern
              .split(',')
              .filter(e => e !== '')
              .map(e => parseInt(e, 10)),
            0,
            yearlySelected,
          ],
        });
      }

      // to ensure RRuleGenerator display no error caused by undefined INTERVAL
      const intervalInRrule = eventRecurrence.iCALString.match(/INTERVAL=.+?;/g);
      let updatedRruleWithInterval = eventRecurrence.iCALString;
      if (intervalInRrule === null) {
        updatedRruleWithInterval += ';INTERVAL=' + eventRecurrence.interval;
      }
      this.setState({
        updatedIsRecurring: true,
        updatedRrule: updatedRruleWithInterval,
        isRecurring: true,
        showRruleGenerator: true,
        initialRrule: updatedRruleWithInterval,
        isMaster: eventPresent.isMaster,
        recurringEventId: eventPresent.recurringEventId,
        recurrInterval: eventRecurrence.interval,
        firstSelectedOption: firstSelected,
        secondRecurrOptions: secondRecurrOptions[secondSelected],
        thirdRecurrOptions: thirdRecurrChoice,
        recurrStartDate: moment(eventRecurrence.recurringTypeId).format('YYYY-MM-DDTHH:mm:ssZ'),
        recurrEndDate:
          eventRecurrence.until !== null
            ? moment(eventRecurrence.until).format('YYYY-MM-DDTHH:mm:ssZ')
            : null,
        recurringMasterId: eventRecurrence.originalId,
        recurrPatternId: eventRecurrence.id,
        thirdOptionAfter: eventRecurrence.numberOfRepeats,

        recurrByMonth: eventRecurrence.byMonth,
        recurrByMonthDay:
          eventRecurrence.byMonthDay !== '()'
            ? eventRecurrence.byMonthDay
            : `(${moment(eventPresent.start).date()})`,
        recurrByWeekDay: eventRecurrence.byWeekDay,
        recurrByWeekNo: eventRecurrence.byWeekNo,
        oldRpJson: eventRecurrence,
      });
    }

    const startDateParsedInUTC = this.processStringForUTC(
      eventPresent.isAllDay
        ? moment(eventPresent.start.dateTime * 1000).format('YYYY-MM-DD')
        : moment(eventPresent.start.dateTime * 1000).format('YYYY-MM-DDThh:mm')
    );
    const endDateParsedInUTC = this.processStringForUTC(
      eventPresent.isAllDay
        ? moment(eventPresent.end.dateTime * 1000).format('YYYY-MM-DD')
        : moment(eventPresent.end.dateTime * 1000).format('YYYY-MM-DDThh:mm')
    );

    // right now caldav server generated events do not have guests by default
    let attendees = {};
    let partstat = '';
    if (eventPresent.attendee !== '' && eventPresent.attendee !== undefined) {
      attendees = JSON.parse(eventPresent.attendee);
      const ownerIndex = Object.keys(attendees).filter(
        key => attendees[key].email === eventPresent.owner
      );
      partstat =
        attendees[ownerIndex] && attendees[ownerIndex].partstat !== 'NEEDS-ACTION'
          ? attendees[ownerIndex].partstat
          : '';
    }

    this.setState({
      updatedStartDateTime: startDateParsedInUTC,
      updatedEndDateTime: endDateParsedInUTC,
      updateAttendees: eventPresent.attendees,
      updatedLocation: '',
      updatedConference: '',

      visibleStart: eventPresent.start.dateTime * 1000,
      visibleEnd: eventPresent.end.dateTime * 1000,

      id: eventPresent.id,
      calendarId: eventPresent.calendarId,
      title: eventPresent.summary,
      description: eventPresent.description,
      colorId: eventPresent.colorId,
      start: eventPresent.start,
      end: eventPresent.end,
      location: eventPresent.location,
      organizer: eventPresent.organizer,
      attendees: attendees,
      partstat: partstat,
      hangoutLink: eventPresent.hangoutLink,
      providerType: eventPresent.providerType,
      owner: eventPresent.owner,
      originalId: eventPresent.originalId,
      iCalUID: eventPresent.iCalUID,
      oldEventJson: eventPresent,
      isAllDay: eventPresent.isAllDay,
    });
  };

  handleIntervalChange = event => {
    this.setState({
      recurrInterval: event.target.value,
    });
  };

  handlePartstatChange = event => {
    console.log(event.value);
    this.setState({ partstat: event.value });
  };

  handleRruleChange = selectedRrule => {
    if (selectedRrule === '') {
      this.setState({
        updatedIsRecurring: false,
      });
      return;
    }
    this.setState({
      updatedRrule: selectedRrule.slice(6),
      updatedIsRecurring: true,
    });
  };

  renderPopup = () => {
    const { state } = this;
    if (state.initialRrule !== state.updatedRrule) {
      return (
        <Dialog
          onClose={() => this.setConfirmationPopup(false)}
          open={state.confirmationPopup}
          maxWidth="md"
        >
          <DialogContent>
            <div className="popup-modal">
              <h5>You're changing a repeating event's rule.</h5>
              <p>Do you want to change all occurrences?</p>
            </div>
          </DialogContent>
          <DialogActions>
            <BigButton variant="small-blue" onClick={() => this.setConfirmationPopup(false)}>
              Cancel
            </BigButton>
            <BigButton variant="small-white" onClick={this.editAllRecurrenceEvent}>
              Update All
            </BigButton>
          </DialogActions>
        </Dialog>
      );
    } else {
      return (
        <Dialog
          onClose={() => this.setConfirmationPopup(false)}
          open={state.confirmationPopup}
          maxWidth="md"
        >
          <DialogContent>
            <div className="popup-modal">
              <h5>You're changing a repeating event.</h5>
              <p>Do you want to change only this occurrence of the event, or all occurrences?</p>
            </div>
          </DialogContent>
          <DialogActions>
            <BigButton variant="small-blue" onClick={() => this.setConfirmationPopup(false)}>
              Cancel
            </BigButton>
            {state.isMaster ? (
              <BigButton variant="small-white" onClick={this.editAllRecurrenceEvent}>
                Update All
              </BigButton>
            ) : (
              <BigButton
                variant="small-white"
                type="button"
                onClick={this.editFutureRecurrenceEvent}
              >
                Update All Future Events
              </BigButton>
            )}
            <BigButton variant="small-white" onClick={this.editEvent}>
              Update Only This Event
            </BigButton>
          </DialogActions>
        </Dialog>
      );
    }
  };

  renderAddDetails = () => {
    const { props, state } = this;

    const repeatingUI = [];
    if (state.showRruleGenerator) {
      repeatingUI.push();
    }
    const options = [
      { value: 'ACCEPTED', label: 'Yes' },
      { value: 'DECLINED', label: 'No' },
      { value: 'TENTATIVE', label: 'Maybe' },
    ];

    return (
      <div className="add-form-details">
        <div className="add-form-start-time add-form-grid-item">
          {/* Start Time and Date */}
          <Input
            label="Starts"
            type={state.isAllDay ? 'date' : 'datetime-local'}
            value={new Date(state.updatedStartDateTime)}
            name="updatedStartDateTime"
            onChange={date => this.setState({ updatedStartDateTime: date })}
          />
        </div>
        <div className="add-form-end-time add-form-grid-item">
          {/* End Time and Date */}
          <Input
            label="Ends"
            type={state.isAllDay ? 'date' : 'datetime-local'}
            value={new Date(state.updatedEndDateTime)}
            name="updatedEndDateTime"
            onChange={date => this.setState({ updatedEndDateTime: date })}
          />
        </div>
        <div className="add-form-repeat add-form-grid-item">
          {console.log('updatedRrule', state.updatedRrule)}
          <RRuleGenerator
            key="rrulegenerator"
            onChange={this.handleRruleChange}
            name="rrule"
            value={state.updatedRrule}
            config={{
              hideStart: true,
              hideError: true,
              repeat: ['Never', 'Yearly', 'Monthly', 'Weekly', 'Daily'],
              end: ['On date', 'After'],
            }}
          />
        </div>
        <div className="add-form-all-day add-form-grid-item">
          <div className="all-day-checkbox-container">
            <RoundCheckbox
              id="allday-checkmark"
              checked={state.isAllDay || false}
              onChange={this.handleCheckboxChange}
              label="All day"
            />
          </div>
        </div>
        <div className="add-form-recurrence-generator add-form-grid-item">
          <div className="app" data-tid="container">
            {repeatingUI}
          </div>
        </div>
        <div className="add-form-guests add-form-grid-item">
          {/* if it is a event with guests */}
          {Object.keys(state.attendees).length > 1 ? (
            <Select
              name="partstat"
              options={options}
              styles={selectStyles}
              value={options.find(option => option.value === state.partstat)}
              onChange={this.handlePartstatChange}
              placeholder="Going?"
              hiddenPlaceholder
            />
          ) : null}
          {/* Only allow edit if owner is the organizer */}
          {state.organizer === '' || state.organizer === state.owner ? (
            <Input
              label="Guests"
              value={state.guest}
              type="text"
              placeholder="Invite guests"
              name="guest"
              onKeyDown={this.guestOnKeyDown}
              onChange={this.handleChange}
            />
          ) : (
            <p>
              <b>Guests</b>
            </p>
          )}

          {Object.keys(state.attendees).map((key, index) => {
            return state.owner !== state.organizer ? (
              <RoundCheckbox
                key={index}
                id={`${key}-guest-checkmark`}
                checked={true}
                onChange={() => {
                  if (state.organizer === '' || state.organizer === state.owner) {
                    const attendees = state.attendees;
                    delete attendees[key];
                    this.setState({
                      attendees,
                    });
                  }
                }}
                label={state.attendees[key]['email']}
              />
            ) : null;
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
        <div className="add-form-description add-form-grid-item">
          {/* Text Area */}
          <Input
            type="textarea"
            placeholder="Add description"
            value={state.description}
            name="description"
            onChange={this.handleChange}
          />
        </div>
      </div>
    );
  };

  handleChangeTab = (event, tabLabel) => {
    this.setState({
      activeTab: tabLabel,
    });
  };

  render() {
    const { props, state } = this;
    if (state.start.dateTime !== undefined && state.start.dateTime !== undefined) {
      return (
        <Dialog onClose={this.backToCalendar} open={props.parentPropState} maxWidth="md">
          <DialogContent>
            {state.confirmationPopup ? this.renderPopup() : null}
            <div className="calendar">
              <div className="add-form-main-panel-container">
                <div className="add-form-main-panel">
                  {/* Add form header */}
                  <div className="add-form-header">
                    {/* Event Title Input */}
                    <EventTitle
                      type="text"
                      value={state.title}
                      name="title"
                      placeholder="Untitled event"
                      onChange={this.handleChange}
                    />
                  </div>

                  {/* Main edit event page*/}
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
              <BigButton variant="big-blue" onClick={this.handleEditEvent}>
                Save
              </BigButton>
            </div>
          </DialogActions>
        </Dialog>
      );
    } else {
      return null;
    }
  }
}
