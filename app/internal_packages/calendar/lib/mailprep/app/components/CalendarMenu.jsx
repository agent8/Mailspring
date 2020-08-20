import React, { Children, Component } from 'react';
import { connect } from 'react-redux';

const colorOptions = [
  'red',
  'grey',
  'green',
  'orange',
  'blue',
  'pink',
  'beidge',
  'cyan',
  'darkgreen',
  'brown',
  'purple',
  'darkred'
];

class CalendarMenu extends React.Component {
  constructor(props) {
    super(props);

    this.wrapperRef = React.createRef();
    // this.setWrapperRef = this.setWrapperRef.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  handleClickOutside(event) {
    if (this.wrapperRef && !this.wrapperRef.current.contains(event.target)) {
      this.props.setClose(this.props.calUrl);
    }
  }

  changeColor = (e) => {
    e.preventDefault();
    this.props.changeColor(e.target.getAttribute('data-color'), this.props.calUrl, this.props.email)
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  }

  render() {
    const { calUrl } = this.props;
    const { state } = this;

    return (
      <div ref={this.wrapperRef} className='dropdown-content'>
        {/* Not planning to release currently may need it in future */}
        {/* <div className='menu-btn'>Rename</div>
        <div className='menu-btn'>Merge</div>
        <div className='menu-btn'>Delete</div>
        <hr className='menu-divider'/> */}
        <div className='menu-heading'>Change color</div>
        <div className='color-picker'>
          {colorOptions.map((color) => {
            return (
              <div key={color} data-color={color} className={`color-picker-circle color-picker-${color}`} onClick={this.changeColor}>
                {color === this.props.color ? <p className={'checked'}>	&#10003;</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    );
  }
}

export default CalendarMenu;