import React from 'react';
import PropTypes from 'prop-types';
import RepeatMonthlyOn from './On';
import RepeatMonthlyOnThe from './OnThe';
import numericalFieldHandler from '../../../utils/numericalFieldHandler';
import translateLabel from '../../../utils/translateLabel';

const RepeatMonthly = ({
  id,
  monthly: {
    mode,
    interval,
    on,
    onThe,
    options,
  },
  handleChange,
  translations
}) => {
  const isTheOnlyOneMode = option => options.modes === option;
  const isOptionAvailable = option => !options.modes || isTheOnlyOneMode(option);

  return (
    <div>
      <div className="form-group row d-flex align-items-sm-center">
        <div className="col-sm-3">
          <span>{translateLabel(translations, 'repeat.monthly.every')} </span>
          <input
            id={`${id}-interval`}
            name="repeat.monthly.interval"
            aria-label="Repeat monthly interval"
            className="input-area input-area-sm"
            value={interval}
            onChange={numericalFieldHandler(handleChange)}
          />
          <span> {translateLabel(translations, 'repeat.monthly.months')}</span>
        </div>
      </div>

      {isOptionAvailable('on') && (
        <RepeatMonthlyOn
          id={`${id}-on`}
          mode={mode}
          on={on}
          hasMoreModes={!isTheOnlyOneMode('on')}
          handleChange={handleChange}
          translations={translations}
        />
      )}
      {isOptionAvailable('on the') && (
        <RepeatMonthlyOnThe
          id={`${id}-onThe`}
          mode={mode}
          onThe={onThe}
          hasMoreModes={!isTheOnlyOneMode('on the')}
          handleChange={handleChange}
          translations={translations}
        />
      )}

    </div>
  );
};

RepeatMonthly.propTypes = {
  id: PropTypes.string.isRequired,
  monthly: PropTypes.shape({
    mode: PropTypes.oneOf(['on', 'on the']).isRequired,
    // Currently monthly.interval is somehow always undefined
    // interval: PropTypes.number.isRequired,
    on: PropTypes.object.isRequired,
    onThe: PropTypes.object.isRequired,
    options: PropTypes.shape({
      modes: PropTypes.oneOf(['on', 'on the']),
    }).isRequired,
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  translations: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
};

export default RepeatMonthly;
