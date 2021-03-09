import React, { Component } from 'react';
import { AccountStore, NoteStore, FocusedPerspectiveStore } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';

import { labelOptions } from './note-labels';

export default class NoteFilter extends Component {
  static displayName = 'NoteFilter';

  state = {
    visible: true,
    selectedLabels: [],
  };

  toggleVisible = () => {
    this.setState({
      visible: !this.state.visible,
    });
  };

  saveSelected = ({ selectedKeys }) => {
    this.selected = selectedKeys;
  };

  onSelectLabel = label => {
    const selectedLabels = [...this.state.selectedLabels];
    if (selectedLabels.includes(label)) {
      selectedLabels.splice(selectedLabels.indexOf(label), 1);
    } else {
      selectedLabels.push(label);
    }
    this.setState({
      selectedLabels,
    });
    NoteStore.setLabelFilter(selectedLabels);
    FocusedPerspectiveStore.trigger();
  };

  render() {
    const current = FocusedPerspectiveStore.current();
    if (!current || current._categoryMetaDataId !== 'note') {
      return null;
    }

    const accounts = AccountStore.accounts();
    let isEdisonMail = false;
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true;
        break;
      }
    }
    if (!isEdisonMail) {
      return null;
    }

    const { selectedLabels, visible } = this.state;

    return (
      <div className="note-filter">
        <button className={`btn ${visible ? 'active' : ''}`} onClick={this.toggleVisible}>
          <RetinaImg
            name="filter.svg"
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
            style={{ width: 24, height: 24, fontSize: 24, float: 'left' }}
          />
        </button>
        <div className={`note-labels ${visible ? 'visible' : ''}`}>
          {labelOptions.map(({ value, label }) => (
            <div key={value} onClick={() => this.onSelectLabel(value)}>
              <span className={`${value} ${label ? 'label' : 'color'}`}>{label}</span>
              <div className="check-mark">
                {selectedLabels.includes(value) ? (
                  <RetinaImg
                    name="check-alone.svg"
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask}
                    style={{ width: 20, height: 20, float: 'left' }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
