/* eslint-disable react/destructuring-assignment */
import React from 'react';

const AddressDetails = (props) => (
  <div>
    <pre>{JSON.stringify(props.place, null, 2)}</pre>
  </div>
);

export default AddressDetails;
