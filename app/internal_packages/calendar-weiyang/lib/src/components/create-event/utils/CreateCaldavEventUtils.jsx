import uuidv4 from 'uuid';
import ICAL from 'ical.js';
import { CALDAV_PROVIDER } from '../../constants';
import * as IcalStringBuilder from '../../common-utils/icalStringBuilder';
const dav = require('dav');

export const createCaldavEvent = async payload => {
  const debug = false;

  // Parse user information from account layer to dav object.
  const xhrObject = new dav.transport.Basic(
    new dav.Credentials({
      username: payload.auth.username,
      password: payload.auth.password,
    })
  );

  // Final iCalString to post out
  let newiCalString = '';

  // Caldav calendar link
  const caldavUrl = payload.calendar.url;

  const newETag = uuidv4();
  const { data } = payload;

  // Builds additional fields that are missing specifically for caldav.
  data.id = uuidv4();
  data.originalId = uuidv4();

  // Repopulate certain fields that are missing
  data.caldavUrl = caldavUrl;
  data.iCalUID = data.originalId;
  data.providerType = CALDAV_PROVIDER;
  data.caldavType = payload.auth.caldavType;

  if (payload.data.isRecurring) {
    // eslint-disable-next-line no-underscore-dangle
    const jsonRecurr = ICAL.Recur._stringToData(data.rrule);
    // debugger;

    if (jsonRecurr.until !== undefined) {
      jsonRecurr.until.adjust(1, 0, 0, 0, 0);
    }
    const { freq } = jsonRecurr;
    if (freq === 'MONTHLY') {
      // If there is a setpos, I need ot merge them up into one param
      // RRule gen splits them into bysetpos and byday, but server takes in byday
      // E.g. bysetpos = 1, byday = TU, merge to byday = 1TU
      // If there is no setpos, it means it is a by month day event
      if (jsonRecurr.BYSETPOS !== undefined) {
        jsonRecurr.BYDAY = jsonRecurr.BYSETPOS + jsonRecurr.BYDAY;
        delete jsonRecurr.BYSETPOS;
      } else if (Array.isArray(jsonRecurr.BYDAY)) {
        jsonRecurr.BYDAY = jsonRecurr.BYDAY.join(',');
      }
    }
    // Creates Recurring event.
    newiCalString = IcalStringBuilder.buildICALStringCreateRecurEvent(payload.data, jsonRecurr);
    console.log('newicalstring', newiCalString);
  } else {
    data.isRecurring = false;
    // Creates non Recurring event.
    newiCalString = IcalStringBuilder.buildICALStringCreateEvent(payload.data);
  }
  data.iCALString = newiCalString;

  const calendar = new dav.Calendar();
  calendar.url = caldavUrl;

  const addCalendarObject = {
    data: newiCalString,
    filename: `${newETag}.ics`,
    xhr: xhrObject,
  };

  const addResult = await dav.createCalendarObject(calendar, addCalendarObject);

  if (debug) {
    console.log('(postEventsCalDav)', addResult);
  }
};
