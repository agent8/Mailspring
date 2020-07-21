
import React, { Component } from 'react';
import { LabelColorizer } from 'mailspring-component-kit';
import RetinaImg from './retina-img';

export default class AccountColorPopout extends Component {
  constructor(props) {
    super(props);

    this.wrapperRef = React.createRef();
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  handleClickOutside(event) {
    if (this.wrapperRef && !this.wrapperRef.current.contains(event.target)) {
      this.props._hideAccountColorPopout();
    }
  }

  render() {
    const { item } = this.props
    return (
      <div className="popout" ref={this.wrapperRef}>
        Change Account Color
        <div className="color-choice">
          {LabelColorizer.colors.map((color, idx) => {
            const className = AppEnv.config.get("core.account.colors")[item.accountIds[0]] === idx ? 'checked' : '';
            return (
              <div
                key={color}
                className={className}
                style={{ background: color }}
                onClick={() => this.props.onCheckColor(idx)}
              >
                <RetinaImg
                  className="check-img check"
                  name="tagging-checkmark.png"
                  mode={RetinaImg.Mode.ContentPreserve}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}