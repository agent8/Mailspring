import { RetinaImg } from 'mailspring-component-kit';
import _ from 'underscore';
const {
  Actions,
  React,
  PropTypes,
  DateUtils,
  Message,
  CalendarStore,
  AttachmentStore,
} = require('mailspring-exports');
import { remote, clipboard } from 'electron';
const moment = require('moment-timezone');

class EventHeader extends React.Component {
  static displayName = 'EventHeader';

  static propTypes = { message: PropTypes.instanceOf(Message).isRequired };

  constructor(props) {
    super(props);
    this.state = {
      event: this.props.calendar ? this.props.calendar.getFirstEvent() : null,
      expandParticipant: false,
      expandParticipantNumber: 0,
    };
    this._mounted = false;
  }

  _onChange() {
    if (!this.state.event) {
      return;
    }
    this.setState({ event: this.props.calendar ? this.props.calendar.getFirstEvent() : null });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({ event: nextProps.calendar ? nextProps.calendar.getFirstEvent() : null });
    // this._onChange();
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    if (!prevState.event && this.state.event) {
      this.setState({ expandParticipantNumber: this._calculateShownParticipantNumber() });
    }
  }
  componentDidMount() {
    this._mounted = true;
    this.setState({ expandParticipantNumber: this._calculateShownParticipantNumber() });
    window.addEventListener('resize', this._onWindowResize);
  }
  _onWindowResize = () => {
    if (!this._mounted) {
      return;
    }
    this.setState({ expandParticipantNumber: this._calculateShownParticipantNumber() });
  };

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
    window.removeEventListener('resize', this._onWindowResize);
  }
  renderWhen() {
    const recurrence = Object.keys(this.state.event.getRecurrenceTypes());
    const repeat = recurrence.length > 0 ? ', Repeating event' : '';
    let duration = '';
    if (this.state.event.isAllDay()) {
      duration = 'All Day, ';
    } else if (this.state.event.isAllWeek()) {
      duration = 'All Week, ';
    }
    let eventStartDate;
    try {
      eventStartDate = this.state.event.startDate.toJSDate();
    } catch (e) {
      AppEnv.reportError(e);
      return 'Unknown';
    }
    let eventEndDate;
    try {
      eventEndDate = this.state.event.endDate.toJSDate();
    } catch (e) {
      AppEnv.reportError(e);
      return 'Unknown';
    }
    const startDate = moment(eventStartDate)
      .tz(DateUtils.timeZone)
      .format('dddd, MMMM Do');
    let startTime = '';
    let end = '';
    if (duration.length === 0) {
      startTime =
        ', ' +
        moment(eventStartDate)
          .tz(DateUtils.timeZone)
          .format(DateUtils.getTimeFormat({ timeZone: false }));
      if (this.state.event.isLessThanADay()) {
        end =
          ' - ' +
          moment(eventEndDate)
            .tz(DateUtils.timeZone)
            .format(DateUtils.getTimeFormat({ timeZone: true }));
      } else {
        end =
          ' - ' +
          moment(eventEndDate)
            .tz(DateUtils.timeZone)
            .format('dddd, MMMM Do') +
          ' ' +
          moment(eventEndDate)
            .tz(DateUtils.timeZone)
            .format(DateUtils.getTimeFormat({ timeZone: true }));
      }
    }
    return `${duration} ${startDate}${startTime} ${end}${repeat}`;
  }

  _onContextMenu = mouseEvent => {
    const selectionText = window.getSelection().toString();
    const menuItems = [{ label: 'Copy', click: () => clipboard.writeText(selectionText) }];
    Actions.openContextMenu({ menuItems, mouseEvent });
  };

  render() {
    if (this.state.event != null) {
      const reactKey = `event${this.props.message ? this.props.message.id : 'noMessageId'}`;
      return (
        <div key={reactKey} className="event-wrapper">
          <div key={'header'} className="event-header">
            <span className="event-title" onContextMenu={this._onContextMenu}>
              {this.state.event.summary || 'Event'}
            </span>
            {/*<RetinaImg name={'feed-calendar.svg'} style={{ width: 20 }} isIcon mode={RetinaImg.Mode.ContentIsMask} />*/}
          </div>
          <div key={'body'} className="event-body">
            <div className="event-data">
              <div key={'time'} className="event-time">
                <span className="event-key-name">When</span>
                {this.renderWhen()}
              </div>
              {this._renderLocation()}
              {this._renderParticipants()}
            </div>
            {this._renderEventActions()}
          </div>
        </div>
      );
    } else {
      const reactKey = `noEvent${this.props.message ? this.props.message.id : 'noMessageId'}`;
      return <div key={reactKey} />;
    }
  }

  _renderEventActions() {
    if (!CalendarStore.needRSVPByMessage(this.props.message)) {
      return null;
    }

    const actions = [
      { status: 1, label: 'Yes', css: 'yes' },
      { status: 3, label: 'Maybe', css: 'maybe' },
      { status: 2, label: 'No', css: 'no' },
    ];

    return (
      <div key={'actions'} className="event-actions">
        <div>
          {actions.map(item => {
            const { status, label, css } = item;
            let classes = 'btn btn-rsvp ';
            if (this.props.message.calendarStatus() === status) {
              classes += css;
            }
            return (
              <div
                key={status}
                className={classes}
                onClick={_.throttle(this._rsvp.bind(this, this.props.message, status), 200, {
                  trailing: false,
                })}
              >
                {label}
              </div>
            );
          })}
        </div>
        {/*<div className="open-external" onClick={this._openCalenderExternally}>more details</div>*/}
      </div>
    );
  }
  _renderParticipants = () => {
    if (!this.state.event) {
      return null;
    }
    const humanAttendees = this.state.event.filterAttendeesBy({
      criteria: 'type',
      values: ['INDIVIDUAL', 'GROUP'],
    });
    let organizerStr;
    if (this.state.event.organizer) {
      organizerStr = (
        <div className="participant-name">
          {this.state.event.organizer.name} <span className="organizer-label">(organizer)</span>,
        </div>
      );
    } else {
      organizerStr = null;
    }
    let participantsStr = humanAttendees.map(this._renderParticipant);
    participantsStr.unshift(organizerStr);
    participantsStr = participantsStr.filter(i => !!i);
    let expandStr = '';
    let expandClass = '';
    if (this.state.expandParticipantNumber > 0 && !this.state.expandParticipant) {
      expandStr = `+${this.state.expandParticipantNumber} more`;
    } else if (this.state.expandParticipantNumber > 0 && this.state.expandParticipant) {
      expandStr = 'less';
      expandClass = 'expand';
    }
    let expandElement = null;
    if (this.state.expandParticipantNumber > 0) {
      expandElement = (
        <div className="expand-element" onClick={this._toggleExpandNames}>
          {expandStr}
        </div>
      );
    }
    if (humanAttendees.length > 0) {
      return (
        <div key={'participants'} className="event-participants">
          <span className="event-key-name">{humanAttendees.length} Guests</span>
          <div className={`participant-names ${expandClass}`} ref={ref => (this._partNames = ref)}>
            {participantsStr}
          </div>
          {expandElement}
        </div>
      );
    }
  };
  _calculateShownParticipantNumber() {
    if (!this._partNames) {
      return 0;
    }
    const namesElements = this._partNames.children;
    if (namesElements.length === 0) {
      return 0;
    }
    const total = namesElements.length;
    let shown = 0;
    const top = namesElements[0].getBoundingClientRect().y;
    for (let el of namesElements) {
      if (top !== el.getBoundingClientRect().y) {
        break;
      }
      shown++;
    }
    return `${total - shown}`;
  }
  _toggleExpandNames = () => {
    this.setState({ expandParticipant: !this.state.expandParticipant });
  };
  _renderParticipant = (participant, index, all) => {
    if (!participant || participant.role === 'CHAIR') {
      return null;
    }
    if (this.state.event.organizer) {
      if (
        participant.name === this.state.event.organizer.name ||
        participant.email === this.state.event.organizer.name
      ) {
        return null;
      }
    }
    const reactKey = `${index}:${participant.name || participant.email}`;
    if (index < all.length - 1) {
      return (
        <div key={reactKey} className="participant-name">
          {participant.name || participant.email},{' '}
        </div>
      );
    } else {
      return (
        <div key={reactKey} className="participant-name">
          {participant.name || participant.email}
        </div>
      );
    }
  };

  _renderLocation = () => {
    let locationString = 'Unknown';
    if (this.state.event.location) {
      locationString = this.state.event.location;
    }
    return (
      <div key={'location'} className="event-location" onContextMenu={this._onContextMenu}>
        <span className="event-key-name">Location</span>
        <div className="location-text">{locationString}</div>
        {this.state.event.location && (
          <div className="open-external" onClick={this._openMapExternally}>
            <RetinaImg
              name={'map-preview.png'}
              mode={RetinaImg.Mode.ContentPreserve}
              style={{ width: 40, height: 40 }}
            />
          </div>
        )}
      </div>
    );
  };

  _openMapExternally = _.throttle(() => {
    const searchQueryBase = 'https://www.openstreetmap.org/search?commit=Go&query=';
    const searchQuery = `${searchQueryBase}${encodeURI(this.state.event.location)}`;
    remote.shell.openExternal(searchQuery);
  }, 500);

  _openCalenderExternally = _.throttle(() => {
    const file = this.props.message.files.find(file => {
      return CalendarStore.isFileCalendarType(file);
    });
    if (file) {
      const filePath = AttachmentStore.pathForFile(file);
      if (filePath) {
        remote.shell.openPath(filePath);
      }
    }
  }, 500);

  _rsvp = (message, status) => {
    if (this.props.message.calendarStatus() !== status) {
      Actions.RSVPEvent(message, status);
    }
  };
}

module.exports = EventHeader;
