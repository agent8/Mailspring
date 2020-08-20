import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import auth from './auth';
import events from './events';
import filter from './filter';

export default function createRootReducer(history: History) {
  return combineReducers({
    router: connectRouter(history),
    auth,
    events,
    filter
  });
}
