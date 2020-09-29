import { React } from 'mailspring-exports';
const { RetinaImg } = require('mailspring-component-kit');
export default class CalendarButton extends React.Component {
  static displayName = 'CalendarButton';

  shouldComponentUpdate(nextProps) {
    // Our render method doesn't use the provided `draft`, and the draft changes
    // constantly (on every keystroke!) `shouldComponentUpdate` helps keep Mailspring fast.
    return nextProps.session !== this.props.session;
  }

  _onClick = () => {
    AppEnv.newWindow({
      title: '',
      hidden: true,
      // additionalChannelParam: 'thread',
      windowKey: `calendar-plugin`,
      windowType: 'calendar-plugin',
      // threadId: 'calendar',
      // accountId: thread.accountId,
      windowLevel: 1,
      // windowProps: {
      //   threadId: thread.id,
      //   sidebarPerspectiveJson: sidebarPerspective.toJSON(),
      //   currentPerspectiveJson: currentPerspectiveJson,
      // },
    });
  };

  _getDialog() {
    return require('electron').remote.dialog;
  }

  render() {
    return (
      <div className="button-group" style={{ order: -1 }}>
        <div
          className={`btn-toolbar message-toolbar-jira`}
          onClick={() => this._onClick()}
        >
          calendar
        </div>
      </div>

    );
  }
}
