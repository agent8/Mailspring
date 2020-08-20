/* global google */

import React from 'react';
import AddressDetails from './addressDetails';

class Location extends React.Component {
  constructor(props) {
    super(props);
    this.autocompleteInput = React.createRef();
    this.autocomplete = null;
    this.handlePlaceChanged = this.handlePlaceChanged.bind(this);
    this.state = {
      place: ''
    };
  }

  componentDidMount() {
    const { props } = this;

    this.autocomplete = new google.maps.places.Autocomplete(this.autocompleteInput.current, {
      types: ['geocode']
    });
    this.autocomplete.setFields(['address_component', 'geometry', 'icon', 'name']);
    this.autocomplete.addListener('place_changed', this.handlePlaceChanged);
    this.setState({
      place: props.place
    });
  }

  handlePlaceChanged() {
    const { props } = this;
    const place = this.autocomplete.getPlace();

    props.onPlaceChanged({
      name: props.name,
      value: place
    });
  }

  render() {
    const { state } = this;

    return (
      <div>
        <h5>Location</h5>
        <input
          ref={this.autocompleteInput}
          id="autocomplete"
          placeholder="Enter your address"
          type="text"
        />
        <AddressDetails place={state.place} />
      </div>
    );
  }
}

export default Location;
