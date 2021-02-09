import React from 'react';
import SelectableCalendar from './components/SelectableCalendar';

export default class Calendar extends React.Component {
  static displayName = 'Calendar';
  static containerRequired = false;
  render() {
    return <SelectableCalendar />;
  }
}
