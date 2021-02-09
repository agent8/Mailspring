import React from 'react';
import PropTypes from 'prop-types';
import numericalFieldHandler from '../../../utils/numericalFieldHandler';
import translateLabel from '../../../utils/translateLabel';

const RepeatDaily = ({
  id,
  daily: {
    interval,
  },
  handleChange,
  translations
}) => (
  <div className="form-group row d-flex align-items-sm-center">
    <div className="col-sm-2">
      <span>{translateLabel(translations, 'repeat.daily.every')} </span>
      <input
        id={`${id}-interval`}
        name="repeat.daily.interval"
        aria-label="Repeat daily interval"
        className="input-area input-area-sm"
        value={interval}
        onChange={numericalFieldHandler(handleChange)}
      />
      <span> {translateLabel(translations, 'repeat.daily.days')}</span>
    </div>
  </div>
);
RepeatDaily.propTypes = {
  id: PropTypes.string.isRequired,
  daily: PropTypes.shape({
    interval: PropTypes.number.isRequired,
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  translations: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
};

export default RepeatDaily;
