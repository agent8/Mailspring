/**
 *  Scroller.
 *  used for calculate anchor and new items
 */
class Scroller {
  constructor({
    containerHieght = 0,
    guesstimatedItemCountPerPage = 0,
    bufferSize = 0,
    items = 0,
    averageHeight = 0,
    reverse = false,
  }) {
    this.containerHieght = containerHieght;
    this.guesstimatedItemCountPerPage = guesstimatedItemCountPerPage;
    this.bufferSize = bufferSize;
    this.items = items;
    this.averageHeight = averageHeight;
    this.cachedItemRect = [];

    this.anchorItem = { index: 0, top: 0, bottom: 0, height: 0 };
    this.virtualUpperHeight = 0;
    this.virtualUnderHeight = 0;

    this.shouldAdjust = false;
    this.direction = 'up';
    this.callback = () => {};

    this.startIndex = 0;
    this.displayCount = this.guesstimatedItemCountPerPage + this.bufferSize;
    this.endIndex = this.startIndex + this.displayCount - 1;

    this.reverse = reverse;
  }

  estimateBottomHeight() {
    const cachedItemRectLength = this.cachedItemRect.length;
    const endIndex = cachedItemRectLength === 0 ? this.endIndex : cachedItemRectLength;
    const bottomCountDelta = this.items.length - endIndex;
    const unCachedItemCount = bottomCountDelta < 0 ? 0 : bottomCountDelta;
    const lastCachedItemRect = this.cachedItemRect[cachedItemRectLength - 1];
    const lastCachedItemRectBottom = lastCachedItemRect ? lastCachedItemRect.bottom : 0;
    const lastItemRect =
      this.endIndex >= cachedItemRectLength
        ? this.cachedItemRect[cachedItemRectLength - 1]
        : this.cachedItemRect[this.endIndex];
    const lastItemRectBottom = lastItemRect ? lastItemRect.bottom : 0;
    const underPlaceholderHeight =
      lastCachedItemRectBottom - lastItemRectBottom + unCachedItemCount * this.averageHeight;
    return underPlaceholderHeight;
  }

  next = (items, fromCache) => {
    if (items && !fromCache) {
      this.items = items;
      this.virtualUnderHeight = this.estimateBottomHeight();
      this.shouldAdjust = true;
    }

    const projectedItems = this.items.slice(this.startIndex, this.endIndex + 1);
    this.callback(
      projectedItems,
      this.virtualUpperHeight,
      this.virtualUnderHeight,
      this.shouldAdjust
    );
  };

  /**
   * scroll down, hand up
   */
  up = scrollTop => {
    // console.log('up', scrollTop > this.anchorItem.bottom, scrollTop, this.anchorItem);
    this.direction = 'up';
    if (scrollTop > this.anchorItem.bottom) {
      const nextAnchorItem = this.cachedItemRect.find(item =>
        item ? item.bottom > scrollTop : false
      );

      if (nextAnchorItem) {
        let endIndex = this.endIndex;
        this.startIndex =
          nextAnchorItem.index - this.bufferSize >= this.startIndex
            ? nextAnchorItem.index - this.bufferSize
            : this.startIndex;

        this.endIndex = this.startIndex + this.displayCount - 1 + this.bufferSize;
        // let maxEndIndex = this.items.length - 1;
        // this.endIndex = this.endIndex <= maxEndIndex ? this.endIndex : maxEndIndex;
        this.virtualUpperHeight = this.cachedItemRect[this.startIndex].top;

        // this.virtualUnderHeight -= nextAnchorItem.top - this.anchorItem.top;
        this.virtualUnderHeight =
          this.virtualUnderHeight - (this.endIndex - endIndex) * this.averageHeight;
        // this.virtualUnderHeight -= (this.endIndex - lastEndIndex) * this.averageHeight;
        // console.log('virtualUnderHeight --- 111', this.endIndex, this.items);

        if (this.endIndex >= this.items.length - 1) {
          this.virtualUnderHeight = 0;
        }
        this.shouldAdjust = false;
        this.anchorItem = nextAnchorItem;
      } else {
        const cachedItemLength = this.cachedItemRect.length;
        const cachedItemHeight = this.cachedItemRect[cachedItemLength - 1].bottom;
        const unCachedDelta = scrollTop - cachedItemHeight;
        const guesstimatedUnCachedCount = Math.ceil(unCachedDelta / this.averageHeight);

        // let startIndex = this.endIndex + guesstimatedUnCachedCount - this.bufferSize;
        let startIndex = cachedItemLength - 1 + guesstimatedUnCachedCount - this.bufferSize;
        let maxStartIndex = this.items.length - 1 - this.displayCount - this.bufferSize;
        this.startIndex = startIndex <= maxStartIndex ? startIndex : maxStartIndex;
        this.endIndex = this.startIndex + this.displayCount - 1;

        this.virtualUpperHeight = scrollTop - this.bufferSize * this.averageHeight; //scrollTop;
        // this.virtualUnderHeight += this.anchorItem.top - scrollTop;
        this.virtualUnderHeight = this.estimateBottomHeight();
        // console.log('virtualUnderHeight', this.endIndex, this.items);
        if (this.endIndex >= this.items.length - 1) {
          this.virtualUnderHeight = 0;
        }
        this.shouldAdjust = true;
        this.cachedItemRect.length = 0;
      }
      this.next();
    }
  };

  /**
   * scroll up, hand down
   */
  down = scrollTop => {
    this.direction = 'down';
    if (scrollTop < this.anchorItem.top) {
      let nextAnchorItem = this.cachedItemRect.find(item => {
        if (item && item.bottom >= scrollTop && item.top <= scrollTop) {
          return true;
        }
        return false;
      });

      if (nextAnchorItem) {
        const nextStartIndex = nextAnchorItem.index - this.bufferSize;
        const lastEndIndex = this.endIndex;

        if (this.cachedItemRect[nextStartIndex >= 0 ? nextStartIndex : 0]) {
          this.startIndex = nextAnchorItem.index >= this.bufferSize ? nextStartIndex : 0;
          this.endIndex = this.startIndex + this.displayCount - 1;
          this.virtualUpperHeight = this.cachedItemRect[this.startIndex].top;
          if (this.cachedItemRect[lastEndIndex] && this.cachedItemRect[this.endIndex]) {
            this.virtualUnderHeight +=
              this.cachedItemRect[lastEndIndex].bottom - this.cachedItemRect[this.endIndex].bottom;
          }

          this.anchorItem = nextAnchorItem;

          this.shouldAdjust = false;
        }
      } else {
        const guesstimatedAnchorIndex = Math.floor(
          (Math.max(scrollTop, 0) / this.anchorItem.top) * this.anchorItem.index
        );
        // const lastEndIndex = this.endIndex;
        this.startIndex =
          guesstimatedAnchorIndex >= this.bufferSize
            ? guesstimatedAnchorIndex - this.bufferSize
            : 0;
        this.endIndex = this.startIndex + this.displayCount - 1;

        this.virtualUpperHeight =
          this.startIndex === 0 ? 0 : scrollTop - this.bufferSize * this.averageHeight;
        // this.virtualUnderHeight -= this.anchorItem.top - scrollTop;
        // if (this.cachedItemRect[lastEndIndex] && this.cachedItemRect[this.endIndex]) {
        //   this.virtualUnderHeight +=
        //     this.cachedItemRect[lastEndIndex].bottom - this.cachedItemRect[this.endIndex].bottom;
        // }
        this.virtualUnderHeight = this.estimateBottomHeight();

        this.shouldAdjust = true;
        this.cachedItemRect.length = 0;
      }
      this.next();
    }
  };

  /**
   * if slide down(eg. slide 52 to 51, scrollThroughItemCount is positive), virtualUpperHeight equals to state.virtualUpperHeight.
   * if slide up(eg. slide 52 to 53, scrollThroughItemCount is negative), virtualUpperHeight equals to current scrollTop.
   * then virtualUpperHeight minus scrollThroughItemDistance, we can get the actural height which should be render.
   * @param scrollTop
   *
   */
  calculateVirtualUpperHeight(scrollTop, height) {
    const prevStartIndex =
      this.anchorItem.index >= this.bufferSize ? this.anchorItem.index - this.bufferSize : 0;
    const scrollThroughItemCount = prevStartIndex - this.startIndex;
    const prevStartItem = this.cachedItemRect[prevStartIndex];
    const virtualUpperHeight =
      scrollThroughItemCount < 0 ? scrollTop : prevStartItem ? height : scrollTop;
    const endIndex = prevStartItem ? prevStartIndex : this.startIndex + this.bufferSize;
    const scrollThroughItem = this.cachedItemRect.slice(this.startIndex, endIndex);
    const scrollThroughItemDistance = scrollThroughItem.reduce((acc, item) => acc + item.height, 0);
    return virtualUpperHeight - scrollThroughItemDistance;
  }

  calculateActualUpperHeight(virtualvirtualUpperHeight) {
    this.virtualUpperHeight =
      this.startIndex === 0 ? 0 : virtualvirtualUpperHeight < 0 ? 0 : virtualvirtualUpperHeight;
    return this.virtualUpperHeight;
  }

  setAnchorFromCaches(scrollTop) {
    const anchor = this.cachedItemRect.find(item => (item ? item.bottom > scrollTop : false));
    if (anchor) {
      this.anchorItem = anchor;
    } else {
      this.anchorItem = this.cachedItemRect[this.cachedItemRect.length - 1];
    }
    this.shouldAdjust = false;
  }

  measure = (itemIndex, delta) => {
    if (itemIndex < this.anchorItem.index) {
      if (this.virtualUpperHeight === 0) {
        this.virtualUpperHeight = 0;
      } else {
        this.virtualUpperHeight = Math.max(this.virtualUpperHeight - delta, 0);
      }
    } else if (itemIndex === this.anchorItem.index) {
      // if anchor at 0, should not adjust virtualUpperHeight
      if (this.direction === 'down' && itemIndex !== 0) {
        this.virtualUpperHeight = Math.max(this.virtualUpperHeight - delta, 0);
      } else {
        const virtualUnderHeight = Math.max(this.virtualUnderHeight - delta, 0);
        this.virtualUnderHeight =
          virtualUnderHeight > this.containerHieght
            ? this.estimateBottomHeight()
            : virtualUnderHeight;
      }
    } else {
      this.virtualUnderHeight = Math.max(this.virtualUnderHeight - delta, 0);
    }
    return {
      virtualUpperHeight: this.virtualUpperHeight,
      virtualUnderHeight: this.virtualUnderHeight,
    };
  };

  /**
   * other way to update cache won't call setstate.
   * @param startIndex
   * @param delta
   */
  updateLaterItem(startIndex, delta) {
    const displayItems = this.cachedItemRect.slice(this.startIndex, this.endIndex + 1);
    this.cachedItemRect.length = 0;
    for (let i = this.startIndex; i <= this.endIndex; i++) {
      if (!displayItems[i - this.startIndex]) return;
      const previousItemBottom =
        i === this.startIndex
          ? this.virtualUpperHeight
          : displayItems[i - this.startIndex - 1].bottom;
      this.cachedItemRect[i] = displayItems[i - this.startIndex];
      if (startIndex === i) {
        this.cachedItemRect[i].height += delta;
      }
      this.cachedItemRect[i].top = previousItemBottom;
      this.cachedItemRect[i].bottom = previousItemBottom + this.cachedItemRect[i].height;
    }
  }

  estimateUpperHeight() {
    const estimateHeight = this.averageHeight * this.startIndex;
    this.virtualUpperHeight += estimateHeight;
    return estimateHeight;
  }

  resetAnchorFromCaches() {
    this.anchorItem = this.cachedItemRect[this.anchorItem.index];
  }

  subscribe(callback) {
    this.callback = callback;
  }

  cacheItem = (itemIndex, itemRect) => {
    this.cachedItemRect[itemIndex] = itemRect;
  };
}

module.exports = Scroller;
