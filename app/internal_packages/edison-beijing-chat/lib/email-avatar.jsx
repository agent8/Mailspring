/* eslint jsx-a11y/tabindex-no-positive: 0 */
import React, { Component } from 'react';
import { gradientColorForString } from '../utils/colors';
import { getLogo } from '../utils/restjs';
import { LottieImg } from 'mailspring-component-kit';
import { FocusedPerspectiveStore, AccountStore } from 'mailspring-exports';

const ConfigProfileKey = 'core.appearance.profile';
export default class EmailAvatar extends Component {
  static displayName = 'EmailAvatar';
  static getDerivedStateFromProps(props, state) {
    const newState = EmailAvatar._processProps(props, !state.hasImage);
    if (
      state.email !== newState.email ||
      state.name !== newState.name ||
      (state.bgColor !== newState.bgColor && !state.hasImage)
    ) {
      if (
        props.thread &&
        (!Array.isArray(props.thread.__messages) || props.thread.__messages.length === 0)
      ) {
        return null;
      }
      return newState;
    }
    return null;
  }
  constructor(props) {
    super(props);
    // This mode is not the "split/list" mode, but as in "use in list"  or "use in other places" mode
    const isListModel = props.mode && props.mode === 'list';
    const showPictures = AppEnv.config.get(ConfigProfileKey) || !isListModel;
    this.state = EmailAvatar._processProps(props, true);
    this.state.hasImage = false;
    this._mounted = false;
    this.state.showPicture = showPictures;
    this.disposable = AppEnv.config.onDidChange(ConfigProfileKey, () => {
      this.setState({
        showPicture: AppEnv.config.get(ConfigProfileKey) || !isListModel,
      });
    });
  }

  componentDidMount = async () => {
    this._mounted = true;
    this._updateImage(this.state, true);
  };
  componentDidUpdate(prevProps, prevState, snapshot) {
    this._updateImage(prevState);
  }

  componentWillUnmount() {
    this.disposable.dispose();
    this._mounted = false;
  }
  _safeSetState(state, cb = () => {}) {
    if (this._mounted) {
      this.setState(state, cb);
    }
  }
  _updateImage = async (prevState, forceUpdate) => {
    const { email, showPicture } = this.state;
    if (!showPicture && this.state.hasImage) {
      this._safeSetState({ hasImage: false });
      return;
    }
    if (
      (email && prevState.email !== email) ||
      forceUpdate ||
      (showPicture && !prevState.showPicture)
    ) {
      const acc = AccountStore.accountForEmail({ email });
      let avatarUrl;
      if (acc && acc.picture) {
        avatarUrl = acc.picture;
      } else {
        avatarUrl = await getLogo(email);
      }
      if (this._mounted && this) {
        if (avatarUrl) {
          this._safeSetState({
            bgColor: `url('${avatarUrl}')`,
            hasImage: true,
          });
        } else if (this.state.hasImage) {
          this._safeSetState({ hasImage: false });
        }
      }
    }
  };

  static _getThreadAvatar = (props, messages) => {
    if (props.mode && props.mode === 'list') {
      const fromList = [],
        toList = [],
        ccList = [],
        bccList = [];
      messages.forEach(msg => {
        const account = AccountStore.accountForId(msg.accountId);
        const filterCurrent = contact => !account.isMyEmail(contact.email);
        fromList.push(...(msg.from || []).filter(filterCurrent));
        toList.push(...(msg.to || []).filter(filterCurrent));
        ccList.push(...(msg.cc || []).filter(filterCurrent));
        bccList.push(...(msg.bcc || []).filter(filterCurrent));
      });
      const fullList = [...bccList, ...ccList, ...toList, ...fromList];
      if (fullList.length) {
        return fullList[fullList.length - 1];
      }
    }
    const chooseMessage = messages[messages.length - 1];
    const from = chooseMessage.from && chooseMessage.from[0];
    return from;
  };

  static _processProps = (props, changeBgColor) => {
    let from = {};
    if (props.thread) {
      const messages = props.thread.__messages;
      if (messages && messages.length) {
        from = EmailAvatar._getThreadAvatar(props, messages);
      }
      from = from || {};
    } else if (props.message) {
      const message = props.message;
      from = message.from && message.from[0];
      let to = message.to && message.to[0];
      if (!from && to) {
        from = to;
      }
    } else if (props.from && props.from.displayName) {
      from = {
        name: props.from && props.from.displayName({ compact: true }),
        email: props.from.email,
      };
    } else if (props.account) {
      from = {
        name: props.account.name,
        email: props.account.email,
      };
    } else if (props.name || props.email) {
      from = {
        name: props.name,
        email: props.email,
      };
    }
    if (!from) {
      from = {};
    }
    const state = {
      name: (from.name || from.email || ' ')
        .trim()
        .substring(0, 1)
        .toUpperCase(),
      email: from.email || ' ',
    };
    if (props.number) {
      state.name = props.number;
    }
    if (changeBgColor) {
      state.bgColor = gradientColorForString(from.email || '');
    }
    return state;
  };

  render() {
    const { name, bgColor, hasImage, showPicture } = this.state;
    if (!showPicture) {
      return null;
    }
    let styles = {
      backgroundImage: bgColor,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundColor: bgColor && bgColor.includes('url') ? 'white' : null,
    };
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
      return (
        <div className="avatar-icon" style={styles}>
          {!hasImage ? name : null}
          <LottieImg
            name={'loading-spinner-blue'}
            size={{ width: 50, height: 50 }}
            isClickToPauseDisabled={true}
            style={lottieStyle}
          />
        </div>
      );
    }
    return (
      <div className="avatar-icon" style={styles}>
        {!hasImage ? name : null}
      </div>
    );
  }
}
