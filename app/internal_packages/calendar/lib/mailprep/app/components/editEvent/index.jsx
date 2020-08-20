import React from 'react';
import moment from 'moment';

import {
  ConflictResolutionMode,
  SendInvitationsOrCancellationsMode,
  DateTime,
  SendInvitationsMode,
  Appointment,
  ExchangeService,
  Uri,
  ExchangeCredentials,
  DayOfTheWeek,
  Recurrence,
  WellKnownFolderName,
  Item,
  DailyPattern,
  DayOfTheWeekCollection
} from 'ews-javascript-api';
import uuidv4 from 'uuid';
import Select from 'react-select';
import ReactDateTimePicker from 'react-datetime-picker/dist/entry.nostyle';
import EventTitle from '../library/EventTitle';
import BigButton from '../library/BigButton';
import DateFnsUtils from '@date-io/moment';
import Input from '../library/Input';
import RoundCheckbox from '../library/RoundCheckbox';
import Tabs from '../library/Tabs/Tabs';
import DropDown from '../library/DropDown/DropDown';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import ICAL from 'ical.js';
import Location from './location';
import Attendees from './attendees';
import Date from './date';
import Time from './time';
import Conference from './conference';
import Checkbox from './checkbox';
import RRuleGenerator from '../react-rrule-generator/src/lib';
import { loadClient, editGoogleEvent } from '../../utils/client/google';
import {
  asyncUpdateExchangeEvent,
  asyncUpdateRecurrExchangeSeries,
  asyncDeleteExchangeEvent
} from '../../utils/client/exchange';
// import './index.css';
import { dropDownTime, OUTLOOK, EXCHANGE, GOOGLE, CALDAV } from '../../utils/constants';

// import '../../bootstrap.css';
import * as recurrenceOptions from '../../utils/recurrenceOptions';

import * as dbEventActions from '../../sequelizeDB/operations/events';
import * as dbRpActions from '../../sequelizeDB/operations/recurrencepatterns';

const START_INDEX_OF_UTC_FORMAT = 17;
const START_INDEX_OF_HOUR = 11;
const END_INDEX_OF_HOUR = 13;
const TIME_OFFSET = 12;
const START_INDEX_OF_DATE = 0;
const END_INDEX_OF_DATE = 11;
const END_INDEX_OF_MINUTE = 16;

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

export default class EditEvent extends React.Component {
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
      guest: '',
      organizer: '',
      attendees: [],
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
      updatedStartDateTime: '',
      updatedEndDateTime: '',
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
      activeTab: 'Details'
    };
  }

  componentDidMount() {
    const { props, state } = this;
    this.retrieveEvent(props.match.params.id);
  }

  processStringForUTC = (dateInString) => {
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

  // dateTime saved as SECONDS since start of unix time, not miliseconds
  handleStartChange = (start) => {
    const { props, state } = this;
    const newStart = {
      dateTime: start.unix(),
      timezone: state.updatedStartDateTime.timezone
    };
    this.setState({ updatedStartDateTime: newStart });
  };

  // dateTime saved as SECONDS since start of unix time, not miliseconds
  handleEndChange = (end) => {
    const { props, state } = this;
    const newEnd = {
      dateTime: end.unix(),
      timezone: state.updatedStartDateTime.timezone
    };
    this.setState({ updatedEndDateTime: newEnd });
  };

  handleChange = (event) => {
    if (event.target !== undefined) {
      this.setState({
        [event.target.name]: event.target.value
      });
    } else {
      this.setState({
        [event.name]: event.value
      });
    }
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

  handleInputChange = (event) => {
    const { target } = event;
    const { value } = target;
    const { name } = target;
    this.setState({
      [name]: value
    });
  };

  handleCheckboxChange = (event) => {
    this.setState({ allDay: event.target.checked });
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
      modifiedThenDeleted: false
    };
  };

  editEvent = () => {
    const { props, state } = this;
    const user = props.providers[state.providerType].filter(
      (object) => object.email === state.owner
    )[0];
    const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = {
      id: state.id,
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
      oldRpJson: state.oldRpJson
    };
    // debugger;
    props.beginEditEvent(payload);
    props.history.push('/');
  };

  editAllRecurrenceEvent = () => {
    const { props, state } = this;
    const user = props.providers[state.providerType].filter(
      (object) => object.email === state.owner
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

      // Updated fields
      updatedIsRecurring: state.updatedIsRecurring,
      updatedRrule: state.updatedIsRecurring ? state.updatedRrule.slice(6) : undefined, // remove the 'rrule:' from the front which interferes with parsing of the updated string into iCal string with ical.js later, remove field if recur -> single

      // User and moving information
      user,
      props,

      // Past event incase of error
      oldEventJson: state.oldEventJson,
      oldRpJson: state.oldRpJson
    };
    // debugger;
    props.beginEditRecurrenceSeries(payload);
    props.history.push('/');
  };

  editFutureRecurrenceEvent = () => {
    const { props, state } = this;
    const user = props.providers[state.providerType].filter(
      (object) => object.email === state.owner
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
      oldRpJson: state.oldRpJson
    };
    // debugger;
    props.beginEditFutureRecurrenceSeries(payload);
    props.history.push('/');
  };

  backToCalendar = () => {
    const { props } = this;
    props.history.push('/');
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
  retrieveEvent = async (id) => {
    const { props, state } = this;
    const dbEvent = await dbEventActions.getOneEventById(id);
    const dbEventJSON = dbEvent.toJSON();
    // console.log(dbEventJSON);

    // Remember to moment.unix because dateTime is stored in seconds instead of miliseconds
    const text = recurrenceOptions.parseString(
      Math.ceil(moment.unix(dbEventJSON.start.dateTime).date() / 7)
    );
    const secondRecurrOptions = recurrenceOptions.secondRecurrOptions(dbEventJSON.start, text);

    if (dbEventJSON.isRecurring) {
      const dbEventRecurrence = await dbRpActions.getOneRpByOId(dbEventJSON.recurringEventId);
      // this.setState({
      //   initialRrule: dbEventRecurrence.iCALString
      // });
      const thirdRecurrChoice = recurrenceOptions.parseThirdRecurrOption(
        dbEventRecurrence.until,
        dbEventRecurrence.numberOfRepeats
      );

      const firstSelected = recurrenceOptions.parseFreq(dbEventRecurrence.freq);
      const secondSelected = recurrenceOptions.parseFreqNumber(firstSelected);

      let monthlySelected = 0;
      let yearlySelected = 0;
      if (secondSelected === 'month') {
        if (dbEventRecurrence.byMonthDay === '()') {
          monthlySelected = 1;
        } else {
          monthlySelected = 0;
        }
      } else if (secondSelected === 'year') {
        if (dbEventRecurrence.byMonthDay === '()') {
          yearlySelected = 1;
        } else {
          yearlySelected = 0;
        }
      }

      const selectedSecondRecurrOptions = [];
      if (firstSelected === 1) {
        this.setState({
          selectedSecondRecurrOption: [
            0,
            dbEventRecurrence.weeklyPattern
              .split(',')
              .filter((e) => e !== '')
              .map((e) => parseInt(e, 10)),
            0,
            0
          ]
        });
        // console.log([0, dbEventRecurrence.weeklyPattern, 0, 0])
      } else if (firstSelected === 2) {
        this.setState({
          selectedSecondRecurrOption: [
            0,
            dbEventRecurrence.weeklyPattern
              .split(',')
              .filter((e) => e !== '')
              .map((e) => parseInt(e, 10)),
            monthlySelected,
            0
          ]
        });
        // console.log([0, dbEventRecurrence.weeklyPattern, monthlySelected, 0])
      } else if (firstSelected === 3) {
        this.setState({
          selectedSecondRecurrOption: [
            0,
            dbEventRecurrence.weeklyPattern
              .split(',')
              .filter((e) => e !== '')
              .map((e) => parseInt(e, 10)),
            0,
            yearlySelected
          ]
        });
        // console.log([0, dbEventRecurrence.weeklyPattern, 0, yearlySelected]);
      }

      console.log(dbEventRecurrence);
      console.log('syncing recurring');
      const updatedRecurringDetails = {
        ...state.updatedEventDetails,
        isRecurring: true,
        rrule: dbEventRecurrence.iCALString
      };
      this.setState({
        updatedIsRecurring: true,
        updatedRrule: dbEventRecurrence.iCALString,
        isRecurring: true,
        showRruleGenerator: true,
        initialRrule: dbEventRecurrence.iCALString,
        isMaster: dbEventJSON.isMaster,
        recurringEventId: dbEventJSON.recurringEventId,
        recurrInterval: dbEventRecurrence.interval,
        firstSelectedOption: firstSelected,
        secondRecurrOptions: secondRecurrOptions[secondSelected],
        thirdRecurrOptions: thirdRecurrChoice,
        recurrStartDate: moment(dbEventRecurrence.recurringTypeId).format('YYYY-MM-DDTHH:mm:ssZ'),
        recurrEndDate:
          dbEventRecurrence.until !== null
            ? moment(dbEventRecurrence.until).format('YYYY-MM-DDTHH:mm:ssZ')
            : null,
        recurringMasterId: dbEventRecurrence.originalId,
        recurrPatternId: dbEventRecurrence.id,
        thirdOptionAfter: dbEventRecurrence.numberOfRepeats,

        recurrByMonth: dbEventRecurrence.byMonth,
        recurrByMonthDay:
          dbEventRecurrence.byMonthDay !== '()'
            ? dbEventRecurrence.byMonthDay
            : `(${moment(dbEventJSON.start).date()})`,
        // recurrByWeekDay:
        //   dbEventRecurrence.byWeekDay !== '()'
        //     ? dbEventRecurrence.byWeekDay
        //     : `(${moment(dbEventJSON.start).day()})`,
        recurrByWeekDay: dbEventRecurrence.byWeekDay,
        recurrByWeekNo: dbEventRecurrence.byWeekNo,
        oldRpJson: dbEventRecurrence.toJSON()
      });
    }

    // debugger;

    const startDateParsedInUTC = this.processStringForUTC(
      moment(dbEventJSON.start.dateTime * 1000).format('YYYY-MM-DDThh:mm')
    )
    const endDateParsedInUTC = this.processStringForUTC(
      moment(dbEventJSON.end.dateTime * 1000).format('YYYY-MM-DDThh:mm')
    )

    this.setState({
      updatedStartDateTime: startDateParsedInUTC,
      updatedEndDateTime: endDateParsedInUTC,
      updateAttendees: dbEventJSON.attendees,
      updatedLocation: '',
      updatedConference: '',

      visibleStart: dbEventJSON.start.dateTime * 1000,
      visibleEnd: dbEventJSON.end.dateTime * 1000,

      id: dbEventJSON.id,
      title: dbEventJSON.summary,
      description: dbEventJSON.description,
      start: dbEventJSON.start,
      end: dbEventJSON.end,
      location: dbEventJSON.location,
      organizer: dbEventJSON.organizer,
      attendees: dbEventJSON.attendee === '' ? [] : dbEventJSON.attendee.split(','),
      hangoutLink: dbEventJSON.hangoutLink,
      providerType: dbEventJSON.providerType,
      owner: dbEventJSON.owner,
      originalId: dbEventJSON.originalId,
      iCalUID: dbEventJSON.iCalUID,
      oldEventJson: dbEventJSON,
      allDay: dbEventJSON.allDay
    });
  };

  handleIntervalChange = (event) => {
    this.setState({
      recurrInterval: event.target.value
    });
  };

  handleFirstRecurrOptions = (event) => {
    const { state } = this;
    // Remember to moment.unix because dateTime is stored in seconds instead of miliseconds
    const text = recurrenceOptions.parseString(
      Math.ceil(moment.unix(state.start.dateTime).date() / 7)
    );
    const secondRecurrOptions = recurrenceOptions.secondRecurrOptions(state.start, text);

    const newVal = state.selectedSecondRecurrOption[event.index];
    const newArr = state.selectedSecondRecurrOption;
    newArr[event.index] = newVal;

    this.setState({
      firstSelectedOption: event.index,
      secondRecurrOptions: secondRecurrOptions[event.value],
      selectedSecondRecurrOption: newArr
    });
  };

  handleSecondRecurrOptions = (event) => {
    const { state } = this;

    const newVal = state.selectedSecondRecurrOption[state.firstSelectedOption];
    const newArr = state.selectedSecondRecurrOption;
    newArr[state.firstSelectedOption] = event.index;
    // console.log(newVal, newArr, state);

    this.setState({
      selectedSecondRecurrOption: newArr
    });
  };

  handleThirdRecurrOptions = (event) => {
    this.setState({
      thirdRecurrOptions: event.value
    });
  };

  handleWeekChangeRecurr = (event) => {
    const { state } = this;

    // 1 coz, day week, month, year, week = index 1.
    const newVal = state.selectedSecondRecurrOption[1];

    const intParsed = parseInt(event.target.name, 10);
    // console.log(state, newVal, intParsed, newVal[intParsed]);
    // This alternates it between 1/0.
    newVal[intParsed] = newVal[intParsed] === 1 ? 0 : 1;
    const newArr = state.selectedSecondRecurrOption;
    newArr[1] = newVal;
    // console.log(state, newVal, newArr, event.target.name);

    this.setState({
      selectedSecondRecurrOption: newArr
    });
  };

  handleRruleChange = (selectedRrule) => {
    this.setState((state, props) => ({
      updatedRrule: selectedRrule.slice(6)
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
      SA: 6
    };
    // Change Date based on Weekly/Monthly/Yearly
    let newStartDateParsed = moment(state.updatedStartDateTime.dateTime * 1000);
    let newEndDateParsed = moment(state.updatedEndDateTime.dateTime * 1000);
    if (rruleObj['rrule:freq'] === 'WEEKLY' && rruleObj.BYDAY !== undefined) {
      let nextDayDiff;
      const currentDay = moment(state.updatedStartDateTime.dateTime * 1000).day();

      // If only one day is selected, it will be a string. Else it will be an array
      if (Array.isArray(rruleObj.BYDAY)) {
        nextDayDiff =
          dayOfWeek[rruleObj.BYDAY.includes('SU') ? 'SU' : rruleObj.BYDAY[0]] - currentDay;
      } else {
        nextDayDiff = dayOfWeek[rruleObj.BYDAY] - currentDay;
      }

      // Calculate and set the new date
      newStartDateParsed = moment(state.updatedStartDateTime.dateTime * 1000).add(
        nextDayDiff,
        'days'
      );
      newEndDateParsed = moment(state.updatedEndDateTime.dateTime * 1000).add(nextDayDiff, 'days');
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
      updatedStartDateTime: { dateTime: newStartDateParsed.unix(), timezone: 'Asia/Singapore' },
      updatedEndDateTime: { dateTime: newEndDateParsed.unix(), timezone: 'Asia/Singapore' }
    });
  };

  toggleRruleGenerator = (event) => {
    event.persist();
    this.setState((state, props) => ({
      showRruleGenerator: event.target.checked,
      updatedIsRecurring: event.target.checked
    }));
  };

  renderAddDetails = () => {
    const { props, state } = this;

    const repeatingUI = [];
    if (state.showRruleGenerator) {
      repeatingUI.push(

      );
    }


    return (<div className="add-form-details">
      <div className="add-form-start-time add-form-grid-item">
        {/* Start Time and Date */}
        <Input
          label="Starts"
          type="datetime-local"
          value={state.updatedStartDateTime}
          name="updatedStartDateTime"
          onChange={this.handleChange}
        />
      </div>
      <div className="add-form-end-time add-form-grid-item">
        {/* End Time and Date */}
        <Input
          label="Ends"
          type="datetime-local"
          value={state.updatedEndDateTime}
          name="updatedEndDateTime"
          onChange={this.handleChange}
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
            repeat: ["Never", "Yearly", "Monthly", "Weekly", "Daily"],
            end: ['On date', 'After']
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
      <div className="add-form-description add-form-grid-item">
        {/* Text Area */}
        <Input
          type="textarea"
          placeholder="Add description"
          value={state.description}
          name="desc"
          onChange={this.handleChange}
        />
      </div>
    </div>);
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

  render() {
    const { props, state } = this;
    // const rrulegenerator = [];
    // if (state.showRruleGenerator) {
    //   rrulegenerator.push(
    //     <RRuleGenerator
    //       open={false}
    //       key="rrulegenerator"
    //       onChange={this.handleRruleChange}
    //       name="rrule"
    //       value={state.updatedRrule}
    //       config={{
    //         hideStart: true,
    //         end: ['On date', 'After']
    //       }}
    //     />
    //   );
    // }

    const endMenu = [];
    if (state.isRecurring && !state.updatedIsRecurring) {
      endMenu.push(
        <BigButton variant="big-blue" onClick={this.editAllRecurrenceEvent}>
          Update all events
        </BigButton>
      );
    } else {
      endMenu.push(
        <BigButton variant="big-blue" onClick={this.editEvent}>
          Save
        </BigButton>
      );
      if (state.isRecurring) {
        if (state.isMaster) {
          endMenu.push(
            <BigButton variant="big-blue" onClick={this.editAllRecurrenceEvent}>
              Update All
            </BigButton>
          );
        } else {
          endMenu.push(
            <BigButton variant="big-blue" onClick={this.editFutureRecurrenceEvent}>
              Update Future
            </BigButton>
          );
        }
      }
    }

    if (state.start.dateTime !== undefined && state.start.dateTime !== undefined) {
      return (
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
                {/* Save/Cancel buttons */}
                <div className="add-form-button-group">
                  <BigButton variant="big-white" onClick={this.backToCalendar}>
                    Cancel
                  </BigButton>
                  {endMenu}
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
    return null;
  }
}
