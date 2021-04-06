import React from 'react';
import SelectableCalendar from './components/selectable-calendar';
import { Actions, CalendarPluginStore } from 'mailspring-exports';

export default class Calendar extends React.Component {
  constructor(...args) {
    super(...args);
    this.mounted = false;
  }
  static displayName = 'Calendar';
  static containerRequired = false;

  render() {
    return <SelectableCalendar />;
  }
}
