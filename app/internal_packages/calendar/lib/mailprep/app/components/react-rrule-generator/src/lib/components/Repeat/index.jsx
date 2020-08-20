import React from 'react';
import PropTypes from 'prop-types';
import RepeatYearly from './Yearly/index';
import RepeatMonthly from './Monthly/index';
import RepeatWeekly from './Weekly/index';
import RepeatDaily from './Daily/index';
import RepeatHourly from './Hourly/index';
import translateLabel from '../../utils/translateLabel';

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
  return (
    <div className="px-3">
      <div className="form-group row">
        {/* <div className="col-sm-2 text-sm-right">
          <label
            htmlFor={`${id}-frequency`}
            className="col-form-label"
          >
            <strong>
              {translateLabel(translations, 'repeat.label')}
            </strong>
          </label>
        </div> */}
        <div className="col-sm-6">
          <select
            name="repeat.frequency"
            id={`${id}-frequency`}
            className="rrule-dropdown"
            value={frequency}
            onChange={handleChange}
          >
            {isOptionAvailable('Never') && <option value="Never">Repeat: Never</option>}
            {isOptionAvailable('Yearly') && <option value="Yearly">{translateLabel(translations, 'repeat.yearly.label')}</option>}
            {isOptionAvailable('Monthly') && <option value="Monthly">{translateLabel(translations, 'repeat.monthly.label')}</option>}
            {isOptionAvailable('Weekly') && <option value="Weekly">{translateLabel(translations, 'repeat.weekly.label')}</option>}
            {isOptionAvailable('Daily') && <option value="Daily">{translateLabel(translations, 'repeat.daily.label')}</option>}
          </select>
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
