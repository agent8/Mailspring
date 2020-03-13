/**
 * Scroller.
 * a component to render data base on the paramater(virtualUpperHeight, newItems, virtualUnderHeight) that received from Projector.
 * scroller also has an adjustment strategy to adjust virtualUpperHeight.
 */
import React from 'react';
import Scroller from './Scroller';
import { Item } from './Item';
import PropTypes from 'prop-types';
import { throttle } from 'underscore';

// const isIos = !!navigator.platform.match(/iPhone|iPod|iPad/);
const BUFFER_SIZE = 3;

class VirtualizedList extends React.Component {
  static props = {
    containerHeight: PropTypes.number,
    itemAverageHeight: PropTypes.number,
    className: PropTypes.string,
    items: PropTypes.shape,
    itemKey: PropTypes.string,
    initialScrollTop: PropTypes.number,
    renderItem: PropTypes.func,
    onScroll: PropTypes.func,
    onEndReached: PropTypes.func,
    shouldScrollToBottom: PropTypes.boolean,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      projectedItems: [],
      upperPlaceholderHeight: 0,
      underPlaceholderHeight: 0,
    };

    this.containerRef = React.createRef();
    this.upperPlaceholderRef = React.createRef();
    this.underPlaceholderRef = React.createRef();
    this.bottomRef = React.createRef();
    this.needAdjustment = false;
    this.isAdjusting = false;

    this.hasBottomTouched = true;
    this.previousScrollTop = 0;
    this.scroller = null;

    // this.onScroll = throttle(this.onScroll.bind(this), 300);
    this.onScroll = this.onScroll.bind(this);
    this.cache = {};
  }

  /**
   * tell projector to project while got asynchronous data
   * @param nextProps
   */
  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.items.length !== this.props.items.length) {
      this.hasBottomTouched = false;
    }
    console.log('UNSAFE_componentWillReceiveProps', this.props.cacheKey, nextProps.cacheKey);

    const cacheKey = nextProps.cacheKey;
    if (cacheKey !== this.props.cacheKey) {
      this.setCache(this.props.cacheKey);
      //   this.hasBottomTouched = false;
      if (this.cache[cacheKey]) {
        const { scroller, scrollTop, previousScrollTop } = this.cache[cacheKey];
        this.scroller = scroller;
        this.scroller.next(nextProps.items, true);
        setTimeout(() => {
          this.containerRef.current.scrollTop = scrollTop;
          this.previousScrollTop = previousScrollTop;
        });
      } else {
        this.init(nextProps, false);
      }
    } else {
      this.scroller.next(nextProps.items, false);
    }
  }

  componentDidUpdate() {
    if (this.needAdjustment) {
      if (this.isAdjusting) {
        this.isAdjusting = false;
        this.needAdjustment = false;
        return;
      }
    }
    // this.adjustUpperPlaceholderHieght();
  }

  /**
   * first mount: get the native dom
   */
  componentDidMount() {
    this.init(this.props);
  }

  init = props => {
    const guesstimatedItemCountPerPage = Math.ceil(props.containerHeight / props.itemAverageHeight);
    this.scroller = new Scroller({
      containerHieght: props.containerHeight,
      guesstimatedItemCountPerPage: guesstimatedItemCountPerPage,
      bufferSize: BUFFER_SIZE,
      items: props.items,
      averageHeight: props.itemAverageHeight,
      reverse: props.reverse,
    });

    this.scroller.subscribe(
      (projectedItems, upperPlaceholderHeight, underPlaceholderHeight, needAdjustment) => {
        this.needAdjustment = needAdjustment;

        if (underPlaceholderHeight < props.containerHeight && !this.hasBottomTouched) {
          this.hasBottomTouched = true;
          props.onEndReached();
        }

        const prevStateItemsLength = this.state.projectedItems.length;
        this.setState(
          {
            projectedItems: props.groupByDate(projectedItems),
            upperPlaceholderHeight,
            underPlaceholderHeight,
          },
          () => {
            if (prevStateItemsLength === 0 && projectedItems.length > 0) {
              if (!this.cache[props.cacheKey]) {
                this.containerRef.current.scrollTop = upperPlaceholderHeight;
              }
            }
            if (this.scroller.shouldAdjust) {
              let scrollTop = this.containerRef.current.scrollTop;
              let scrollHeight = this.containerRef.current.scrollHeight;
              if (props.reverse) {
                scrollTop = scrollHeight - scrollTop - props.containerHeight;
              }
              this.scroller.setAnchorFromCaches(scrollTop);
            }
          }
        );
      }
    );
    // tell projector to project synchronous data
    if (props.items.length > 0) {
      this.scroller.next();
      //   this.hasBottomTouched = false;
    }

    if (props.reverse && this.bottomRef.current) {
      setTimeout(() => {
        this.bottomRef.current.scrollIntoView();
        this.hasBottomTouched = false;
      }, 0);
    }
  };

  /**
   * We expect the measure to be triggered after height has changed but before repainting.
   * Then we can adjust the virtualUpperHeight manually to keep no flicker.
   */
  measure = (itemIndex, delta) => {
    const { virtualUpperHeight, virtualUnderHeight } = this.scroller.measure(itemIndex, delta);
    this.upperPlaceholderRef.current.style.height = virtualUpperHeight + 'px';
    this.underPlaceholderRef.current.style.height = virtualUnderHeight + 'px';
    if (virtualUpperHeight === 0 && this.scroller.startIndex !== 0) {
      this.compatibleScrollTo(this.containerRef.current.scrollTop + delta);
    }
    this.scroller.updateLaterItem(itemIndex, delta);
    // const previousAnchorIndex = this.scroller.anchorItem.index;
    this.scroller.setAnchorFromCaches(this.containerRef.current.scrollTop);
    // const currentAnchorIndex = this.scroller.anchorItem.index
    // this.keepScrollTopWithinAnchor(previousAnchorIndex)
  };

  /**
   * https://popmotion.io/blog/20170704-manually-set-scroll-while-ios-momentum-scroll-bounces/
   * In the scroll momentum period, can not modify the scrollTop of the container in ios, it's a bug.
   */
  compatibleScrollTo(scrollTop) {
    this.containerRef.current.style['-webkit-overflow-scrolling'] = 'auto';
    this.containerRef.current.scrollTop = scrollTop > 0 ? scrollTop : 0;
    this.containerRef.current.style['-webkit-overflow-scrolling'] = 'touch';
  }

  /**
   * if virtualUpperHeight is guesstimated(needAdjustment = true), we need to adjust virtualUpperHeight. this is step:
   * first next. project new sliced items. change needAdjustment to true.
   * first render. tell Item to update cache.
   * first didupdate. adjust virtualUpperHeight.
   * second render. update cache upon the correct virtualUpperHeight.
   * second didupdate. nothing happeded.
   */
  adjustUpperPlaceholderHieght() {
    this.isAdjusting = true;
    let scrollTop = this.containerRef.current.scrollTop;
    const cachedItemRect = this.scroller.cachedItemRect;
    const startIndex = this.scroller.startIndex;
    const finalHeight = this.scroller.calculateVirtualUpperHeight(
      scrollTop,
      this.state.upperPlaceholderHeight
    );
    const upperPlaceholderHeight = this.scroller.calculateActualUpperHeight(finalHeight);
    this.setState({ upperPlaceholderHeight }, () => {
      if (startIndex > 0) {
        if (finalHeight < 0) {
          this.compatibleScrollTo(scrollTop - finalHeight);
        }
      } else if (finalHeight !== 0) {
        this.compatibleScrollTo(scrollTop - finalHeight);
      }
      if (cachedItemRect[startIndex + 3]) {
        this.scroller.anchorItem = cachedItemRect[startIndex + 3];
      } else {
        this.scroller.setAnchorFromCaches(scrollTop);
      }
      // this.scroller.setAnchorFromCaches(scrollTop)
    });
  }

  /**
   * During resizing and remeasuring, items should be minimal flicker,
   * so we need to keep scrollTop within anchor item.
   */
  keepScrollTopWithinAnchor(prevAnchorIndex) {
    const currentAnchor = this.scroller.anchorItem;
    if (prevAnchorIndex > currentAnchor.index) {
      this.compatibleScrollTo(this.scroller.cachedItemRect[prevAnchorIndex].bottom);
    } else if (prevAnchorIndex < currentAnchor.index) {
      this.compatibleScrollTo(currentAnchor.top);
    } else {
    }
  }

  setCache = cacheKey => {
    let currentScrollTop = this.containerRef.current.scrollTop;

    this.cache[cacheKey] = {
      scroller: this.scroller,
      scrollTop: currentScrollTop,
      previousScrollTop: this.previousScrollTop,
    };
  };

  onScroll() {
    let currentScrollTop = this.containerRef.current.scrollTop;
    let scrollHeight = this.containerRef.current.scrollHeight;

    if (this.props.reverse) {
      currentScrollTop = scrollHeight - currentScrollTop - this.props.containerHeight;
    }

    if (currentScrollTop < this.previousScrollTop) {
      this.scroller.down(currentScrollTop);
    } else if (currentScrollTop > this.previousScrollTop) {
      this.scroller.up(currentScrollTop);
    }
    this.previousScrollTop = currentScrollTop;
    // this.props.onScroll(currentScrollTop);
  }

  render() {
    const style = {
      overflowX: 'hidden',
      overflowY: 'auto',
      overflowAnchor: 'none',
      height: '100%', //this.props.containerHeight,
      display: 'flex',
      flexDirection: this.props.reverse ? 'column-reverse' : 'column',
    };
    return (
      <div
        className={this.props.className}
        ref={this.containerRef}
        style={style}
        onScroll={this.onScroll}
      >
        {this.props.reverse && <div className="bottom" ref={this.bottomRef}></div>}

        <div
          id="upperPlaceholder"
          ref={this.upperPlaceholderRef}
          style={{ height: this.state.upperPlaceholderHeight, flexShrink: 0 }}
        ></div>

        {this.state.projectedItems.map((item, index) => (
          <Item
            key={this.props.itemKey ? item[this.props.itemKey] : index}
            scroller={this.scroller}
            item={item}
            measure={this.measure}
            needAdjustment={this.needAdjustment}
            itemIndex={this.scroller.startIndex + index}
            renderItem={this.props.renderItem}
          />
        ))}

        <div
          id="underPlaceholder"
          ref={this.underPlaceholderRef}
          style={{ height: this.state.underPlaceholderHeight, flexShrink: 0 }}
        ></div>

        {!this.props.reverse && <div className="bottom" ref={this.bottomRef}></div>}
      </div>
    );
  }
}
export default VirtualizedList;
