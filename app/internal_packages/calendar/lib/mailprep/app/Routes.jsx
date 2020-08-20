import React from 'react';
import { Switch, Route } from 'react-router';
import App from './containers/App';
import ViewContainer from './containers/view-container';
import OutLookRedirect from './components/outlookRedirect';
import EditEventContainer from './containers/edit-event-container';
import AddEventContainer from './containers/add-form-container';

export default () => (
  <App>
    <Switch>
      <Route path="/outlook-redirect" component={OutLookRedirect} />
      <Route exact path="/" component={ViewContainer} />
      <Route path="/:start/:end" component={AddEventContainer} />
      <Route path="/:id" component={EditEventContainer} />
      <Route component={OutLookRedirect} />
    </Switch>
  </App>
);
