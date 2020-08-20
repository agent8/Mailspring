import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import {
  beginEditEvent,
  beginEditRecurrenceSeries,
  beginEditFutureRecurrenceSeries,
  beginDeleteEvent,
  postEventBegin
} from '../actions/events';
import {
  editCalDavSingleEventBegin,
  editCalDavAllEventBegin,
  editCalDavFutureEventBegin
} from '../actions/providers/caldav';
import {
  editEwsSingleEventBegin,
  editEwsFutureEventBegin,
  editEwsAllEventBegin
} from '../actions/providers/exchange';
import EditEvent from '../components/editEvent';
import getFilteredEvents from '../selectors/ui-selector';
import { v4 as uuid } from 'uuid';

const mapStateToProps = (state) => {
  const calendarsList = [
    ...state.auth.providers.CALDAV.map((account) => ({
      uuid: uuid(),
      email: account.email,
      type: 'CALDAV',
      caldavType: account.caldavType,
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) =>
        // depending on whether it is brand new login (very first time) vs retrieved from local db, calendar data structure is different so need to account for it.
        // added uuid prop to calendar for an object key name that is valid for any provider type for purpose to binding selected calendars to state
        // cal.dataValues for retrieved from local db, cal for first logins. cal is untested as UI dev removed login functionalities
        cal.dataValues ? { ...cal.dataValues, uuid: uuid() } : { ...cal, uuid: uuid() }
      )
    })),
    ...state.auth.providers.EXCHANGE.map((account) => ({
      email: account.email,
      type: 'EXCHANGE',
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) =>
        cal.dataValues ? { ...cal.dataValues, uuid: uuid() } : { ...cal, uuid: uuid() }
      )
    })),
    ...state.auth.providers.GOOGLE.map((account) => ({
      email: account.email,
      type: 'GOOGLE',
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) =>
        cal.dataValues ? { ...cal.dataValues, uuid: uuid() } : { ...cal, uuid: uuid() }
      )
    })),
    ...state.auth.providers.OUTLOOK.map((account) => ({
      email: account.email,
      type: 'OUTLOOK',
      provider: JSON.stringify(account),
      calendars: account.calendars.map((cal) =>
        cal.dataValues ? { ...cal.dataValues, uuid: uuid() } : { ...cal, uuid: uuid() }
      )
    }))
  ];
  const filterMap = state.filter.filterMap;
  const events = getFilteredEvents(state);
  const visibleEvents = events.filter((event) => filterMap[event.calendarId]);
  return {
    events: state.events,
    visibleEvents,
    providers: state.auth.providers,
    calendarsList
  };
};

const mapDispatchToProps = (dispatch) => ({
  // editEventBegin: (id, eventObject, providerType) =>
  //   dispatch(editEventBegin(id, eventObject, providerType)), // This handles google only, parse it into generic.

  editEwsSingleEventBegin: (event) => dispatch(editEwsSingleEventBegin(event)),
  editEwsAllEventBegin: (event) => dispatch(editEwsAllEventBegin(event)),
  editEwsFutureEventBegin: (event) => dispatch(editEwsFutureEventBegin(event)),

  editCalDavSingleEventBegin: (event) => dispatch(editCalDavSingleEventBegin(event)),
  editCalDavAllEventBegin: (event) => dispatch(editCalDavAllEventBegin(event)),
  editCalDavFutureEventBegin: (event) => dispatch(editCalDavFutureEventBegin(event)),

  // CRUD - Delete Operations
  beginEditEvent: (payload) => dispatch(beginEditEvent(payload)),
  beginDeleteEvent: (id) => dispatch(beginDeleteEvent(id)),
  postEventBegin: (event, auth, type) => dispatch(postEventBegin(event, auth, type)),
  beginEditRecurrenceSeries: (payload) => dispatch(beginEditRecurrenceSeries(payload)),
  beginEditFutureRecurrenceSeries: (payload) => dispatch(beginEditFutureRecurrenceSeries(payload))
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(EditEvent));
