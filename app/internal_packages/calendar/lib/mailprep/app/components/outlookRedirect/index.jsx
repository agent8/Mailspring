import React from 'react';
import queryString from 'query-string';
import { Redirect } from 'react-router';
import { connect } from 'react-redux';
// import { Client } from '@microsoft/microsoft-graph-client';
import { successOutlookAuth } from '../../actions/auth';

// import { getAccessToken, filterUser } from '../../utils/client/outlook';

const mapDispatchToProps = (dispatch) => ({
  successOutlookAuth: (user) => dispatch(successOutlookAuth(user))
});

const mapStateToProps = (state) => ({
  isAuth: state.auth.currentUser
});

class OutLookRedirect extends React.Component {
  state = {
    isDone: false
  };

  async componentDidMount() {
    // const { props } = this;
    // const response = queryString.parse(props.location.hash);
    // const accessToken = response.access_token;
    // const expiresin = (parseInt(response.expires_in, 10) - 300) * 1000;
    // const now = new Date();
    // const expireDate = new Date(now.getTime() + expiresin);
    // getAccessToken(accessToken, expireDate.getTime(), (confirmedAccessToken) => {
    //   if (confirmedAccessToken) {
    //     // Create a Graph client
    //     const client = Client.init({
    //       authProvider: (done) => {
    //         // Just return the token
    //         done(null, confirmedAccessToken);
    //       }
    //     });
    //     // This first select is to choose from the list of calendars
    //     client
    //       .api('/me')
    //       .select('*')
    //       .get(async (err, res) => {
    //         if (err) {
    //           console.log(err);
    //         } else {
    //           // const db = await getDb();
    //           const filteredSchemaUser = filterUser(res, accessToken, expireDate.getTime());
    //           const doc = await db.users.upsert(filteredSchemaUser);
    //           console.log(doc);
    //           props.successOutlookAuth({ user: filteredSchemaUser });
    //           await this.setState({
    //             isDone: true
    //           });
    //         }
    //       });
    //   } else {
    //     const error = { responseText: 'Could not retrieve access token' };
    //     console.log(error);
    //   }
    // });
  }

  renderRedirect = () => (
    // if(this.state.isDone) {
    //   return (
    //     <Redirect to="/" />
    //   );
    // }
    // else {
    <div>Loading...</div>
  );
  // }

  render() {
    return <div>{this.renderRedirect()}</div>;
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(OutLookRedirect);
