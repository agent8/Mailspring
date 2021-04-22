import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  DELETE_SINGLE_EVENT,
  SYNC_CALENDAR_LISTS,
  SYNC_RECURRENCE_PATTERN,
  SYNC_CALENDAR_DATA,
  CALDAV_PROVIDER,
  GOOGLE_PROVIDER,
} from '../../constants';
import moment from 'moment';

// 1-pass solution to sync target data and subject data, time complexity = O(nlogn), sorting takes the longest
// sorting based on iCalUID + starttime, since it would always be unique
// source: http://www.mlsite.net/blog/?p=2250
export const syncIcalLocalData = (fetchedData, type) => {
  let subjectData = null;
  let sorter = null;
  switch (type) {
    case SYNC_CALENDAR_DATA:
      subjectData = CalendarPluginStore.getCalendarData(CALDAV_PROVIDER);
      sorter = findIcalstringSorter;
      break;
    case SYNC_CALENDAR_LISTS:
      subjectData = CalendarPluginStore.getCalendarLists(CALDAV_PROVIDER);
      sorter = findCalendarListSorter;
      break;
    case SYNC_RECURRENCE_PATTERN:
      subjectData = CalendarPluginStore.getRpLists(CALDAV_PROVIDER);
      sorter = findObjectSorter;
      break;
    default:
      throw 'err, no such type available to sync';
  }
  let sortedSubjectData =
    subjectData === []
      ? []
      : subjectData.sort((a, b) => {
          const sorterA = sorter(a);
          const sorterB = sorter(b);
          if (sorterA > sorterB) {
            return 1;
          } else if (sorterB > sorterA) {
            return -1;
          } else {
            return 0;
          }
        });
  let sortedTargetData = fetchedData.sort((a, b) => {
    const sorterA = sorter(a);
    const sorterB = sorter(b);
    if (sorterA > sorterB) {
      return 1;
    } else if (sorterB > sorterA) {
      return -1;
    } else {
      return 0;
    }
  });
  let subjectIdx = 0;
  let targetIdx = 0;
  let toBeInserted = [];
  let toBeDeleted = [];
  while (subjectIdx < sortedSubjectData.length || targetIdx < sortedTargetData.length) {
    if (targetIdx >= sortedTargetData.length) {
      toBeDeleted.push(subjectIdx);
      subjectIdx += 1;
    } else if (subjectIdx >= sortedSubjectData.length) {
      toBeInserted.push(targetIdx);
      targetIdx += 1;
    } else if (sorter(sortedSubjectData[subjectIdx]) < sorter(sortedTargetData[targetIdx])) {
      toBeDeleted.push(subjectIdx);
      subjectIdx += 1;
    } else if (sorter(sortedSubjectData[subjectIdx]) > sorter(sortedTargetData[targetIdx])) {
      toBeInserted.push(targetIdx);
      targetIdx += 1;
    } else {
      subjectIdx += 1;
      targetIdx += 1;
    }
  }
  let toAdd = null;
  switch (type) {
    case SYNC_CALENDAR_DATA:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteCalendarData(CALDAV_PROVIDER, sortedSubjectData[idx].id, DELETE_SINGLE_EVENT);
      });
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      Actions.addCalendarData(toAdd, CALDAV_PROVIDER);
      break;
    case SYNC_CALENDAR_LISTS:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteCalendarList(CALDAV_PROVIDER, sortedSubjectData[idx]);
      });
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      Actions.addCalendarList(toAdd, CALDAV_PROVIDER);
      console.log(toAdd);
      break;
    case SYNC_RECURRENCE_PATTERN:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteRpList(sortedSubjectData[idx].iCalUID);
      });
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      for (const elem of toAdd) {
        Actions.upsertRpList(elem);
      }
      break;
    default:
      throw 'err, no such type available to sync';
  }
};
export const findIcalstringSorter = obj => {
  return obj.iCALString;
};

export const findObjectSorter = obj => {
  // ensure all null values are changed to undefined for consistency
  Object.keys(obj).forEach(key => {
    obj[key] = obj[key] === null ? undefined : obj[key];
  });
  // sort the object keys to ensure consistency when comparing between object strings
  return JSON.stringify(obj, Object.keys(obj).sort());
};

export const findCalendarListSorter = obj => {
  // remove the 'checked' key-value pair for comparison as fetched calendar list will always be checked: true
  let toCompareObj = Object.assign({}, obj);
  delete toCompareObj.checked;

  Object.keys(toCompareObj).forEach(key => {
    toCompareObj[key] = toCompareObj[key] === null ? undefined : obj[key];
  });
  // sort the object keys to ensure consistency when comparing between object strings
  return JSON.stringify(toCompareObj, Object.keys(toCompareObj).sort());
};

export const syncGoogleLocalData = (fetchedData, type, selectedYear = null) => {
  console.log(fetchedData);
  let subjectData = null;
  let sorter = null;
  switch (type) {
    case SYNC_CALENDAR_DATA:
      console.log(fetchedData);
      subjectData = CalendarPluginStore.getCalendarData(GOOGLE_PROVIDER).filter(
        event =>
          event.start.dateTime <= moment.tz([selectedYear, 11, 31], 'GMT').unix() &&
          event.start.dateTime >= moment.tz([selectedYear, 0, 1], 'GMT').unix()
      );
      sorter = findObjectSorter;
      break;
    case SYNC_CALENDAR_LISTS:
      subjectData = CalendarPluginStore.getCalendarLists(GOOGLE_PROVIDER);
      sorter = findCalendarListSorter;
      break;
    default:
      throw 'err, no such type available to sync';
  }
  let sortedSubjectData =
    subjectData === []
      ? []
      : subjectData.sort((a, b) => {
          const sorterA = sorter(a);
          const sorterB = sorter(b);
          if (sorterA > sorterB) {
            return 1;
          } else if (sorterB > sorterA) {
            return -1;
          } else {
            return 0;
          }
        });
  let sortedTargetData = fetchedData.sort((a, b) => {
    const sorterA = sorter(a);
    const sorterB = sorter(b);
    if (sorterA > sorterB) {
      return 1;
    } else if (sorterB > sorterA) {
      return -1;
    } else {
      return 0;
    }
  });
  console.log('sorted target', sortedTargetData);
  console.log('sorted subject', sortedSubjectData);
  let subjectIdx = 0;
  let targetIdx = 0;
  let toBeInserted = [];
  let toBeDeleted = [];
  while (subjectIdx < sortedSubjectData.length || targetIdx < sortedTargetData.length) {
    if (targetIdx >= sortedTargetData.length) {
      toBeDeleted.push(subjectIdx);
      subjectIdx += 1;
    } else if (subjectIdx >= sortedSubjectData.length) {
      toBeInserted.push(targetIdx);
      targetIdx += 1;
    } else if (sorter(sortedSubjectData[subjectIdx]) < sorter(sortedTargetData[targetIdx])) {
      toBeDeleted.push(subjectIdx);
      subjectIdx += 1;
    } else if (sorter(sortedSubjectData[subjectIdx]) > sorter(sortedTargetData[targetIdx])) {
      toBeInserted.push(targetIdx);
      targetIdx += 1;
    } else {
      subjectIdx += 1;
      targetIdx += 1;
    }
  }
  let toAdd = null;
  switch (type) {
    case SYNC_CALENDAR_DATA:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteCalendarData(GOOGLE_PROVIDER, sortedSubjectData[idx].id, DELETE_SINGLE_EVENT);
      });
      console.log('todelete', toBeDeleted);
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      console.log('toadd', toAdd);
      Actions.addCalendarData(toAdd, GOOGLE_PROVIDER);
      break;
    case SYNC_CALENDAR_LISTS:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteCalendarList(GOOGLE_PROVIDER, sortedSubjectData[idx]);
      });
      console.log('todelete', toBeDeleted);
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      Actions.addCalendarList(toAdd, GOOGLE_PROVIDER);
      console.log('toadd', toAdd);
      break;
    default:
      throw 'err, no such type available to sync';
  }
};
