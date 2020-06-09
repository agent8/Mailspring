import { React, PropTypes, Actions, ComponentRegistry, WorkspaceStore } from 'mailspring-exports';
import Calendar from './mailprep/app/index';
export default class CalendarButton extends React.Component {
  static displayName = 'CalendarButton';

  shouldComponentUpdate(nextProps) {
    // Our render method doesn't use the provided `draft`, and the draft changes
    // constantly (on every keystroke!) `shouldComponentUpdate` helps keep Mailspring fast.
    return nextProps.session !== this.props.session;
  }

  _onClick = () => {
    AppEnv.getCurrentWindow().setMinimumSize(480, 250);
    WorkspaceStore.defineSheet(
      'Calendar',
      {},
      {
        split: ['Calendar'],
        list: ['Calendar'],
      }
    );
    ComponentRegistry.register(Calendar, {
      location: WorkspaceStore.Location.Calendar,
    });

    Actions.pushSheet(WorkspaceStore.Sheet.Calendar);
  };

  _getDialog() {
    return require('electron').remote.dialog;
  }

  render() {
    return (
      <div className="my-package">
        <button className="btn btn-toolbar" onClick={() => this._onClick()} ref="button">
          Calendar
        </button>
      </div>
    );
  }
}
