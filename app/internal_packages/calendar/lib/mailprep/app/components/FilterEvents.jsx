import React, { Children, Component } from 'react';
import { connect } from 'react-redux';
import { updateFilter, changeColor } from '../actions/filter';
import { updateEventColor } from '../actions/db/events'
import CalendarMenu from './CalendarMenu';
import { Actions } from 'mailspring-exports'

class FilterEvents extends React.Component {
  constructor(props) {
    super(props);
    const calendarMenuOpen = {};
    props.calendarsList.forEach((acc) => {
      acc.calendars.forEach((cal) => {
        const url = cal.calendarUrl;
        calendarMenuOpen[url] = false;
      });
    });
    this.state = {
      calendarMenuOpen
    };
  }

  static getDerivedStateFromProps = (props, state) => ({
    ...state,
    calendarsList: props.calendarsList,
    filterMap: props.filterMap
  });

  handleFilterChange = (event) => {
    event.persist();
    this.setState((state, props) => {
      const thisMap = state.filterMap;
      thisMap[event.target.value] = !state.filterMap[event.target.value];
      props.updateFilter(thisMap); // dispatch action
      return {
        ...state,
        filterMap: thisMap
      };
    });
  };

  handleColorChange = (color, calUrl, email) => {
    this.setState((state, props) => {
      const thisCalendarsList = state.calendarsList;
      thisCalendarsList.map((acc) => {
        acc.calendars.map((cal) => {
          if (cal.calendarUrl === calUrl) {
            cal.color = color;
            this.props.changeColor(cal);
            this.props.updateEventColor(cal, acc);
          }
          return cal;
        })
      });
      return {
        ...state,
        calendarsList: thisCalendarsList
      }
    });
  }

  setOpen = (e, acc, cal, calUrl) => {
    e.preventDefault();
    e.persist()
    Actions.openPopover(
      <CalendarMenu
        email={acc.email}
        calUrl={calUrl}
        color={cal.color}
        changeColor={this.handleColorChange}
      />,
      {
        // originRect,
        originRect: { top: e.clientY, left: e.clientX },
        disablePointer: true,
        direction: 'left',
        className: 'popout-container',
      }
    );
  };

  renderCalendarList = (acc, filterMap) =>
    acc.calendars.map((cal) => {
      // if first login calUrl = cal.url, if retrieved from db, calUrl = cal,url
      // problem with epics changing payload
      const calUrl = cal.calendarUrl ? cal.calendarUrl : (cal.url ? cal.url : cal.id);

      return (
        <li key={cal.calendarUrl ? cal.calendarUrl : cal.id}>
          <div className="calendar-list-item">
            <label className="checkbox-container" htmlFor={calUrl}>
              <input
                type="checkbox"
                value={calUrl}
                id={calUrl}
                name={calUrl}
                onChange={this.handleFilterChange}
                checked={filterMap[calUrl]}
              />
              <p className={`checkbox-checkmark color-picker-${cal.color ? cal.color : 'blue'}`}></p>
              <span>{cal.displayName ? cal.displayName : cal.summary}</span>
            </label>
            <div className="dropdown">
              <div>
                <button
                  value={calUrl}
                  className="three-dot-btn"
                  onClick={e => this.setOpen(e, acc, cal, calUrl)}
                >
                  &#10247;
                </button>
              </div>
            </div>
          </div>

        </li>
      );
    });

  render() {
    const { props } = this;
    const { state } = this;

    return (
      <div className="my-calendars">
        <form action="#">
          <button className="calendar-btn">My calendars</button>
          <ul className="calendar-list">
            {props.calendarsList.map((acc) => [
              <h4 className='email-heading' key={`acc-${acc.email}`}>{acc.email}</h4>,
              ...this.renderCalendarList(acc, state.filterMap)
            ])}
          </ul>
        </form>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  const calendarsList = [
    ...state.auth.providers.CALDAV.map((account) => ({
      email: account.email,
      type: 'CALDAV',
      caldavType: account.caldavType,
      provider: JSON.stringify(account),
      calendars: account.calendars !== undefined ? account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal)) : []
    })),
    ...state.auth.providers.EXCHANGE.map((account) => ({
      email: account.email,
      type: 'EXCHANGE',
      provider: JSON.stringify(account),
      calendars: account.calendars !== undefined ? account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal)) : []
    })),
    ...state.auth.providers.GOOGLE.map((account) => ({
      email: account.email,
      type: 'GOOGLE',
      provider: JSON.stringify(account),
      calendars: account.calendars !== undefined ? account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal)) : []
    })),
    ...state.auth.providers.OUTLOOK.map((account) => ({
      email: account.email,
      type: 'OUTLOOK',
      provider: JSON.stringify(account),
      calendars: account.calendars !== undefined ? account.calendars.map((cal) => (cal.dataValues ? cal.dataValues : cal)) : []
    }))
  ];

  return {
    calendarsList,
    filterMap: state.filter.filterMap
  };
};

const mapDispatchToProps = (dispatch) => ({
  updateFilter: (filterMap) => dispatch(updateFilter(filterMap)),
  changeColor: (color) => dispatch(changeColor(color)),
  updateEventColor: (calendar, account) => dispatch(updateEventColor(calendar, account))
});

export default connect(mapStateToProps, mapDispatchToProps)(FilterEvents);