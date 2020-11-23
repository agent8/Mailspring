import React, { Children, Component } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { Calendar as MiniCalendar } from 'react-calendar';
import moment from 'moment';
// import Modal from 'react-modal';
import { Modal } from 'mailspring-component-kit'
import { Actions } from 'mailspring-exports'
import RRule from 'rrule';
import ICAL from 'ical.js';
import fileSystem from 'fs';
import BigButton from './library/BigButton';

import {
  ExchangeService,
  Uri,
  ExchangeCredentials,
  WellKnownFolderName,
  FolderView,
  Appointment,
  DateTime,
  FolderId,
  SendInvitationsMode,
  MessageBody,
  Item,
  CalendarView,
  ConflictResolutionMode,
  SendInvitationsOrCancellationsMode,
  DeleteMode
} from 'ews-javascript-api';
import FilterCalendar from './FilterEvents';
import * as ProviderTypes from '../utils/constants';
import SignupSyncLink from './SignupSyncLink';
import serverUrls from '../utils/serverUrls';
import {
  FASTMAIL_USERNAME,
  FASTMAIL_PASSWORD,
  ICLOUD_USERNAME,
  ICLOUD_PASSWORD,
  YAHOO_USERNAME,
  YAHOO_PASSWORD
} from '../utils/credentials';
import * as ServerColors from '../utils/colors';

import AccountBlock from '../sequelizeDB/schemas/accounts';
import EventBlock from '../sequelizeDB/schemas/events';
import RpBlock from '../sequelizeDB/schemas/recurrencePatterns';
import { getAllAccounts } from '../sequelizeDB/operations/accounts';
import * as dbEventActions from '../sequelizeDB/operations/events';
import * as dbRpOperations from '../sequelizeDB/operations/recurrencepatterns';
import {
  asyncCreateExchangeEvent,
  createNewEwsRecurrenceObj,
  editEwsRecurrenceObj,
  asyncGetRecurrAndSingleExchangeEvents,
  asyncDeleteExchangeEvent,
  asyncUpdateExchangeEvent
} from '../utils/client/exchange';
import { asyncGetAllExchangeEvents } from '../utils/client/exchangebasics';
import { getdb } from '../sequelizeDB/index';


const dav = require('dav');
const uuidv1 = require('uuid/v1');

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

// CREATE constants here for now, decide how to store colors later


const customStyles = {
  overlay: {
    background: 'none'
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    width: '32%',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#f9fafa',
    boxShadow: '0px 0px 10px -5px',
    // height: '32%',
    // maxHeight: '95%',
    // width: '32%',
    // maxWidth: '95%',
    // overflow: 'auto',
    // position: 'absolute',
    // backgroundColor: 'red',
    // boxShadow: '0 10px 20px rgba(0,0,0,0.19), inset 0 0 1px rgba(0,0,0,0.5)',
    // borderRadius: '5px',
  }
};

const deleteModalStyles = {
  overlay: {
    background: 'none'
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    width: '40%',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#f9fafa',
    boxShadow: '0px 0px 10px -5px',
  }
};

const CURRENT_DATE = moment().toDate();
const dateClassStyleWrapper = ({ children, value }) =>
  React.cloneElement(Children.only(children), {
    style: {
      ...children.style
      // backgroundColor: value < CURRENT_DATE ? 'lightgreen' : 'lightblue'
    }
  });

export default class View extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentEvent: [{}],
      isShowEvent: false,
      isShowDeleteForm: false,
      isShowLoginForm: false,
      currentEventStartDateTime: '',
      currentEventEndDateTime: '',
      email: '',
      pwd: '',
      accountType: 'ICLOUD',
      dateSelected: new Date()
    };
    let incrementalSync;

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);

    // dav.debug.enabled = true;
  }

  // This was for react-modal
  // componentWillMount() {
  //   Modal.setAppElement('mailspring-workspace');
  // }

  async componentDidMount() {
    const { props } = this;
    // getdb to initialize sequelize on first load, if not error.
    await getdb();
    // Debug check on loading of main UI
    // const accounts = await AccountBlock.findAll();
    const accounts = await getAllAccounts();
    console.log(`Accounts:`);
    console.log(accounts.map((e) => e.toJSON()));
    const eventData = await EventBlock.findAll();
    console.log(`Event data:`);
    console.log(eventData.map((e) => e.toJSON()));
    const rpData = await RpBlock.findAll();
    console.log(`rpData:`);
    console.log(rpData.map((e) => e.toJSON()));

    moment(); // In case I need moment for debugging in this function
    // debugger;

    // Automatic user login
    getAllAccounts().then((providerUserData) => {
      providerUserData.forEach((singleProviderUserData) => {
        if (singleProviderUserData.providerType === ProviderTypes.EXCHANGE) {
          props.onStartGetExchangeAuth(
            this.filterAccountOnStart(singleProviderUserData, ProviderTypes.EXCHANGE)
          );
        } else if (singleProviderUserData.providerType === ProviderTypes.CALDAV) {
          props.onStartGetCaldavAuth(
            this.filterAccountOnStart(singleProviderUserData, ProviderTypes.CALDAV)
          );
        } else {
          const now = new Date().getTime();
          const isExpired = now > parseInt(singleProviderUserData.accessTokenExpiry, 10);

          if (!isExpired) {
            switch (singleProviderUserData.providerType) {
              case ProviderTypes.GOOGLE:
                props.onStartGetGoogleAuth(
                  this.filterAccountOnStart(singleProviderUserData, ProviderTypes.GOOGLE)
                );
                break;
              case ProviderTypes.OUTLOOK:
                props.onStartGetOutlookAuth(
                  this.filterAccountOnStart(singleProviderUserData, ProviderTypes.OUTLOOK)
                );
                break;
              default:
                break;
            }
          } else {
            switch (singleProviderUserData.providerType) {
              case ProviderTypes.GOOGLE:
                props.onExpiredGoogle(
                  this.filterAccountOnStart(singleProviderUserData, ProviderTypes.GOOGLE)
                );
                break;
              case ProviderTypes.OUTLOOK:
                props.onExpiredOutlook(
                  this.filterAccountOnStart(singleProviderUserData, ProviderTypes.OUTLOOK)
                );
                break;
              default:
                break;
            }
          }
        }
      });
    });
  }

  componentWillUnmount() {
    clearInterval(this.incrementalSync);
    this.incrementalSync = null;
  }

  buildTitleStringFromRP = (e) => {
    const { rp, events } = e;
    const str = events[0].summary
      .replace(/\(.*?\)/, '')
      .trim()
      .replace(/\//g, ',');
    return str;
  };

  // #region Login Functions
  authorizeOutLookCodeRequest = () => {
    const { props } = this;
    props.beginOutlookAuth();
  };

  authorizeGoogleCodeRequest = () => {
    const { props } = this;
    props.beginGoogleAuth();
  };

  authorizeExchangeCodeRequest = (user, pwd) => {
    const { props } = this;
    props.beginExchangeAuth(user, pwd);
  };

  authorizeCaldavCodeRequest = (user, pwd, type) => {
    const { props } = this;
    let url = '';
    console.log(`Account type : ${type}`);
    switch (type) {
      case 'ICLOUD':
        url = serverUrls.ICLOUD;
        break;
      case 'FASTMAIL':
        url = serverUrls.FASTMAIL;
        break;
      case 'YAHOO':
        url = serverUrls.YAHOO;
        break;
      case 'GOOGLE':
        url = serverUrls.GOOGLE;
        break;
      case 'GMX':
        url = serverUrls.GMX;
        break;
      default:
        break;
    }

    props.beginCaldavAuth({
      username: user,
      password: pwd,
      url
    });
  };
  // #endregion

  // #region Calendar Event Functions
  moveEventList = ({ event, start, end }) => {
    const { events } = this.props;
    const { props } = this;

    const idx = events.indexOf(event);
    const updatedEvent = { ...event, start, end };

    const nextEvents = [...events];
    nextEvents.splice(idx, 1, updatedEvent);
    props.updateEvents(nextEvents);
  };

  resizeEvent = (resizeType, { event, start, end }) => {
    const { events } = this.props;
    const { props } = this;

    const nextEvents = events.map((existingEvent) =>
      existingEvent.id === event.id ? { ...existingEvent, start, end } : existingEvent
    );
    props.updateEvents(nextEvents);
  };
  // #endregion

  // #region Router Functions
  addEvent = ({ start, end }) => {
    const { props } = this;
    props.history.push(`/${start}/${end}`);
  };

  editEvent = (event) => {
    const { props } = this;
    Actions.closePopover();
    props.history.push(`/${event.id}`);
  };
  // #endregion

  // #region On Event Clicks
  handleEventClick = async (event, target) => {
    const eventPresent = await dbEventActions.getOneEventById(event.id)
    if (eventPresent === null) {
      return;
    }
    this.renderEventPopup(event, target)
    this.setState({
      // isShowEvent: true,
      currentEvent: event,
      currentEventStartDateTime: moment(event.start).format('MMMM D YYYY, h:mm a'),
      currentEventEndDateTime: moment(event.end).format('MMMM D YYYY, h:mm a')
    });
  };

  handleChange = (event) => {
    this.setState({ [event.target.name]: event.target.value });
  };

  handleSubmit = async (e) => {
    // console.log(this.props)
    // console.log(this.state)
    // debugger;
    e.preventDefault();
    const { email, pwd, accountType } = this.state;
    // Temp set to icloud for now
    // const accountType = 'ICLOUD'

    if (accountType === 'EWS') {
      this.authorizeExchangeCodeRequest({
        username: email,
        password: pwd
      });
    } else {
      this.authorizeCaldavCodeRequest(email, pwd, accountType);
    }
    this.setState({ isShowLoginForm: false })
  };
  // #endregion

  // This filter user is used when the outlook first creates the object.
  // It takes the outlook user object, and map it to the common schema defined in db/person.js
  filterAccountOnStart = (rxDoc, providerType) => ({
    user: {
      caldavType: rxDoc.caldavType,
      personId: rxDoc.personId,
      originalId: rxDoc.originalId,
      email: rxDoc.email,
      providerType,
      accessToken: rxDoc.accessToken,
      accessTokenExpiry: rxDoc.accessTokenExpiry,
      password: rxDoc.password,
      principalUrl: rxDoc.principalUrl,
      calendars: rxDoc.calendars
    }
  });

  closeModal = () => {
    Actions.closePopover();
    Actions.closeModal();
  };

  handleDeleteEvent = (event) => {
    if (event.isRecurring) {
      Actions.openModal({
        component:
          <div className="popup-modal">
            <h5>You're deleting an event</h5>
            <p>Do you want to delete all occurrences of this event, or only the selected occurrence?</p>
            <div className="modal-button-group">
              <BigButton variant="small-blue" onClick={() => Actions.closeModal()}>
                Cancel
            </BigButton>
              {event.isMaster
                ? <BigButton variant="small-white" onClick={() => this.deleteAllRecurrenceEvent(event)}>
                  Delete All
                  </BigButton>
                : <BigButton variant="small-white" onClick={() => this.deleteFutureRecurrenceEvent(event)}>
                  Delete All Future Events
                  </BigButton>
              }
              <BigButton variant="small-white" onClick={() => this.deleteEvent(event)}>
                Delete Only This Event
                </BigButton>

            </div>
          </div>,
        width: 510,
        height: 170
      })
    } else {
      this.deleteEvent(event);
    }
  }
  // #region Delete functionality
  deleteEvent = (event) => {
    const { props } = this;
    props.beginDeleteEvent(event.id);
    this.closeModal();
  };

  deleteAllRecurrenceEvent = (event) => {
    const { props } = this;
    props.beginDeleteRecurrenceSeries(event.id);
    this.closeModal();
  };

  deleteFutureRecurrenceEvent = (event) => {
    const { props } = this;
    props.beginDeleteFutureRecurrenceSeries(event.id);
    this.closeModal();
  };
  // #endregion

  // #region Styling

  getColor = (event) => {
    switch (event.providerType) {
      case ProviderTypes.GOOGLE:
        return ServerColors.GOOGLE_EVENT;
      case ProviderTypes.OUTLOOK:
        return ServerColors.OUTLOOK_EVENT;
      case ProviderTypes.EXCHANGE:
        return ServerColors.EXCHANGE_EVENT;
      case ProviderTypes.CALDAV:
        switch (event.caldavType) {
          case ProviderTypes.ICLOUD:
            return ServerColors.ICLOUD_EVENT;
          case ProviderTypes.FASTMAIL:
            return ServerColors.FASTMAIL_EVENT;
          case ProviderTypes.YAHOO:
            return ServerColors.YAHOO_EVENT;
          default:
            return ServerColors.DEFAULT_EVENT;
        }
      default:
        return ServerColors.DEFAULT_EVENT;
    }
  };

  eventStyleGetter = (event, start, end, isSelected) => {
    const backgroundColor = this.getColor(event);
    const style = {
      backgroundColor
      // borderRadius: '0px',
      // opacity: 0.8,
      // color: 'black',
      // border: '0px',
      // display: 'block'
    };
    return {
      style
    };
  };
  // #endregion

  renderDayContent = (date, view) => {
    const event = this.eventPresent(date);
    if (view === 'month' && event) {
      return (<p className={`event-dot dot-${event.colorId}`}>&#8226;</p>);
    }
    else {
      return (<p className={'empty-event-dot'}>.</p>);
    }
  }

  eventPresent = (date) => {
    const visibleEvents = this.props.visibleEvents;
    const dateTimeStamp = new Date(date);
    for (let i = 0; i < visibleEvents.length; i++) {
      // check if date falls between start and end datetime
      // do special check on first day of event
      if (
        (dateTimeStamp.getTime() >= new Date(visibleEvents[i].start).getTime() &&
          dateTimeStamp.getTime() <= new Date(visibleEvents[i].end).getTime()) ||
        (dateTimeStamp.getDate() === new Date(visibleEvents[i].start).getDate() &&
          dateTimeStamp.getMonth() === new Date(visibleEvents[i].start).getMonth() &&
          dateTimeStamp.getFullYear() === new Date(visibleEvents[i].start).getFullYear())
      ) {
        return visibleEvents[i];
      }
    }
    return false;
  }

  generateBarColor = (calColor, isAllDay, attendees, organizer, owner) => {
    let color = calColor;
    if (attendees && attendees[0] && owner !== organizer) {
      // if owner and organizer is different, it is an invited event
      const ownerIndex = Object.keys(attendees).filter(key => attendees[key]['email'] === owner)
      color = attendees[ownerIndex] && attendees[ownerIndex]['partstat'] === 'NEEDS-ACTION' ? 'invite' : calColor;
    }
    if (isAllDay) {
      return color ? `event-bar-allday--${color}` : 'event-bar-allday--blue'
    } else {
      return color ? `event-bar--${color}` : 'event-bar--blue'
    }
  }
  // #region Render functionality
  renderCalendar = (props) => {
    const visibleEvents = props.visibleEvents;
    return (
      <DragAndDropCalendar
        selectable
        localizer={localizer}
        events={visibleEvents}
        views={{
          month: true,
          week: true,
          day: true
        }}
        onEventDrop={this.moveEventList}
        onEventResize={this.resizeEvent}
        onSelectSlot={this.addEvent}
        onSelectEvent={(event, target) => {
          target.persist()
          this.handleEventClick(event, target)
        }
        }
        onNavigate={date => this.setState({ dateSelected: date })}
        popup
        resizable
        eventPropGetter={event => ({
          className:
            this.generateBarColor(
              event.colorId,
              event.isAllDay,
              event.attendee,
              event.organizer,
              event.owner
            )
        })}
        // eventPropGetter={this.eventStyleGetter}
        components={{
          dateCellWrapper: dateClassStyleWrapper
        }}
      />
    );
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
          <h4 ref={(subtitle) => (this.subtitle = subtitle)}>{event.title}</h4>
          <p className="modal-date-text">
            {moment(event.start).format('MMMM D YYYY, h:mm a')} - {moment(event.end).format('MMMM D YYYY, h:mm a')}
          </p>
          {event.attendee && Object.keys(event.attendee).length > 1 ?
            <div>
              <p>{Object.keys(event.attendee).length} Guests</p>
              {Object.keys(event.attendee).map((key, index) =>
                event.owner === event.organizer
                  && event.attendee[key]['email'] === event.owner
                  ? null
                  : <p key={index}>{event.attendee[key]['email']}</p>
              )}
            </div> : null}
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

  //         {/* FOR DEBUGGING WITH ICALSTRING */ }
  // {/* <button type="button" onClick={() => this.setState({ isShowIcal: true })}>
  //         Show iCal String
  //       </button>
  //       <Modal isOpen={state.isShowIcal} onRequestClose={() => this.setState({ isShowIcal: false })}>
  //         <h3>{state.currentEvent.title}</h3>
  //         <br />
  //         <pre>{`${state.currentEvent.iCalString}`}</pre>
  //         <button type="button" onClick={() => this.setState({ isShowIcal: false })}>
  //           Done
  //         </button>
  //       </Modal> */}



  renderSignupLinks = (props, state) => {
    const providers = [];
    for (const providerType of Object.keys(props.expiredProviders)) {
      let providerFunc;
      switch (providerType) {
        case ProviderTypes.GOOGLE:
          providerFunc = () => this.authorizeGoogleCodeRequest();
          break;
        case ProviderTypes.OUTLOOK:
          providerFunc = () => this.authorizeOutLookCodeRequest();
          break;
        case ProviderTypes.EXCHANGE:
          // Exchange provider does not expire, I think, so here is empty.
          // If it does expire, write some code here to handle it.
          break;
        case ProviderTypes.CALDAV:
          // Yet to test which caldav providers expire, based on their own login system.
          // For now, we assume its BASIC auth, and no expiry.
          break;
        default:
          console.log('Provider not accounted for!!');
          break;
      }

      providers.push(
        <SignupSyncLink
          key={providerType}
          providerType={providerType}
          providerInfo={props.expiredProviders[providerType]}
          providerFunc={() => providerFunc()}
        />
      );
    }

    return state.isShowLoginForm ?
      (
        <Modal isOpen={state.isShowLoginForm} style={deleteModalStyles} onRequestClose={() => this.setState({ isShowLoginForm: false })}>
          <div>
            {/* <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.beginPollingEvents()}
        >
          <i className="material-icons left">close</i>Begin Poll Events
        </a>{' '}
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.endPollingEvents()}
        >
          <i className="material-icons left">close</i>End Poll Events
        </a>{' '}
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.beginPendingActions(props.providers)}
        >
          <i className="material-icons left">close</i>Begin Pending Actions
        </a>{' '}
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.endPendingActions()}
        >
          <i className="material-icons left">close</i>End Pending Actions
        </a>{' '} */}
            <form onSubmit={this.handleSubmit}>
              <input
                type="text"
                name="email"
                value={state.email}
                onChange={this.handleChange}
                placeholder="Email"
              />
              <input
                type="text"
                name="pwd"
                value={state.pwd}
                onChange={this.handleChange}
                placeholder="Password"
              />
              <label>
                <input
                  type="radio"
                  name="accountType"
                  value="ICLOUD"
                  onChange={this.handleChange}
                  defaultChecked
                />
                ICLOUD
              </label>
              {/* <label>
                <input type="radio" name="accountType" value="GOOGLE" onChange={this.handleChange} />
                  GOOGLE
              </label> */}
              <label>
                <input type="radio" name="accountType" value="YAHOO" onChange={this.handleChange} />
                  YAHOO
              </label>
              <label>
                <input type="radio" name="accountType" value="EWS" onChange={this.handleChange} />
                  EWS
              </label>
              <input type="submit" value="Submit" />
            </form>
            {/* this is for out of sync tokens. */}
            {/* {providers}
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => this.authorizeGoogleCodeRequest()}
        >
          <i className="material-icons left">cloud</i>Sign in with Google
        </a>
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => this.authorizeOutLookCodeRequest()}
        >
          <i className="material-icons left">cloud</i>Sign in with Outlook
        </a>
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          // onClick={() => this.props.beginGetGoogleEvents()}>

          // This is suppose to allow us to sync multiple user per single provider in the future!!
          // Currently, due to no UI, I am hardcoding it to a single instance. But once we get the
          // UI up and running for choosing which user events you want to get, this will be amazing
          // Note: This is the same for the following button, which pulls outlook events.

          // Okay, debate later, coz idk how to deal with it when the user signs in, to update this state here.
          onClick={() => props.beginGetGoogleEvents(props.providers.GOOGLE[0])}
        >
          <i className="material-icons left">cloud_download</i>Get Google Events
        </a>
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.beginGetOutlookEvents(props.providers.OUTLOOK[0])}
        >
          <i className="material-icons left">cloud_download</i>Get Outlook Events
        </a>
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.beginGetCaldavEvents(props.providers.CALDAV)}
        >
          <i className="material-icons left">cloud_download</i>Get Caldav Events
        </a>
        <a
          role="button"
          tabIndex="0"
          className="waves-effect waves-light btn"
          onClick={() => props.clearAllEvents()}
        >
          <i className="material-icons left">close</i>Clear all Events
        </a> */}
          </div>
        </Modal>

      ) : null;
  };

  render() {
    const { props } = this;
    const { state } = this;
    if (props.isAuth !== undefined) {
      return (
        <div className={'calendar'}>
          {/* <ModalTest
          height={200}
          width={200}
        >
          <div>
            <h1>HEY</h1>
          </div>
        </ModalTest> */}
          {this.renderSignupLinks(props, state)}
          {this.renderCalendar(props)}
          <div className={'side-calendar'}>
            <MiniCalendar
              calendarType="US"
              activeStartDate={this.state.dateSelected}
              next2Label={null}
              prev2Label={null}
              minDetail="month"
              maxDetail="month"
              onActiveStartDateChange={({ activeStartDate, value, view }) => this.setState({ dateSelected: activeStartDate })}
              formatShortWeekday={(locale, date) => [`S`, `M`, `T`, `W`, `T`, `F`, `S`][date.getDay()]}
              tileContent={({ date, view }) => this.renderDayContent(date, view)}
            />
            <FilterCalendar />
            <BigButton variant="small-blue" onClick={() => this.setState({ isShowLoginForm: true })}>Login</BigButton>
            <BigButton variant="small-blue" onClick={() => this.authorizeGoogleCodeRequest()}>Google Auth</BigButton>
            <BigButton variant="small-blue" onClick={() => this.authorizeExchangeCodeRequest()}>Exchange</BigButton>
          </div>
        </div>
      );
    }
    return <div>Logging in...</div>;
  }
  // #endregion
}
