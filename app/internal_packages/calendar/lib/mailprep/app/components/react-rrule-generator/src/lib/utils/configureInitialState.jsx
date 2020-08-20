import moment from 'moment';
import { isEmpty, uniqueId } from 'lodash';

import computeRRuleToString from './computeRRule/toString/computeRRule';
import { DATE_TIME_FORMAT } from '../constants/index';

const configureState = (config = {}, calendarComponent, id) => {
  const configureFrequency = () => (config.repeat ? 'Never' : 'Yearly');
  const configureYearly = () => (config.yearly || 'off');
  const configureMonthly = () => (config.monthly || 'off');
  const configureEnd = () => (config.end ? config.end[0] : 'Never');
  const configureHideStart = () => (typeof config.hideStart === 'undefined' ? true : config.hideStart);
  const uniqueRruleId = isEmpty(id) ? uniqueId('rrule-') : id;

  const data = {
    start: {
      onDate: {
        date: moment().format(DATE_TIME_FORMAT),
        options: {
          weekStartsOnSunday: config.weekStartsOnSunday,
          calendarComponent,
        },
      },
    },
    repeat: {
      frequency: 'Never',
      yearly: {
        mode: configureYearly(),
        on: {
          month: 'Jan',
          day: 1,
        },
        onThe: {
          month: 'Jan',
          day: 'Monday',
          which: 'First',
        },
        options: {
          modes: config.yearly,
        },
      },
      monthly: {
        interval: 1,
        mode: configureMonthly(),
        on: {
          day: 1,
        },
        onThe: {
          day: 'Monday',
          which: 'First',
        },
        options: {
          modes: config.monthly,
        },
      },
      weekly: {
        interval: 1,
        days: {
          sun: false,
          mon: false,
          tue: false,
          wed: false,
          thu: false,
          fri: false,
          sat: false,
        },
        options: {
          weekStartsOnSunday: config.weekStartsOnSunday,
        },
      },
      daily: {
        interval: 1,
      },
      never: {},
      options: {
        frequency: config.repeat,
      },
    },
    end: {
      mode: configureEnd(),
      after: 1,
      onDate: {
        date: moment().format(DATE_TIME_FORMAT),
        options: {
          weekStartsOnSunday: config.weekStartsOnSunday,
          calendarComponent,
        },
      },
      options: {
        modes: config.end,
      },
    },
    options: {
      hideStart: configureHideStart(),
      hideEnd: config.hideEnd,
      hideError: config.hideError,
      weekStartsOnSunday: config.weekStartsOnSunday,
    },
    error: null,
  };

  return {
    id: uniqueRruleId,
    data,
    rrule: computeRRuleToString(data),
    isRepeating: false
  };
};

export default configureState;
