import { createSelector } from 'reselect';
import moment from 'moment';

const getEvents = (state) => state.events.calEvents;

// Process events data for React Big calendar
const getFilteredEvents = createSelector([getEvents], (normalizedData) => {
  const data = Object.values(normalizedData);
  const flatData = data.reduce((acc, val) => acc.concat(val), []);
  const formatedEvents = flatData
    .filter((eachEvent) => !eachEvent.hide)
    .map((eachEvent) => {
      return ({
        id: eachEvent.id,
        title: eachEvent.summary,
        // The format here is crucial, it converts the unix time, which is in gmt,
        // To the machine timezone, therefore, displaying it accordingly.
        // moment.unix() because time is stored in seconds, not miliseconds.
        end: new Date(moment.unix(eachEvent.end.dateTime).format()),
        start: new Date(moment.unix(eachEvent.start.dateTime).format()),
        colorId: eachEvent.colorId,
        originalId: eachEvent.originalId,
        iCalUID: eachEvent.iCalUID,
        isRecurring: eachEvent.isRecurring,
        providerType: eachEvent.providerType,
        caldavType: eachEvent.caldavType,
        calendarId: eachEvent.calendarId,
        iCalString: eachEvent.iCALString,
        isAllDay: eachEvent.isAllDay,
        attendee: eachEvent.attendee ? JSON.parse(eachEvent.attendee) : undefined,
        organizer: eachEvent.organizer,
        owner: eachEvent.owner,
        isMaster: eachEvent.isMaster
      })
    });

  return formatedEvents;
});

export default getFilteredEvents;
