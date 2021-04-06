import { Actions, CalendarPluginStore } from 'mailspring-exports';
import {
  DELETE_SINGLE_EVENT,
  ICLOUD_ACCOUNT,
  SYNC_CALENDAR_LISTS,
  SYNC_RECURRENCE_PATTERN,
  SYNC_CALENDAR_DATA,
} from '../../constants';

// 1-pass solution to sync target data and subject data, time complexity = O(nlogn), sorting takes the longest
// sorting based on iCalUID + starttime, since it would always be unique
// source: http://www.mlsite.net/blog/?p=2250
export const syncLocalData = (fetchedData, type) => {
  let subjectData = null;
  let sorter = null;
  switch (type) {
    case SYNC_CALENDAR_DATA:
      subjectData = CalendarPluginStore.getCalendarData(ICLOUD_ACCOUNT);
      sorter = findCalendarDataSorter;
      break;
    case SYNC_CALENDAR_LISTS:
      subjectData = CalendarPluginStore.getCalendarLists(ICLOUD_ACCOUNT);
      sorter = findCalendarListSorter;
      break;
    case SYNC_RECURRENCE_PATTERN:
      subjectData = CalendarPluginStore.getRpLists(ICLOUD_ACCOUNT);
      sorter = findRpSorter;
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
  console.log('inserts', type, toBeInserted);
  console.log('deletes', type, toBeDeleted);
  let toAdd = null;
  switch (type) {
    case SYNC_CALENDAR_DATA:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteIcloudCalendarData(sortedSubjectData[idx].id, DELETE_SINGLE_EVENT);
      });
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      Actions.addIcloudCalendarData(toAdd);
      break;
    case SYNC_CALENDAR_LISTS:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteIcloudCalendarLists(sortedSubjectData[idx]);
      });
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      Actions.addIcloudCalendarLists(toAdd);
      console.log(toAdd);
      break;
    case SYNC_RECURRENCE_PATTERN:
      // delete stale events according to caldav server
      toBeDeleted.forEach(idx => {
        Actions.deleteIcloudRpLists(sortedSubjectData[idx].iCalUID);
      });
      // insert new events according to caldav server
      toAdd = toBeInserted.map(idx => sortedTargetData[idx]);
      for (const elem of toAdd) {
        Actions.upsertIcloudRpLists(elem);
      }
      break;
    default:
      throw 'err, no such type available to sync';
  }
};
export const findCalendarDataSorter = obj => {
  return obj.iCALString;
};

export const findRpSorter = obj => {
  // ensure all null values are changed to undefined for consistency
  Object.keys(obj).forEach(key => {
    obj[key] = obj[key] === null ? undefined : obj[key];
  });
  // sort the object keys to ensure consistency when comparing between object strings
  return JSON.stringify(obj, Object.keys(obj).sort());
};

export const findCalendarListSorter = obj => {
  // remove the 'checked' key-value pair for comparison as fetched calendar list will always be checked: false
  let toCompareObj = Object.assign({}, obj);
  delete toCompareObj.checked;

  Object.keys(toCompareObj).forEach(key => {
    toCompareObj[key] = toCompareObj[key] === null ? undefined : obj[key];
  });
  // sort the object keys to ensure consistency when comparing between object strings
  return JSON.stringify(toCompareObj, Object.keys(toCompareObj).sort());
};
