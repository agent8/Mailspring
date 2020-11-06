import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { createHashHistory } from 'history';
import { routerMiddleware } from 'connected-react-router';
import createRootReducer from '../reducers';
import { createEpicMiddleware, combineEpics } from 'redux-observable';
import { authBeginMiddleware, authSuccessMiddleware } from '../middleware/auth';
import { createLogger } from 'redux-logger';
import loggerMiddleware from '../middleware/logger';
import rootEpic from '../epics';

const history = createHashHistory();
const rootReducer = createRootReducer(history);
const router = routerMiddleware(history);
const enhancer = applyMiddleware(thunk, router);
const epicMiddleware = createEpicMiddleware();

// function configureStore(initialState?: counterStateType) {
//   return createStore(rootReducer, initialState, enhancer);
// }

const configureStore = (initialState?: counterStateType) => {
  const middleware = [];
  const enhancers = [];

  // Logging Middleware
  const logger = createLogger({
    level: 'info',
    collapsed: true
  });

  middleware.push(logger);

  // Router Middleware
  const router = routerMiddleware(history);
  middleware.push(router);

  // If Redux DevTools Extension is installed use it, otherwise use Redux compose
  /* eslint-disable no-underscore-dangle */
  const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  /* eslint-enable no-underscore-dangle */

  // Apply Middleware & Compose Enhancers
  enhancers.push(applyMiddleware(...middleware, epicMiddleware, loggerMiddleware));
  const enhancer = composeEnhancers(...enhancers);

  // Create Store
  const store = createStore(
    rootReducer,
    composeEnhancers(
      applyMiddleware(authBeginMiddleware, authSuccessMiddleware, epicMiddleware, loggerMiddleware)
    )
  );

  epicMiddleware.run(rootEpic);
  return store;
};

export default { configureStore, history };
