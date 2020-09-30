import React, { Component } from 'react';
import { render } from 'react-dom';
// import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { ResizableRegion, RetinaImg } from 'mailspring-component-kit';
import Root from './containers/Root';
import { configureStore, history } from './store/configureStore';
import SidebarContainer from './containers/sidebar-container';
import Calendar from './index';
// import './app.global.css';

// import './index.css';
// import './bootstrap.css';

const store = configureStore();
// render(
//   <AppContainer>
//   <Root store={store} history={history} />,
//   </AppContainer>,
//   document.getElementById('root')
// );

// if (module.hot) {
//   module.hot.accept('./containers/Root', () => {
//     // eslint-disable-next-line global-require
//     const NextRoot = require('./containers/Root').default;
//     render(
//       <AppContainer>
//       <NextRoot store={store} history={history} />,
//       </AppContainer>,
//       document.getElementById('root')
//     );
//   });
// }

export default class IntegratedCalendar extends Component {
  static displayName = 'IntegratedCalendar';
  static containerRequired = false;

  render() {
    return (
      <ResizableRegion
        minWidth={400}
        handle={ResizableRegion.Handle.Left}
        initialWidth={400}
      >
        <Provider store={store}>
          <SidebarContainer />
        </Provider>
      </ResizableRegion>
    );

  };
}
