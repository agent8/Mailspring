import React, { Component } from 'react';
import ThreadSearchBar from './thread-search-bar';
import { HasTutorialTip } from 'mailspring-component-kit';
import SearchStore from './search-store';
import { ListensToFluxStore } from 'mailspring-component-kit';
import { Actions, FocusedPerspectiveStore } from 'mailspring-exports';

const ThreadSearchBarWithTip = HasTutorialTip(ThreadSearchBar, {
  title: 'Search with ease',
  instructions: (
    <span>
      Combine your search queries with Gmail-style terms like <strong>in: folder</strong> and{' '}
      <strong>since: "last month"</strong> to find anything in your mailbox.
    </span>
  ),
});

class TitleSearchBar extends Component {
  static displayName = 'TitleSearchBar';
  MIN_FONT_SIZE = 14;
  INITIAL_FONT_SIZE = 32;
  constructor(props) {
    super(props);
    this.state = {
      fontSize: this.props.fontSize || this.INITIAL_FONT_SIZE,
    };
  }

  UNSAFE_componentWillReceiveProps() {
    this.state.fontSize = this.props.fontSize || this.INITIAL_FONT_SIZE;
  }

  componentDidMount() {
    if (this.titleEl) {
      setTimeout(() => {
        const container = this.titleEl.closest('.item-container');
        this.containerWidth = container ? container.clientWidth : 0;
        this.adjustFontSize();
      }, 200);
    }
  }

  componentDidUpdate() {
    this.adjustFontSize();
  }

  adjustFontSize() {
    if (!this.titleEl) {
      return;
    }
    const minFontSize = this.props.minFontSize || this.MIN_FONT_SIZE;
    if (this.titleEl.offsetWidth > this.containerWidth) {
      const newSize = this.state.fontSize - 1;
      if (newSize < minFontSize) {
        this.titleEl.style.visibility = 'visible';
        return;
      }
      this.setState({
        fontSize: newSize,
      });
    } else {
      this.titleEl.style.visibility = 'visible';
    }
  }

  render() {
    const { perspective, current } = this.props;
    let TitleComponent = null;
    if (perspective.tab) {
      TitleComponent = (
        <div className="title-tabs">
          {perspective.tab.map(tab => {
            return (
              <div
                className={`tab-item${current === tab ? ' select' : ''}`}
                onClick={() => {
                  Actions.focusMailboxPerspective(tab);
                }}
                key={tab.name}
              >
                <h1>{tab.name}</h1>
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
              fontSize: this.state.fontSize,
            }}
            ref={el => (this.titleEl = el)}
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
  stores: [SearchStore, FocusedPerspectiveStore],
  getStateFromStores() {
    return {
      query: SearchStore.query(),
      isSearching: SearchStore.isSearching(),
      perspective: FocusedPerspectiveStore.currentSidebar(),
      current: FocusedPerspectiveStore.current(),
    };
  },
});
