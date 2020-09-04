import React from 'react';
import PropTypes from 'prop-types';
import RepeatYearly from './Yearly/index';
import RepeatMonthly from './Monthly/index';
import RepeatWeekly from './Weekly/index';
import RepeatDaily from './Daily/index';
import RepeatHourly from './Hourly/index';
import translateLabel from '../../utils/translateLabel';
import Select from 'react-select'

const customStyles = {
  control: (provided) => ({
    ...provided,
    backgroundColor: '#fff',
    border: '2px solid darkgrey',
    borderRadius: '15px',
    padding: '10px 15px',
    width: '100%',
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: '#f9fafa'
  })
}

const Repeat = ({
  id,
  repeat: {
    frequency,
    yearly,
    monthly,
    weekly,
    daily,
    never,
    options,
  },
  handleChange,
  translations,
  isRepeating
}) => {
  const isOptionAvailable = option => !options.frequency || options.frequency.indexOf(option) !== -1;
  const isOptionSelected = option => frequency === option;

  const selectOptions = [
    { value: 'Never', label: 'Never' },
    { value: 'Yearly', label: translateLabel(translations, 'repeat.yearly.label') },
    { value: 'Monthly', label: translateLabel(translations, 'repeat.monthly.label') },
    { value: 'Weekly', label: translateLabel(translations, 'repeat.weekly.label') },
    { value: 'Daily', label: translateLabel(translations, 'repeat.daily.label') }
  ]
  return (
    <div className="px-3">
      <div className="form-group row">
        <div className="col-sm-6">
          <Select
            name={"repeat.frequency"}
            options={selectOptions}
            styles={customStyles}
            id={`${id}-frequency`}
            onChange={handleChange("repeat.frequency")}
            placeholder="Repeat: Never"
            isSearchable={false}
          />
        </div>
      </div>
      {
        isRepeating && isOptionSelected('Yearly') &&
        <RepeatYearly
          id={`${id}-yearly`}
          yearly={yearly}
          handleChange={handleChange}
          translations={translations}
        />
      }
      {
        isRepeating && isOptionSelected('Monthly') &&
        <RepeatMonthly
          id={`${id}-monthly`}
          monthly={monthly}
          handleChange={handleChange}
          translations={translations}
        />
      }
      {
        isRepeating && isOptionSelected('Weekly') &&
        <RepeatWeekly
          id={`${id}-weekly`}
          weekly={weekly}
          handleChange={handleChange}
          translations={translations}
        />
      }
      {
        isRepeating && isOptionSelected('Daily') &&
        <RepeatDaily
          id={`${id}-daily`}
          daily={daily}
          handleChange={handleChange}
          translations={translations}
        />
      }

    </div>
  );
};

Repeat.propTypes = {
  id: PropTypes.string.isRequired,
  repeat: PropTypes.shape({
    frequency: PropTypes.oneOf(['Never', 'Yearly', 'Monthly', 'Weekly', 'Daily']).isRequired,
    yearly: PropTypes.object.isRequired,
    monthly: PropTypes.object.isRequired,
    weekly: PropTypes.object.isRequired,
    daily: PropTypes.object.isRequired,
    options: PropTypes.shape({
      frequency: PropTypes.arrayOf(PropTypes.oneOf(['Never', 'Yearly', 'Monthly', 'Weekly', 'Daily'])),
      yearly: PropTypes.oneOf(['on', 'on the']),
      monthly: PropTypes.oneOf(['on', 'on the']),
    }).isRequired,
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  translations: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
};

export default Repeat;
