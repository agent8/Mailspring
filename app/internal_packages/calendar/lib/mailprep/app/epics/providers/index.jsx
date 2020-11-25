// import * as exchangeEpics from './exchange';
import * as caldavEpics from './caldav';
import * as googleEpics from './Google';
// import * as outlookEpics from './outlook';

export default {
  // ...exchangeEpics,
  ...googleEpics,
  ...caldavEpics,
  // ...outlookEpics
};
