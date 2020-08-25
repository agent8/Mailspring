import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { postEventBegin } from '../actions/events';
// import AddEvent from '../components/addForm';
// Please rename the newAddEvent to addForm and delete the existing addForm.
// Developement of new addForm UI was done in new file for easy comparison with previous iteration/rollbacks if necessary
import AddEvent from '../components/addEvent/newAddEvent';
import getFilteredEvents from '../selectors/ui-selector';

const styles = (theme) => ({
  container: {
    display: 'flex',
    flexWrap: 'wrap'
  },
  textField: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    width: 300
  },
  margin: {
    margin: theme.spacing.unit
  },
  cssFocused: {}
});

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
  postEventBegin: (event, auth, type, calendar) =>
    dispatch(postEventBegin(event, auth, type, calendar))
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(AddEvent));
