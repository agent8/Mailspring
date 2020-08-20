import 'rxjs/Rx';
import { combineEpics } from 'redux-observable';
import * as eventsEpics from './events';
import providersEpics from './providers';
import dbEpics from './db';

export default combineEpics(
  ...Object.values(eventsEpics),
  ...Object.values(providersEpics),
  ...Object.values(dbEpics)
);
