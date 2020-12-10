import md5 from 'md5';
import uuidv4 from 'uuid';
import * as dav from 'dav'; // caldav library
import * as ProviderTypes from '../constants';
import ServerUrls from '../serverUrls';
import * as PARSER from '../parser';
import * as dbRpActions from '../../sequelizeDB/operations/recurrencepatterns';
import * as caldavBasics from './caldavbasics';
import * as dbCalendarActions from '../../sequelizeDB/operations/calendars';

const fs = require('fs');

const getCalDavTypeFromURL = (url) => {
  switch (url) {
    case ServerUrls.ICLOUD:
      return ProviderTypes.ICLOUD;
    case ServerUrls.FASTMAIL:
      return ProviderTypes.FASTMAIL;
    case ServerUrls.YAHOO:
      return ProviderTypes.YAHOO;
    default:
      return ProviderTypes.CALDAV;
  }
};

export const filterCaldavUser = (jsonObj, principalUrl, homeUrl, url, calendars) => ({
  personId: uuidv4(),
  originalId: md5(jsonObj.username),
  email: jsonObj.username,
  providerType: ProviderTypes.CALDAV,
  password: jsonObj.password,
  principalUrl,
  homeUrl,
  calendars: calendars.length > 0 ? calendars : [],
  caldavType: getCalDavTypeFromURL(url)
});

export const asyncGetAllCalDavEvents = async (username, password, url, caldavType) => {
  const debug = false;
  const resp = await caldavBasics.getCaldavAccount(username, password, url, caldavType);

  // This breaks due to how our database works, with id being a uniqid.
  // so we need find it first then upsert. Yay, no checks again.
  try {
    const calendars = PARSER.parseCal(resp.calendars);

    for (let i = 0; i < calendars.length; i++) {
      const calDb = await dbCalendarActions.retrieveCalendarByCalendarUrl(calendars[i].url);
      calendars[i].color = 'blue'
      if (calDb !== null) {
        calendars[i].color = calDb.color
      }
    }
    const events = PARSER.parseCalEvents(resp.calendars, calendars)
    const flatEvents = events.reduce((acc, val) => acc.concat(val), []);
    const filteredEvents = flatEvents.filter((event) => event !== '');
    const flatFilteredEvents = filteredEvents.reduce((acc, val) => acc.concat(val), []);
    // const eventPersons = PARSER.parseEventPersons(flatFilteredEvents);
    const recurrencePattern = PARSER.parseRecurrenceEvents(flatFilteredEvents);

    // debugger;
    // const a = new Map();
    // flatEvents.forEach((data) => {
    //   let tempData = a.get(data.eventData.originalId);
    //   if (tempData === null || tempData === undefined) {
    //     tempData = { events: [] };
    //   }

    //   tempData.events.push(data.eventData);
    //   if (data.recurData) {
    //     tempData.rp = data.recurData;
    //   }
    //   a.set(data.eventData.originalId, tempData);
    // });
    // const temp = Array.from(a.values()).filter((obj) => obj.events[0].isRecurring);
    // for (let i = 0; i < temp.length; i += 1) {
    //   const masterEvent = temp[i].events.filter((e) => e.isMaster)[0];
    //   const fileName = masterEvent.summary
    //     .replace(/\(.*?\)/, '')
    //     .trim()
    //     .replace(/\//g, ',');

    //   fs.writeFileSync(
    //     'testinput/' + fileName + '.json',
    //     JSON.stringify(temp[i], null, '\t'),
    //     (err) => {
    //       console.log(err);
    //     }
    //   );
    // }

    const promises = [];
    const prevRPs = await Promise.all(
      recurrencePattern.map((recurrenceEvent) =>
        dbRpActions.getOneRpByOId(recurrenceEvent.originalId)
      )
    );

    let i = 0;
    prevRPs.forEach((prevRP) => {
      const newRP = recurrencePattern[i];

      if (prevRP === null) {
        promises.push(dbRpActions.insertOrUpdateRp(newRP));
      } else {
        promises.push(
          dbRpActions.updateRpByOid(prevRP.originalId, {
            id: prevRP.id,
            originalId: newRP.originalId,
            freq: newRP.freq,
            interval: newRP.interval,
            until: newRP.until,
            exDates: newRP.exDates,
            recurrenceIds: newRP.recurrenceIds,
            modifiedThenDeleted: newRP.modifiedThenDeleted,
            numberOfRepeats: newRP.numberOfRepeats,
            isCount: newRP.isCount,
            iCalUID: prevRP.iCalUID,
            wkSt: newRP.wkSt,
            byMonth: newRP.byMonth,
            byMonthDay: newRP.byMonthDay,
            byYearDay: newRP.byYearDay,
            byWeekNo: newRP.byWeekNo,
            byWeekDay: newRP.byWeekDay,
            weeklyPattern: newRP.weeklyPattern,
            bySetPos: newRP.bySetPos,
            byHour: newRP.byHour,
            byMinute: newRP.byMinute,
            bySecond: newRP.bySecond,
            byEaster: newRP.byEaster,
            allDay: newRP.allDay
          })
        );
      }
      i += 1;
    });

    const results = await Promise.all(promises);
    const expanded = await PARSER.expandRecurEvents(
      flatFilteredEvents.map((calEvent) => calEvent.eventData)
    );
    const finalResult = [
      ...expanded.filter((e) => e.isRecurring === true),
      ...flatFilteredEvents
        .filter((e) => e.recurData === undefined || e.recurData === null)
        .map((e) => e.eventData)
    ];
    finalResult.forEach((e) => {
      e.owner = username;
      e.caldavType = caldavType;
    });
    if (debug) {
      console.log(finalResult);
      // debugger;
    }
    return finalResult;
  } catch (e) {
    throw e;
  }
};
