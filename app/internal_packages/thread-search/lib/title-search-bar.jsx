import React, { Component } from 'react';
import PropTypes from 'prop-types';
import SearchStore from './search-store';
import { ListensToFluxStore } from 'mailspring-component-kit';
import { Actions, FocusedPerspectiveStore, ThreadCountsStore } from 'mailspring-exports';
// import ThreadSearchBar from './thread-search-bar';
// import { HasTutorialTip } from 'mailspring-component-kit';

// const ThreadSearchBarWithTip = HasTutorialTip(ThreadSearchBar, {
//   title: 'Search with ease',
//   instructions: (
//     <span>
//       Combine your search queries with Gmail-style terms like <strong>in: folder</strong> and{' '}
//       <strong>since: "last month"</strong> to find anything in your mailbox.
//     </span>
//   ),
// });

class TitleSearchBar extends Component {
  static displayName = 'TitleSearchBar';
  MIN_FONT_SIZE = 14;
  INITIAL_FONT_SIZE = 32;
  static propTypes = {
    fontSize: PropTypes.number,
    current: PropTypes.object,
    perspective: PropTypes.object,
  };
  constructor(props) {
    super(props);
    // this.state = {
    //   fontSize: this.props.fontSize || this.INITIAL_FONT_SIZE,
    // };
  }

  // UNSAFE_componentWillReceiveProps() {
  //   this.state.fontSize = this.props.fontSize || this.INITIAL_FONT_SIZE;
  // }

  // componentDidMount() {
  //   setTimeout(() => {
  //     if (this.titleEl) {
  //       const container = this.titleEl.closest('.item-container');
  //       this.containerWidth = container ? container.clientWidth : 0;
  //       this.adjustFontSize();
  //     }
  //   }, 200);
  // }

  componentDidUpdate() {
    this.adjustFontSize();
  }

  adjustFontSize() {
    // if (!this.titleEl) {
    //   return;
    // }
    // const minFontSize = this.props.minFontSize || this.MIN_FONT_SIZE;
    // if (this.titleEl.offsetWidth > this.containerWidth) {
    //   const newSize = this.state.fontSize - 1;
    //   if (newSize < minFontSize) {
    //     this.titleEl.style.visibility = 'visible';
    //     return;
    //   }
    //   this.setState({
    //     fontSize: newSize,
    //   });
    // } else {
    //   this.titleEl.style.visibility = 'visible';
    // }
  }

  render() {
    const { perspective, current } = this.props;
    let TitleComponent = null;
    if (perspective.tab) {
      TitleComponent = (
        <div className="title-tabs">
          {perspective.tab.map(tab => {
            const unreadCount = tab.unreadCount();

            return (
              <div
                className={`tab-item${current.isEqual(tab) ? ' select' : ''}`}
                onClick={() => {
                  Actions.focusMailboxPerspective(tab);
                }}
                key={tab.name}
              >
                <h1 title={tab.name}>
                  {tab.name}
                  {unreadCount > 0 ? <span>({unreadCount > 99 ? '99+' : unreadCount})</span> : null}
                </h1>
              </div>
            );
          })}
        </div>
      );
    } else {
      let title = '';
      if (perspective && perspective.threadTitleName) {
        title = perspective.threadTitleName;
      } else if (perspective && perspective.displayName) {
        title = perspective.displayName;
      } else if (perspective) {
        title = perspective.name;
      }
      TitleComponent = (
        <div className="thread-title">
          <h1
            style={{
              width: 'max-content',
              maxWidth: '100%',
              // fontSize: this.state.fontSize,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            ref={el => (this.titleEl = el)}
            title={title}
          >
            {title}
          </h1>
        </div>
      );
    }

    return <div className="title-search-bar">{TitleComponent}</div>;
  }
}

export default ListensToFluxStore(TitleSearchBar, {
  stores: [SearchStore, FocusedPerspectiveStore, ThreadCountsStore],
  getStateFromStores() {
    return {
      query: SearchStore.query(),
      isSearching: SearchStore.isSearching(),
      perspective: FocusedPerspectiveStore.currentSidebar(),
      current: FocusedPerspectiveStore.current(),
    };
  },
});
