import React from 'react';
import PropTypes from 'prop-types';
import numericalFieldHandler from '../../utils/numericalFieldHandler';
import translateLabel from '../../utils/translateLabel';

const EndAfter = ({
  id,
  after,
  handleChange,
  translations
}) => (
      <span>
        <input
          id={id}
          name="end.after"
          aria-label="End after"
          className="input-area-sm"
          value={after}
          onChange={numericalFieldHandler(handleChange)}
        />
        <span> {translateLabel(translations, 'end.executions')}</span>
      </span>
);

EndAfter.propTypes = {
  id: PropTypes.string.isRequired,
  after: PropTypes.number.isRequired,
  handleChange: PropTypes.func.isRequired,
  translations: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
};

export default EndAfter;
