import {
  UPDATE_STORED_EVENTS,
  SUCCESS_STORED_EVENTS,
  RETRIEVE_STORED_EVENTS,
  UPDATE_EVENT_COLOR,
  DUPLICATE_ACTION,
  SYNC_STORED_EVENTS
} from '../actions/db/events';

import * as dbEventActions from '../sequelizeDB/operations/events'

const initialState = {
  calEvents: []
};

const mergeEvents = (oldEvents, newEvents, user) => {
  const nonUserEvents = oldEvents.filter(
    (e) =>
      e.providerType !== user.providerType &&
      e.owner !== user.email &&
      e.caldavType !== user.caldavType
  );

  const newPayload = [...nonUserEvents, ...newEvents];
  const newItemsId = newEvents.map((object) => object.id);
  const oldItemsId = oldEvents.map((object) => object.id);
  return newPayload;
};

const storeEvents = (oldEvents, payload) => {
  const nonUserEvents = [];
  const userEvents = new Map();

  const newEvents = payload.resp;
  const { tempEvents } = payload;
  const { users } = payload;

  users.forEach((user) => {
    nonUserEvents.push(
      ...oldEvents.filter(
        (e) =>
          e.providerType !== user.providerType &&
          e.owner !== user.email &&
          e.caldavType !== user.caldavType
      )
    );

    if (user.providerType === 'CALDAV') {
      userEvents.set(
        user,
        oldEvents.filter(
          (e) =>
            e.providerType === user.providerType &&
            e.owner === user.email &&
            e.caldavType === user.caldavType
        )
      );
    } else if (user.providerType === 'EXCHANGE') {
      userEvents.set(
        user,
        oldEvents.filter((e) => e.providerType === user.providerType && e.owner === user.email)
      );
    }
  });

  // As newEvents might have some or none, we need to think if we should append or delete it.
  const newPayload = [...nonUserEvents];
  const newEventsId = newEvents.map((object) => object.id);
  const oldEventsId = oldEvents.map((object) => object.id);
  const tempEventsId = tempEvents.map((object) => object.id);

  newEvents.forEach((e) => {
    newPayload.push(e);
  });

  userEvents.forEach((v, k) => {
    const oldUserEventsId = v.map((object) => object.id);
    // if there is an old user event that is
    // 1. not in the new events and in the old events, it is an added event
    // 2. in the new events but not in the old events, it is a deleted event
    //  it is an old event
    oldUserEventsId.forEach((id) => {
      if (!newEventsId.includes(id) && oldUserEventsId.includes(id) && !tempEventsId.includes(id)) {
        newPayload.push(v.filter((e) => e.id === id)[0]);
      }
    });
  });

  return newPayload;
};

const syncEvents = (oldEvents, newEvents) => {
  const newPayload = [...oldEvents];
  for (const newEvent of newEvents) {
    const pos = newPayload.map((object) => object.id).indexOf(newEvent.event.id);
    switch (newEvent.type) {
      case 'create':
        newPayload.push(newEvent.event);
        break;
      case 'delete':
        newPayload.splice(pos, 1);
        break;
      case 'update':
        newPayload[pos] = newEvent.event;
        break;
      default:
        break;
    }
  }
  return newPayload;
};

export default function eventsReducer(state = initialState, action) {
  if (action === undefined) {
    return state;
  }
  switch (action.type) {
    case RETRIEVE_STORED_EVENTS: {
      return Object.assign({}, state, { providerType: action.payload.user.providerType });
    }
    case UPDATE_STORED_EVENTS: {
      const allEvents = mergeEvents(state.calEvents, action.payload.resp, action.payload.user);
      return Object.assign({}, state, { calEvents: allEvents });
    }
    case SUCCESS_STORED_EVENTS: {
      const newEvents = storeEvents(state.calEvents, action.payload);
      return Object.assign({}, state, { calEvents: newEvents });
    }
    case UPDATE_EVENT_COLOR: {
      dbEventActions.updateEventColorByCalendarId(action.payload.calendar.calendarUrl, action.payload.calendar.color);
      const allEvents = [...state.calEvents];
      for (let i = 0; i < allEvents.length; i++) {
        if (allEvents[i]['calendarId'] === action.payload.calendar.calendarUrl) {
          allEvents[i]['colorId'] = action.payload.calendar.color;
        }
      }
      return Object.assign({}, state, { calEvents: allEvents });
    }

    // Sync stored events currently is not working.
    // It is currently syncing for one user only.
    // I need it to sync for every user that is valid.
    case SYNC_STORED_EVENTS: {
      const newEvents = syncEvents(state.calEvents, action.payload);
      return Object.assign({}, state, { calEvents: newEvents });
    }
    case DUPLICATE_ACTION:
      return state;
    default:
      return state;
  }
}
