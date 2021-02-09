import React from 'react';
import { Calendar, Views, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Fragment } from 'react';
import AddForm from './AddForm';

const propTypes = {};
const localizer = momentLocalizer(moment);
class SelectableCalendar extends React.Component {
  constructor(...args) {
    super(...args);
    this.state = {
      events: [],
      start: '',
      end: '',
      addFormPopout: false,
    };
  }

  handleSelect = ({ start, end }) => {
    this.setState(prevState => ({
      ...prevState,
      start: start,
      end: end,
    }));
    this.setAddFormPopout(true);
  };
  setAddFormPopout = boolValue => {
    this.setState(prevState => ({
      ...prevState,
      addFormPopout: boolValue,
    }));
  };
  render() {
    return (
      <Fragment>
        {this.state.addFormPopout ? (
          <AddForm
            start={this.state.start}
            end={this.state.end}
            parentPropFunction={this.setAddFormPopout}
            parentPropState={this.state.addFormPopout}
          />
        ) : null}
        <Calendar
          selectable
          localizer={localizer}
          events={this.state.events}
          defaultView={Views.MONTH}
          onSelectEvent={event => console.log('test')}
          onSelectSlot={this.handleSelect}
        />
      </Fragment>
    );
  }
}

SelectableCalendar.propTypes = propTypes;

export default SelectableCalendar;
