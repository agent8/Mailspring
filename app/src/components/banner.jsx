import React from 'react';
import PropTypes from 'prop-types';
import RetinaImg from './retina-img';
export default class Banner extends React.Component {
  static propTypes = {
    afterChange: PropTypes.func,
    autoplay: PropTypes.bool,
    dots: PropTypes.bool,
    data: PropTypes.arrayOf(PropTypes.string).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  };

  constructor(props) {
    super();
    this.state = {
      activeIdx: 0,
      translateX: props.width,
    };
  }
  componentDidMount() {
    if (this.props.autoplay) {
      this._startAutoPlay();
    }
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  changeCurrentIndex = idx => {
    this.setState({
      activeIdx: idx,
      translateX: 0,
    });
    setTimeout(() => {
      this.setState({
        translateX: this.props.width,
      });
    }, 100);

    if (this.props.afterChange && typeof this.props.afterChange === 'function') {
      this.props.afterChange(idx);
    }
  };

  _startAutoPlay = () => {
    this.timer = setInterval(() => {
      this._onNext();
    }, 4000);
  };

  _onPre = () => {
    const { data } = this.props;
    const { activeIdx } = this.state;
    const pre = activeIdx >= 1 ? activeIdx - 1 : data.length - 1;
    this.changeCurrentIndex(pre);
  };

  _onNext = () => {
    const { data } = this.props;
    const { activeIdx } = this.state;
    const next = activeIdx < data.length - 1 ? activeIdx + 1 : 0;
    this.changeCurrentIndex(next);
  };

  _renderDots = () => {
    const { data } = this.props;
    const { activeIdx } = this.state;
    return data.map((img, index) => {
      return (
        <div
          className={`swiper-dots${activeIdx === index ? ' active' : ''}`}
          key={`swiper-dots-${index}`}
          onClick={() => {
            this.changeCurrentIndex(index);
          }}
        ></div>
      );
    });
  };

  render() {
    const { dots, data, width, height } = this.props;
    const { activeIdx, translateX } = this.state;
    const activePreIdx = activeIdx - 1 < 0 ? data.length - 1 : activeIdx - 1;
    const activeNextIdx = activeIdx + 1 > data.length - 1 ? 0 : activeIdx + 1;

    return (
      <div className="swiper-container" style={{ width: width }}>
        <div style={{ height: height, width: width }}>
          <div
            className={`swiper-wrapper${translateX ? ' transition' : ''}`}
            style={{
              height: height,
              width: width * 3,
              left: `-${translateX}px`,
            }}
          >
            <div
              className={`swiper-slide`}
              key={`swiper-slide-${activePreIdx}`}
              title={`swiper-slide-${activePreIdx}`}
              style={{ height: height, width: width, float: 'left' }}
            >
              <RetinaImg name={data[activePreIdx]} mode={RetinaImg.Mode.ContentPreserve} />
            </div>
            <div
              className={`swiper-slide active`}
              key={`swiper-slide-${activeIdx}`}
              title={`swiper-slide-${activeIdx}`}
              style={{ height: height, width: width, float: 'left' }}
            >
              <RetinaImg name={data[activeIdx]} mode={RetinaImg.Mode.ContentPreserve} />
            </div>
            <div
              className={`swiper-slide`}
              key={`swiper-slide-${activeNextIdx}`}
              title={`swiper-slide-${activeNextIdx}`}
              style={{ height: height, width: width, float: 'left' }}
            >
              <RetinaImg name={data[activeNextIdx]} mode={RetinaImg.Mode.ContentPreserve} />
            </div>
          </div>
        </div>

        <div className="swiper-pagination">
          <span className="swiper-ctrl swiper-ctrl-prev dt-icon-back" onClick={this._onPre} />
          {dots ? this._renderDots() : null}
          <span className="swiper-ctrl swiper-ctrl-next dt-icon-next" onClick={this._onNext} />
        </div>
      </div>
    );
  }
}
