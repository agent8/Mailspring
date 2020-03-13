import React from 'react';
// import { addListener, removeListener } from 'resize-detector';

export class Item extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.wrapperRef = React.createRef();
    this.previousMeasuredHeight = 0;
  }

  componentDidMount() {
    this.setCache(this.props.scroller, this.props.itemIndex);
    // addListener(this.wrapperRef.current, this.measure);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // if (nextProps.needAdjustment) {
    this.setCache(nextProps.scroller, nextProps.itemIndex);
    // }
  }

  //   shouldComponentUpdate(nextProps) {
  //     return this.props.itemIndex !== nextProps.itemIndex;
  //   }

  componentWillUnmount() {
    // removeListener(this.wrapperRef.current, this.measure);
  }

  setCache = ({ virtualUpperHeight, cachedItemRect, cacheItem }, itemIndex) => {
    const prevItem = cachedItemRect[itemIndex - 1];
    let curItem;
    const rect = this.wrapperRef.current.getBoundingClientRect();
    if (prevItem) {
      // if previous item exists, use prevItem.bottom as the virtualUpperHeight
      const bottom = prevItem.bottom + rect.height;
      const top = prevItem.bottom;
      curItem = { index: itemIndex, top, bottom, height: rect.height };
      cacheItem(itemIndex, curItem);
    } else {
      // if previous item doesn't exist, it's the first item, so virtualUpperHeight equals upperPlaceholderHeight
      const top = virtualUpperHeight;
      const bottom = virtualUpperHeight + rect.height;
      curItem = { index: itemIndex, top, bottom, height: rect.height };
      cacheItem(itemIndex, curItem);
    }
    if (!this.previousMeasuredHeight) {
      this.previousMeasuredHeight = rect.height;
    }
  };

  measure = () => {
    const { itemIndex } = this.props;
    if (this.wrapperRef.current) {
      const curItemRect = this.wrapperRef.current.getBoundingClientRect();
      const delta = curItemRect.height - (this.previousMeasuredHeight || 0);
      this.previousMeasuredHeight =
        curItemRect.height !== this.previousMeasuredHeight
          ? curItemRect.height
          : this.previousMeasuredHeight;
      this.props.measure(itemIndex, delta);
    }
  };

  render() {
    return (
      <li
        ref={this.wrapperRef}
        style={{
          listStyleType: 'none',
          flex: 'none',
        }}
      >
        {this.props.renderItem(this.props.item, this.props.itemIndex, this.measure)}
      </li>
    );
  }
}
