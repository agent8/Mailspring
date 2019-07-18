/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import { gradientColorForString } from '../utils/colors';
import { getLogo } from '../utils/restjs';
import { LottieImg } from 'mailspring-component-kit';

export default class EmailAvatar extends Component {
  static displayName = 'EmailAvatar';

  constructor(props) {
    super(props);
    let from = {};
    if (props.thread) {
      const messages = props.thread.__messages;
      if (messages && messages.length) {
        from = messages[messages.length - 1].from[0];
      }
      from = from || {};
    } else if (props.from) {
      from = {
        name: props.from && props.from.displayName({ compact: true }),
        email: props.from.email,
      };
    }

    this.state = {
      name: (from.name || from.email || ' ')
        .trim()
        .substring(0, 1)
        .toUpperCase(),
      bgColor: gradientColorForString(from.email || ''),
      email: from.email,
      hasImage: false,
    };
    this._mounted = false;
  }

  componentDidMount = async () => {
    this._mounted = true;
    if (this.state.email) {
      const avatarUrl = await getLogo(this.state.email);
      if (avatarUrl && this._mounted) {
        this && this.setState({
          bgColor: `url('${avatarUrl}')`,
          hasImage: true,
        });
      }
    }
  };

  componentWillUnmount() {
    this._mounted = false;
  }

  render() {
    const { name, bgColor, hasImage } = this.state;
    let styles = { backgroundImage: bgColor, backgroundPosition: 'center', backgroundSize: 'cover' };
    if (this.props.styles) {
      styles = Object.assign(styles, this.props.styles);
    }
    if (this.props.messagePending) {
      const lottieStyle = { marginTop: -5, marginLeft: -5 };
      if (!hasImage) {
        lottieStyle.position = 'absolute';
        lottieStyle.left = 0;
        lottieStyle.top = 15;
      }
      return <div className="avatar-icon" style={styles}>
        {!hasImage ? name : null}
        <LottieImg name={'loading-spinner-blue'}
          size={{ width: 50, height: 50 }}
          isClickToPauseDisabled={true}
          style={lottieStyle} />
      </div>;
    }
    return (
      <div className="avatar-icon" style={styles}>
        {!hasImage ? name : null}
      </div>
    );
  }
}
