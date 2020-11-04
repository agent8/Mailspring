import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cloneDeep, set } from 'lodash';

import Start from './Start/index';
import Repeat from './Repeat/index';
import End from './End/index';
import computeRRuleToString from '../utils/computerrule/to-string/computeRRule';
import computeRRuleFromString from '../utils/computerrule/from-string/computeRRule';
import configureInitialState from '../utils/configureInitialState';
import translateLabel from '../utils/translateLabel';
import translations from '../translations';
// import '../styles/index.css';

class ReactRRuleGenerator extends PureComponent {
  // compute default view based on user's config
  state = configureInitialState(this.props.config, this.props.calendarComponent, this.props.id);

  componentWillMount() {
    if (this.props.onChange === ReactRRuleGenerator.defaultProps.onChange) {
      // no onChange() was provided
      throw new Error(
        'No onChange() function has been passed to RRuleGenerator. \n' +
        "Please provide one, it's needed to handle generated value."
      );
    }

    if (this.props.value) {
      // if value is provided to RRuleGenerator, it's used to compute state of component's forms
      const data = computeRRuleFromString(this.state.data, this.props.value);
      this.setState({
        data,
        isRepeating: true
      });
    }

  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value) {
      const data = computeRRuleFromString(this.state.data, nextProps.value);
      this.setState({ data });
    }
  }

  handleChange = (event) => {
    // TODO: Change start date accordingly
    if (event.target.name === 'repeat.frequency' && event.target.value === 'Never') {
      this.setState({
        isRepeating: false
      })
      const newData = cloneDeep(this.state.data);
      set(newData, event.target.name, event.target.value);
      const rrule = computeRRuleToString(newData);
      this.props.onChange('');
    } else {
      const newData = cloneDeep(this.state.data);
      set(newData, event.target.name, event.target.value);
      const rrule = computeRRuleToString(newData);
      this.setState({
        data: newData,
        isRepeating: true
      });
      this.props.onChange(rrule);
    }

  };

  handleChangeSelect = name => (target) => {
    // TODO: Change start date accordingly
    if (name === 'repeat.frequency' && target.value === 'Never') {
      this.setState({
        isRepeating: false
      })
      const newData = cloneDeep(this.state.data);
      set(newData, name, target.value);
      const rrule = computeRRuleToString(newData);
      this.props.onChange('');
    } else {
      const newData = cloneDeep(this.state.data);
      set(newData, name, target.value);
      const rrule = computeRRuleToString(newData);
      this.setState({
        data: newData,
        isRepeating: true
      });
      this.props.onChange(rrule);
    }

  };

  render() {
    const {
      id,
      data: { start, repeat, end, options, error }
    } = this.state;
    if (this.props.value === '') {
      repeat.frequency = 'Never';
    }
    return (
      <div>
        {!options.hideError && error && (
          <div className="alert alert-danger">
            {translateLabel(this.props.translations, 'invalid_rrule', { value: error.value })}
          </div>
        )}
        <div className="px-0 pt-3 border rounded">
          {!options.hideStart && (
            <div>
              <Start
                id={`${id}-start`}
                start={start}
                handleChange={this.handleChange}
                translations={this.props.translations}
              />
            </div>
          )}

          <div>
            <Repeat
              id={`${id}-repeat`}
              repeat={repeat}
              handleChangeSelect={this.handleChangeSelect}
              handleChange={this.handleChange}
              translations={this.props.translations}
              isRepeating={this.state.isRepeating}
            />
          </div>

          {this.state.isRepeating && !options.hideEnd && (
            <div>
              <End
                id={`${id}-end`}
                end={end}
                handleChange={this.handleChange}
                translations={this.props.translations}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

ReactRRuleGenerator.propTypes = {
  id: PropTypes.string,
  config: PropTypes.shape({
    frequency: PropTypes.arrayOf(
      PropTypes.oneOf(['Never', 'Yearly', 'Monthly', 'Weekly', 'Daily'])
    ),
    yearly: PropTypes.oneOf(['on', 'on the']),
    monthly: PropTypes.oneOf(['on', 'on the']),
    end: PropTypes.arrayOf(PropTypes.oneOf(['Never', 'After', 'On date'])),
    hideStart: PropTypes.bool,
    hideEnd: PropTypes.bool,
    hideError: PropTypes.bool,
    weekStartsOnSunday: PropTypes.bool
  }),
  value: PropTypes.string,
  onChange: PropTypes.func,
  calendarComponent: PropTypes.oneOfType([PropTypes.element, PropTypes.func]),
  translations: PropTypes.oneOfType([PropTypes.object, PropTypes.func])
};
ReactRRuleGenerator.defaultProps = {
  id: null,
  value: '',
  config: {},
  onChange() { },
  calendarComponent: null,
  translations: translations.english
};

export default ReactRRuleGenerator;
