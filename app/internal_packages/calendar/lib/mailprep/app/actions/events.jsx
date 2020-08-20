// #region Get Events
export const GET_EVENTS_BEGIN = 'GET_EVENTS_BEGIN';
export const GET_EVENTS_SUCCESS = 'GET_EVENTS_SUCCESS';
export const GET_EVENTS_FAILURE = 'GET_EVENTS_FAILURE';
// #endregion

// #region Create Events
export const POST_EVENT_BEGIN = 'POST_EVENT_BEGIN';
export const POST_EVENT_SUCCESS = 'POST_EVENT_SUCCESS';
export const POST_EVENT_FAILURE = 'POST_EVENT_FAILURE';
// #endregion

// #region Edit Events
export const EDIT_EVENT_BEGIN = 'EDIT_EVENT_BEGIN';
export const EDIT_EVENT_SUCCESS = 'EDIT_EVENT_SUCCESS';
export const EDIT_EVENT_FAILURE = 'EDIT_EVENT_FAILURE';

export const EDIT_RECURRENCE_SERIES_BEGIN = 'EDIT_RECURRENCE_SERIES_BEGIN';
export const EDIT_RECURRENCE_SERIES_SUCCESS = 'EDIT_RECURRENCE_SERIES_SUCCESS';
export const EDIT_RECURRENCE_SERIES_FAILURE = 'EDIT_RECURRENCE_SERIES_FAILURE';

export const EDIT_FUTURE_RECURRENCE_SERIES_BEGIN = 'EDIT_FUTURE_RECURRENCE_SERIES_BEGIN';
export const EDIT_FUTURE_RECURRENCE_SERIES_SUCCESS = 'EDIT_FUTURE_RECURRENCE_SERIES_SUCCESS';
export const EDIT_FUTURE_RECURRENCE_SERIES_FAILURE = 'EDIT_FUTURE_RECURRENCE_SERIES_FAILURE';
// #endregion

// #region Delete Events
export const DELETE_EVENT_BEGIN = 'DELETE_EVENT_BEGIN';
export const DELETE_EVENT_SUCCESS = 'DELETE_EVENT_SUCCESS';
export const DELETE_EVENT_FAILURE = 'DELETE_EVENT_FAILURE';

export const DELETE_RECURRENCE_SERIES_BEGIN = 'DELETE_RECURRENCE_SERIES_BEGIN';
export const DELETE_RECURRENCE_SERIES_SUCCESS = 'DELETE_RECURRENCE_SERIES_SUCCESS';
export const DELETE_RECURRENCE_SERIES_FAILURE = 'DELETE_RECURRENCE_SERIES_FAILURE';

export const DELETE_FUTURE_RECURRENCE_SERIES_BEGIN = 'DELETE_FUTURE_RECURRENCE_SERIES_BEGIN';
export const DELETE_FUTURE_RECURRENCE_SERIES_SUCCESS = 'DELETE_FUTURE_RECURRENCE_SERIES_SUCCESS';
export const DELETE_FUTURE_RECURRENCE_SERIES_FAILURE = 'DELETE_FUTURE_RECURRENCE_SERIES_FAILURE';
// #endregion

// #region Sync and Pending Actions
export const BEGIN_POLLING_EVENTS = 'BEGIN_POLLING_EVENTS';
export const END_POLLING_EVENTS = 'END_POLLING_EVENTS';

export const BEGIN_PENDING_ACTIONS = 'BEGIN_PENDING_ACTIONS';
export const END_PENDING_ACTIONS = 'END_PENDING_ACTIONS';
// #endregion

// #region Error Handling
export const API_ERROR = 'API_ERROR';

export const apiFailure = (error) => ({
  type: API_ERROR,
  payload: {
    error
  }
});

// #endregion

// #region Google (Unused/Broken)
export const beginGetGoogleEvents = (resp) => ({
  type: GET_EVENTS_BEGIN,
  payload: resp
});
// #endregion

// #region Outlook (Unused/Broken)
export const deleteEventSuccess = (id, user) => ({
  type: DELETE_EVENT_SUCCESS,
  payload: { id, user }
});
// #endregion

//  #region Create Event
// auth = full account object of the account trying to post
// export const postEventBegin = (calEvent, auth, providerType) => ({
//   type: POST_EVENT_BEGIN,
//   payload: {
//     data: calEvent,
//     auth,
//     providerType
//   }
// });
export const postEventBegin = (calEvent, auth, providerType, calendar) => ({
  type: POST_EVENT_BEGIN,
  payload: {
    data: calEvent,
    auth,
    providerType,
    calendar
  }
});

export const postEventSuccess = (data, users, providerType, owner, tempEvents) => ({
  type: POST_EVENT_SUCCESS,
  payload: {
    data,
    users,
    providerType,
    owner,
    tempEvents
  }
});
// #endregion

// #region Get Event Results
export const getEventsFailure = (error) => ({
  type: GET_EVENTS_FAILURE,
  payload: {
    error
  }
});

export const getEventsSuccess = (response, providerType, users) => ({
  type: GET_EVENTS_SUCCESS,
  payload: {
    data: response,
    providerType,
    users,
    tempEvents: []
  }
});
// #endregion

// #region Edit Event
export const beginEditEvent = (payload) => ({
  type: EDIT_EVENT_BEGIN,
  payload
});

export const beginEditRecurrenceSeries = (payload) => ({
  type: EDIT_RECURRENCE_SERIES_BEGIN,
  payload
});

export const beginEditFutureRecurrenceSeries = (payload) => ({
  type: EDIT_FUTURE_RECURRENCE_SERIES_BEGIN,
  payload
});

export const editEventSuccess = (resp) => ({
  type: EDIT_EVENT_SUCCESS,
  payload: {
    resp
  }
});
// #endregion

// #region Delete Event
export const beginDeleteEvent = (id) => ({
  type: DELETE_EVENT_BEGIN,
  payload: id
});

export const beginDeleteRecurrenceSeries = (id) => ({
  type: DELETE_RECURRENCE_SERIES_BEGIN,
  payload: id
});

export const beginDeleteFutureRecurrenceSeries = (id) => ({
  type: DELETE_FUTURE_RECURRENCE_SERIES_BEGIN,
  payload: id
});
// #endregion

// #region General
export const CLEAR_ALL_EVENTS = 'CLEAR_ALL_EVENTS';
export const CLEAR_ALL_EVENTS_SUCCESS = 'CLEAR_ALL_EVENTS_SUCCESS';

export const clearAllEvents = () => ({
  type: CLEAR_ALL_EVENTS
});

export const clearAllEventsSuccess = () => ({
  type: CLEAR_ALL_EVENTS_SUCCESS
});
// #endregion

// #region Polling
export const beginPollingEvents = (users) => ({
  type: BEGIN_POLLING_EVENTS,
  users
});

export const endPollingEvents = (payload) => ({
  type: END_POLLING_EVENTS
});
// #endregion

// #region Pending Actions
export const beginPendingActions = (payload) => ({
  type: BEGIN_PENDING_ACTIONS,
  payload
});

export const endPendingActions = (payload) => ({
  type: END_PENDING_ACTIONS
});
// #endregion
