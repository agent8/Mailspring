import React, { Component } from 'react';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import MomentLocaleUtils, { formatDate, parseDate } from 'react-day-picker/moment';
// import 'react-day-picker/lib/style.css';
import moment from 'moment';

class Date extends Component {
  handleClickDay = (day) => {
    const momentDay = moment(day).format();
    const { props } = this;
    // console.log(props, day, momentDay);
    props.dayProps({
      name: props.name,
      value: momentDay
    });
  };

  render() {
    const { props } = this;

    return (
      <div>
        <DayPickerInput
          formatDate={formatDate}
          parseDate={parseDate}
          format="LL"
          onDayChange={this.handleClickDay}
          placeholder={`${formatDate(props.startDay)}`}
          dayPickerProps={{
            locale: 'en',
            localeUtils: MomentLocaleUtils
          }}
        />
      </div>
    );
  }
}

export default Date;
