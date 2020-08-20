import { UPDATE_FILTER, CHANGE_CALENDAR_COLOR } from '../actions/filter';
import * as dbCalendarActions from '../sequelizeDB/operations/calendars';
import * as dbEventActions from '../sequelizeDB/operations/events';

const initialState = {
  filterMap: {}
};

export default function filterReducer(state = initialState, action) {
  switch (action.type) {
    case UPDATE_FILTER: {
      /*
        action = {
          type: 'UPDATE_FILTER',
          payload: filterMap
        }
      */

      return {
        ...state,
        filterMap: action.payload
      };
    }

    case CHANGE_CALENDAR_COLOR: {
      dbCalendarActions.updateCalendar(action.payload);
    }

    default:
      return state;
  }
}
