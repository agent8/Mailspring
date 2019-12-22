import React from 'react';
import PropTypes from 'prop-types';
import RetinaImg from './retina-img';
const Colr = require('colr');

export const LabelColorizer = {
  colors: [
    '#f4f6f8', // '#e4e3e4',
    '#aec9f1',
    '#8fd1bf',
    '#dfd3fe',
    '#ff0400',
    '#f9cddc',
    '#efa99f',
    '#bababa',
    '#427de0',
    '#2e96b0',
    '#f297a9',
    '#f74431',
    '#fec1a8',
    '#fed8ae',
    '#f9e47e',
    '#fce9bb',
    '#acebcd',
    '#9ad6b9',
    '#fd6a3a',
    '#fda248',
    '#e8d6d9',
    '#c49ca2',
    '#41ce89',
    '#209c5c',
  ],
  sanitize(label) {
    if (label.bgColor && (label.bgColor < 0 || label.bgColor >= LabelColorizer.colors.length)) {
      console.warn(`Label bgColor incorrect ${label.bgColor}, setting to 0`);
      label.bgColor = 0;
    }
    if (!label.bgColor) {
      label.bgColor = 0;
    }
  },

  color(label) {
    if (label.bgColor == "0") {
      return null;
    }
    LabelColorizer.sanitize(label);
    const bgColor = LabelColorizer.colors[label.bgColor];
    const RgbValueArry = Colr.fromHex(bgColor).toRgbArray();
    var grayLevel = RgbValueArry[0] * 0.299 + RgbValueArry[1] * 0.587 + RgbValueArry[2] * 0.114;
    if (grayLevel >= 192) {
      return '#797d80'; // gray
    } else {
      return '#ffffff'; // white
    }
  },

  backgroundColor(label) {
    LabelColorizer.sanitize(label);
    const bgColor = LabelColorizer.colors[label.bgColor];
    return bgColor;
  },

  backgroundColorDark(label) {
    LabelColorizer.sanitize(label);
    const bgColor = LabelColorizer.colors[label.bgColor];
    var colr = Colr.fromHex(bgColor).darken(30);
    return colr.toHex();
  },

  styles(label) {
    LabelColorizer.sanitize(label);
    const bgColor = LabelColorizer.colors[label.bgColor];
    var colr = Colr.fromHex(bgColor).darken(15);
    const styles = {
      color: LabelColorizer.color(label),
      backgroundColor: LabelColorizer.backgroundColor(label),
      boxShadow: `inset 0 0 1px ${colr.toHex()}, inset 0 1px 1px rgba(255,255,255,0.5), 0 0.5px 0 rgba(255,255,255,0.5)`,
    };
    // if (process.platform !== 'win32') {
    //   styles.backgroundImage = 'linear-gradient(rgba(255,255,255, 0.4), rgba(255,255,255,0))';
    // }
    return styles;
  },
};

const SHOW_LABEL_KEY = 'core.workspace.showLabels';
export class MailLabel extends React.Component {
  static propTypes = {
    label: PropTypes.object.isRequired,
    onRemove: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      showLabels: AppEnv.config.get(SHOW_LABEL_KEY)
    }
  }

  componentDidMount = () => {
    const configDisposer = AppEnv.config.onDidChange(SHOW_LABEL_KEY, this._onChange);
    this._unsubscribers = [
      configDisposer.dispose,
    ];
  }

  componentWillUnmount = () => {
    for (const unsubscribe of this._unsubscribers) {
      unsubscribe();
    }
  }

  _onChange = () => {
    this.setState({
      showLabels: AppEnv.config.get(SHOW_LABEL_KEY)
    });
    // sometimes, this component don't render automaticlly, so add forceUpdate
    this.forceUpdate();
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.label.id === this.props.label.id) {
      return false;
    }
    return true;
  }

  _removable() {
    return this.props.onRemove && !this.props.label.isLockedCategory();
  }

  render() {
    if (!this.state.showLabels) {
      return null;
    }
    let classname = 'mail-label';
    let content = <span className="inner">{this.props.label.displayName}</span >;

    let x = null;
    if (this._removable()) {
      classname += ' removable';
      content = <span className="inner">{content}</span>;
      x = (
        <RetinaImg
          className="x"
          isIcon
          name="close_1.svg"
          style={{ width: 10, backgroundColor: LabelColorizer.color(this.props.label) }}
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this.props.onRemove}
        />
      );
    }

    return (
      <div className={classname} style={LabelColorizer.styles(this.props.label)}>
        {content}
        {x}
      </div>
    );
  }
}
