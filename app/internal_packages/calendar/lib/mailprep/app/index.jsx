import React, { Component } from 'react';
import { render } from 'react-dom';
// import { AppContainer } from 'react-hot-loader';
import Root from './containers/Root';
import { configureStore, history } from './store/configureStore';
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

export default class Calendar extends Component {
  static displayName = 'Calendar';
  static containerRequired = false;
  render() {
    return (
      <Root store={store} history={history} />
    );

  };
}
