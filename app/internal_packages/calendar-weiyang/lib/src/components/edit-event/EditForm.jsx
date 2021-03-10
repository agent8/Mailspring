import React, { Fragment } from 'react';
import moment from 'moment-timezone';
import uuidv4 from 'uuid';
import Select from 'react-select';
import EventTitle from '../MiniComponents/EventTitle';
import BigButton from '../MiniComponents/BigButton';
import Input from '../MiniComponents/Input';
import RoundCheckbox from '../MiniComponents/RoundCheckbox';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import ICAL from 'ical.js';
import RRuleGenerator from '../react-rrule-generator/src/lib';
import * as recurrenceOptions from '../common-utils/recurrenceOptions';
import { Actions } from 'mailspring-exports';
import wycalendarStoreEs6 from '../../../../../../src/flux/stores/wycalendar-store.es6';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';

const START_INDEX_OF_UTC_FORMAT = 17;
const START_INDEX_OF_HOUR = 11;
const END_INDEX_OF_HOUR = 13;
const TIME_OFFSET = 12;
const START_INDEX_OF_DATE = 0;
const END_INDEX_OF_DATE = 11;
const END_INDEX_OF_MINUTE = 16;

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);
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

      allDay: false,
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
    };
  }

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
    const { props } = this;
    const { state } = this;

    const startDateParsed = moment(state.start.dateTime * 1000).startOf('day');
    const endDateParsed = moment(state.end.dateTime * 1000);
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
      allDay: event.target.checked,
      updatedStartDateTime: startDateParsedInUTC,
      updatedEndDateTime: endDateParsedInUTC,
    });
  };

  createDbRecurrenceObj = () => {
    const { state } = this;
    return {
      id: uuidv4(),
      originalId: state.recurringMasterId,
      freq: recurrenceOptions.parseFreqByNumber(state.firstSelectedOption),
      interval: parseInt(state.recurrInterval, 10),
      recurringTypeId: state.recurrStartDate,
      until: state.thirdRecurrOptions === 'n' ? '' : state.recurrEndDate,
      numberOfRepeats: state.thirdRecurrOptions === 'a' ? state.thirdOptionAfter : 0,
      weeklyPattern: state.firstSelectedOption === 1 ? state.selectedSecondRecurrOption[1] : [],
      exDates: [],
      recurrenceIds: [],
      modifiedThenDeleted: false,
    };
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
      this.renderPopup();
    } else {
      this.editEvent();
    }
  };

  editEvent = () => {
    const { props, state } = this;
    const user = props.providers[state.providerType].filter(
      object => object.email === state.owner
    )[0];
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
      allDay: state.allDay,
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
    Actions.closeModal();
    props.beginEditEvent(payload);
    props.history.push('/');
  };

  editAllRecurrenceEvent = () => {
    const { props, state } = this;
    const user = props.providers[state.providerType].filter(
      object => object.email === state.owner
    )[0];
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
      allDay: state.allDay,
      start: moment.tz(state.updatedStartDateTime, tzid),
      end: moment.tz(state.updatedEndDateTime, tzid),
      providerType: state.providerType,

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

      // Updated fields
      updatedIsRecurring: state.updatedIsRecurring,
      updatedRrule: state.updatedIsRecurring ? state.updatedRrule.slice(6) : undefined, // remove the 'rrule:' from the front which interferes with parsing of the updated string into iCal string with ical.js later, remove field if recur -> single

      // User and moving information
      user,
      props,

      // Past event incase of error
      oldEventJson: state.oldEventJson,
      oldRpJson: state.oldRpJson,
    };
    // debugger;
    Actions.closeModal();
    props.beginEditRecurrenceSeries(payload);
    props.history.push('/');
  };

  editFutureRecurrenceEvent = () => {
    const { props, state } = this;
    const user = props.providers[state.providerType].filter(
      object => object.email === state.owner
    )[0];
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
      allDay: state.allDay,
      start: moment.tz(state.updatedStartDateTime, tzid),
      end: moment.tz(state.updatedEndDateTime, tzid),
      providerType: state.providerType,

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
    Actions.closeModal();
    props.beginEditFutureRecurrenceSeries(payload);
    props.history.push('/');
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
    const [eventPresent] = wycalendarStoreEs6
      .getIcloudCalendarData()
      .filter(storedEvent => storedEvent.id === id);

    // Remember to moment.unix because dateTime is stored in seconds instead of miliseconds
    const text = recurrenceOptions.parseString(
      Math.ceil(moment.unix(eventPresent.start.dateTime).date() / 7)
    );
    const secondRecurrOptions = recurrenceOptions.secondRecurrOptions(eventPresent.start, text);

    if (eventPresent.isRecurring) {
      const [eventRecurrence] = wycalendarStoreEs6
        .getIcloudRpLists()
        .filter(storedRp => storedRp.originalId === eventPresent.recurringEventId);
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

      this.setState({
        updatedIsRecurring: true,
        updatedRrule: eventRecurrence.iCALString,
        isRecurring: true,
        showRruleGenerator: true,
        initialRrule: eventRecurrence.iCALString,
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
        oldRpJson: eventRecurrence.toJSON(),
      });
    }

    const startDateParsedInUTC = this.processStringForUTC(
      eventPresent.allDay
        ? moment(eventPresent.start.dateTime * 1000).format('YYYY-MM-DD')
        : moment(eventPresent.start.dateTime * 1000).format('YYYY-MM-DDThh:mm')
    );
    const endDateParsedInUTC = this.processStringForUTC(
      eventPresent.allDay
        ? moment(eventPresent.end.dateTime * 1000).format('YYYY-MM-DD')
        : moment(eventPresent.end.dateTime * 1000).format('YYYY-MM-DDThh:mm')
    );

    // right now caldav server retrieved events do not have guests by default
    let attendees = {};
    let partstat = '';
    if (eventPresent.attendee !== '') {
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
      allDay: eventPresent.allDay,
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
    this.setState((state, props) => ({
      updatedRrule: selectedRrule.slice(6),
      updatedIsRecurring: selectedRrule.slice(6) === '' ? false : true,
    }));

    // CHANGING OF DATE DYNAMICALLY
    const { state } = this;
    // eslint-disable-next-line no-underscore-dangle
    const rruleObj = ICAL.Recur._stringToData(selectedRrule);
    if (rruleObj.until !== undefined) {
      rruleObj.until.adjust(1, 0, 0, 0, 0);
    }

    if (rruleObj === null || rruleObj['rrule:freq'] === 'DAILY') {
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
    let newStartDateParsed = moment(state.updatedStartDateTime);
    let newEndDateParsed = moment(state.updatedEndDateTime);
    if (rruleObj['rrule:freq'] === 'WEEKLY' && rruleObj.BYDAY !== undefined) {
      let nextDayDiff;
      const currentDay = moment(state.updatedStartDateTime).day();

      // If only one day is selected, it will be a string. Else it will be an array
      if (Array.isArray(rruleObj.BYDAY)) {
        nextDayDiff =
          dayOfWeek[rruleObj.BYDAY.includes('SU') ? 'SU' : rruleObj.BYDAY[0]] - currentDay;
      } else {
        nextDayDiff = dayOfWeek[rruleObj.BYDAY] - currentDay;
      }

      // Calculate and set the new date
      newStartDateParsed = moment(state.updatedStartDateTime).add(nextDayDiff, 'days');
      newEndDateParsed = moment(state.updatedEndDateTime).add(nextDayDiff, 'days');
    } else if (rruleObj['rrule:freq'] === 'MONTHLY') {
      if (rruleObj.BYDAY !== undefined) {
        newStartDateParsed = moment(newStartDateParsed)
          .set('date', 1)
          .isoWeekday(dayOfWeek[rruleObj.BYDAY] + 7 * rruleObj.BYSETPOS);
        newEndDateParsed = moment(newEndDateParsed)
          .set('date', 1)
          .isoWeekday(dayOfWeek[rruleObj.BYDAY] + 7 * rruleObj.BYSETPOS);
      } else if (rruleObj.BYMONTHDAY !== undefined) {
        newStartDateParsed = moment(newStartDateParsed).set('date', rruleObj.BYMONTHDAY);
        newEndDateParsed = moment(newEndDateParsed).set('date', rruleObj.BYMONTHDAY);
      }
    } else if (rruleObj['rrule:freq'] === 'YEARLY') {
      const newYear =
        moment(state.start).month() > rruleObj.BYMONTH
          ? moment(state.start).year() + 1
          : moment(state.start).year();
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
      start: { dateTime: newStartDateParsed.unix(), timezone: 'Asia/Singapore' },
      end: { dateTime: newEndDateParsed.unix(), timezone: 'Asia/Singapore' },
      updatedStartDateTime: this.processStringForUTC(newStartDateParsed.format('YYYY-MM-DDThh:mm')),
      updatedEndDateTime: this.processStringForUTC(newEndDateParsed.format('YYYY-MM-DDThh:mm')),
    });
  };

  renderPopup = () => {
    const { state } = this;
    if (state.initialRrule !== state.updatedRrule) {
      Actions.openModal({
        component: (
          <div className="popup-modal">
            <h5>You're changing a repeating event's rule.</h5>
            <p>Do you want to change all occurrences?</p>
            <div className="modal-button-group">
              <BigButton variant="small-blue" onClick={() => Actions.closeModal()}>
                Cancel
              </BigButton>
              <BigButton variant="small-white" onClick={this.editAllRecurrenceEvent}>
                Update All
              </BigButton>
            </div>
          </div>
        ),
      });
    } else {
      Actions.openModal({
        component: (
          <div className="popup-modal">
            <h5>You're changing a repeating event.</h5>
            <p>Do you want to change only this occurrence of the event, or all occurrences?</p>
            <div className="modal-button-group">
              <BigButton variant="small-blue" onClick={() => Actions.closeModal()}>
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
            </div>
          </div>
        ),
      });
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
            type={state.allDay ? 'date' : 'datetime-local'}
            value={new Date(state.updatedStartDateTime)}
            name="updatedStartDateTime"
            onChange={date => this.setState({ updatedStartDateTime: date })}
          />
        </div>
        <div className="add-form-end-time add-form-grid-item">
          {/* End Time and Date */}
          <Input
            label="Ends"
            type={state.allDay ? 'date' : 'datetime-local'}
            value={new Date(state.updatedEndDateTime)}
            name="updatedEndDateTime"
            onChange={date => this.setState({ updatedEndDateTime: date })}
          />
        </div>
        <div className="add-form-repeat add-form-grid-item">
          <RRuleGenerator
            // onChange={(rrule) => console.log(`RRule changed, now it's ${rrule}`)}
            key="rrulegenerator"
            onChange={this.handleRruleChange}
            name="rrule"
            value={state.updatedRrule}
            config={{
              hideStart: true,
              repeat: ['Never', 'Yearly', 'Monthly', 'Weekly', 'Daily'],
              end: ['On date', 'After'],
            }}
          />
        </div>
        <div className="add-form-all-day add-form-grid-item">
          <div className="all-day-checkbox-container">
            <RoundCheckbox
              id="allday-checkmark"
              checked={state.allDay}
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
        break;
      case 'Find a Time':
        return this.renderFindATime();
        break;
      default:
        return <h1>Error</h1>;
        break;
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

  renderCalendar = props => {
    const visibleEvents = props.visibleEvents;
    return (
      <DragAndDropCalendar
        // have to use .props here somehow, should not have to use it.
        defaultDate={new Date(this.state.updatedStartDateTime).props}
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

  render() {
    const { props, state } = this;

    if (state.start.dateTime !== undefined && state.start.dateTime !== undefined) {
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
        </Fragment>
      );
    }
    return null;
  }
}
