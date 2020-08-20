export const UPDATE_FILTER = 'UPDATE_FILTER';
export const CHANGE_CALENDAR_COLOR = 'CHANGE_CALENDAR_COLOR';

// Called by FilterEvent to update any changes made to filters by the user to the redux store
export const updateFilter = (filterMap) => ({
  type: UPDATE_FILTER,
  payload: filterMap
});

export const changeColor = (calendar) => ({
  type: CHANGE_CALENDAR_COLOR,
  payload: calendar
})
