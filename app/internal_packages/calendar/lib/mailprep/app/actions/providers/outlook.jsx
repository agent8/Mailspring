// ---------------------- OUTLOOK ---------------------- //
export const GET_OUTLOOK_EVENTS_BEGIN = 'GET_OUTLOOK_EVENTS_BEGIN';
export const GET_OUTLOOK_EVENTS_SUCCESS = 'GET_OUTLOOK_EVENTS_SUCCESS';
export const GET_OUTLOOK_EVENTS_FAILURE = 'GET_OUTLOOK_EVENTS_FAILURE';

export const beginGetOutlookEvents = (resp) => ({
  type: GET_OUTLOOK_EVENTS_BEGIN,
  payload: resp
});

export const postOutlookEventBegin = (calEvent) => ({
  type: GET_OUTLOOK_EVENTS_BEGIN,
  payload: calEvent
});

export const getOutlookEventsSuccess = (response) => ({
  type: GET_OUTLOOK_EVENTS_SUCCESS,
  payload: {
    data: response
  }
});
// ---------------------- OUTLOOK ---------------------- //
