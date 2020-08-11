
import React, { Component } from 'react';
import { LabelColorizer } from 'mailspring-component-kit';
import RetinaImg from './retina-img';

export default class AccountColorPopout extends Component {
  constructor(props) {
    super(props);
    this.wrapperRef = React.createRef();
    this.state = {
      colors: AppEnv.config.get("core.account.colors") || {}
    }
  }

  componentDidMount() {
    this.disposable = AppEnv.config.onDidChange(
      'core.account.colors',
      () => {
        this.setState({
          colors: AppEnv.config.get("core.account.colors") || {}
        })
      }
    )
  }

  componentWillUnmount() {
    this.disposable.dispose()
  }

  onCheckColor = bgColor => {
    const { item } = this.props;
    const colors = AppEnv.config.get("core.account.colors") || {};
    colors[item.accountIds[0]] = bgColor
    AppEnv.config.set('core.account.colors', colors)
  };

  render() {
    const { item } = this.props
    const { colors } = this.state
    return (
      <div className="popout" ref={this.wrapperRef}>
        Change Account Color
        <div className="color-choice">
          {LabelColorizer.colors.map((color, idx) => {
            let className = '';
            if (colors[item.accountIds[0]] !== undefined) {
              className = colors[item.accountIds[0]] === idx ? 'checked' : '';
            } else {
              className = idx === 0 ? 'checked' : '';
            }
            return (
              <div
                key={color}
                className={className}
                style={{ background: color }}
                onClick={() => this.onCheckColor(idx)}
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