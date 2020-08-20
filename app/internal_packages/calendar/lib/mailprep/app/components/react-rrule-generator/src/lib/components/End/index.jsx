import React from 'react';
import PropTypes from 'prop-types';
import EndAfter from './After';
import EndOnDate from './OnDate';

import translateLabel from '../../utils/translateLabel';

const End = ({ id, end: { mode, after, onDate, options }, handleChange, translations }) => {
  const isOptionAvailable = (option) => !options.modes || options.modes.indexOf(option) !== -1;
  const isOptionSelected = (option) => mode === option;

  // {isOptionAvailable('Never') && <option value="Never">{translateLabel(translations, 'end.never')}</option>}
  return (
    <div className="px-3">
      <div className="form-group row">
        <div className="col-sm-3">
          <select
            name="end.mode"
            id={id}
            className="dropdown-area-sm"
            value={mode}
            onChange={handleChange}
          >
            {isOptionAvailable('After') && (
              <option value="After">End {translateLabel(translations, 'end.after')}</option>
            )}
            {isOptionAvailable('On date') && (
              <option value="On date">End {translateLabel(translations, 'end.on_date')}</option>
            )}
          </select>
          {isOptionSelected('After') && (
            <EndAfter
              id={`${id}-after`}
              after={after}
              className="dropdown-area-sm"
              handleChange={handleChange}
              translations={translations}
            />
          )}
          {isOptionSelected('On date') && (
            <EndOnDate
              id={`${id}-onDate`}
              onDate={onDate}
              className="dropdown-area-sm"
              handleChange={handleChange}
              translations={translations}
            />
          )}
        </div>
      </div>
    </div>
  );
};

End.propTypes = {
  id: PropTypes.string.isRequired,
  end: PropTypes.shape({
    mode: PropTypes.string.isRequired,
    after: PropTypes.number.isRequired,
    onDate: PropTypes.object.isRequired,
    options: PropTypes.shape({
      modes: PropTypes.arrayOf(PropTypes.oneOf(['Never', 'After', 'On date'])),
      weekStartsOnSunday: PropTypes.bool
    }).isRequired
  }).isRequired,
  handleChange: PropTypes.func.isRequired,
  translations: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired
};

export default End;
