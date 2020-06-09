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
    this._startAutoPlay();
  }

  componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  changeCurrentIndex = idx => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.setState({
      activeIdx: idx,
      translateX: 0,
    });
    setTimeout(() => {
      this.setState({
        translateX: this.props.width,
      });
    }, 100);
    this._startAutoPlay();

    if (this.props.afterChange && typeof this.props.afterChange === 'function') {
      this.props.afterChange(idx);
    }
  };

  _startAutoPlay = () => {
    if (!this.props.autoplay || this.props.data.length <= 1) {
      return;
    }
    this.timer = setTimeout(() => {
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
    const { data, dots } = this.props;
    if (!dots) {
      return [];
    }
    const { activeIdx } = this.state;
    return data.map((item, index) => {
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

  renderPagination = () => {
    if (this.props.data.length <= 1) {
      return null;
    }

    return [
      <span
        key={`swiper-ctrl-prev`}
        className="swiper-ctrl swiper-ctrl-prev dt-icon-back"
        onClick={this._onPre}
      />,
      ...this._renderDots(),
      <span
        key={`swiper-ctrl-next`}
        className="swiper-ctrl swiper-ctrl-next dt-icon-next"
        onClick={this._onNext}
      />,
    ];
  };

  render() {
    const { data, width, height } = this.props;
    const { activeIdx, translateX } = this.state;
    const activePreIdx = activeIdx - 1 < 0 ? data.length - 1 : activeIdx - 1;
    const activeNextIdx = activeIdx + 1 > data.length - 1 ? 0 : activeIdx + 1;

    return (
      <div className="swiper-component-container" style={{ width: width, height: height + 24 }}>
        <div className="swiper-container" style={{ height: height, width: width }}>
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
              key={`swiper-virtual-slide-0`}
              style={{ height: height, width: width, float: 'left' }}
            >
              <RetinaImg name={data[activePreIdx]} mode={RetinaImg.Mode.ContentPreserve} />
            </div>
            <div
              className={`swiper-slide active`}
              key={`swiper-virtual-slide-1`}
              style={{ height: height, width: width, float: 'left' }}
            >
              <RetinaImg name={data[activeIdx]} mode={RetinaImg.Mode.ContentPreserve} />
            </div>
            <div
              className={`swiper-slide`}
              key={`swiper-virtual-slide-2`}
              style={{ height: height, width: width, float: 'left' }}
            >
              <RetinaImg name={data[activeNextIdx]} mode={RetinaImg.Mode.ContentPreserve} />
            </div>
          </div>
        </div>

        <div className="swiper-pagination" style={{ height: 24 }}>
          {this.renderPagination()}
        </div>
      </div>
    );
  }
}
