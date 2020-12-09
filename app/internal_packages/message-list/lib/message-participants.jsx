import _ from 'underscore';
import classnames from 'classnames';
import { React, PropTypes, Actions } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import { remote, clipboard } from 'electron';
import MessageTimestamp from './message-timestamp';
const { Menu, MenuItem } = remote;

const MAX_COLLAPSED = 5;

export default class MessageParticipants extends React.Component {
  static displayName = 'MessageParticipants';

  static propTypes = {
    date: PropTypes.number,
    to: PropTypes.array,
    cc: PropTypes.array,
    bcc: PropTypes.array,
    replyTo: PropTypes.array,
    from: PropTypes.array,
    onClick: PropTypes.func,
    isDetailed: PropTypes.bool,
    detailFrom: PropTypes.array,
    isBlocked: PropTypes.bool,
    children: PropTypes.element,
  };

  static defaultProps = {
    to: [],
    cc: [],
    bcc: [],
    from: [],
    replyTo: [],
  };

  // Helpers

  _allToParticipants() {
    return _.union(this.props.to, this.props.cc, this.props.bcc);
  }

  _shortNames(contacts = [], max = MAX_COLLAPSED) {
    let names = contacts.map(c => c.displayName({ includeAccountLabel: true, compact: true }));
    if (names.length > max) {
      const extra = names.length - max;
      names = names.slice(0, max);
      names.push(`and ${extra} more`);
    }
    return names.join(', ');
  }
  _onSelectText = (selectParent, e) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(this._chooseRange(e, selectParent));
  };
  _chooseRange = (e, selectParent = false) => {
    let children;
    if (selectParent) {
      children = [e.currentTarget.parentNode];
    } else {
      children = e.currentTarget.childNodes;
    }
    const range = document.createRange();
    if (children.length > 1) {
      const firstChild = e.currentTarget.firstElementChild;
      const lastChild = e.currentTarget.lastElementChild;
      range.setStart(firstChild, 0);
      if (lastChild.childNodes.length > 3) {
        range.setEnd(lastChild, 3);
      } else if (lastChild.childNodes.length === 2) {
        range.setEnd(lastChild, 1);
      } else {
        range.setEndAfter(lastChild);
      }
    } else {
      const textNode = children[0];
      range.setStart(textNode, 0);
      range.setEndAfter(textNode);
    }
    return range;
  };

  _onContactContextMenu = (contact, e) => {
    const menu = new Menu();
    menu.append(new MenuItem({ role: 'copy' }));
    menu.append(
      new MenuItem({
        label: 'Copy Address',
        click: () => clipboard.writeText(contact.email),
      })
    );
    menu.append(
      new MenuItem({
        label: `Email ${contact.email}`,
        click: () => Actions.composeNewDraftToRecipient(contact),
      })
    );
    menu.popup({});
  };

  _renderFullContacts(contacts = []) {
    return contacts.map((c, i) => {
      let comma = <span className="expanded-comma">,&nbsp;</span>;
      if (contacts.length === 1 || i === contacts.length - 1) {
        comma = null;
      }

      if (c.name && c.name.length > 0 && c.name !== c.email) {
        return (
          <div
            key={`${c.email}-${i}`}
            className="participant selectable"
            onClick={this._onSelectText.bind(this, false)}
            onDoubleClick={this._onSelectText.bind(this, true)}
            onContextMenu={this._onContactContextMenu.bind(this, c)}
          >
            <div className="participant-primary">
              {this.props.isDetailed ? c.fullOriginal() : c.fullName()}
            </div>
            <div className="participant-secondary">
              <span className="expanded-email">&nbsp;{c.email}</span>
              {comma}
            </div>
          </div>
        );
      }
      return (
        <div
          key={`${c.email}-${i}`}
          className="participant selectable"
          onDoubleClick={this._onSelectText.bind(this, true)}
          onContextMenu={this._onContactContextMenu.bind(this, c)}
        >
          <div className="participant-primary">
            <span onClick={this._onSelectText.bind(this, false)}>{c.email}</span>
            {comma}
          </div>
        </div>
      );
    });
  }

  _renderExpandedField(name, field, { includeLabel = true, includeChildren = false } = {}) {
    return (
      <div className="participant-type" key={`participant-type-${name}`}>
        {includeLabel ? (
          <div className={`participant-label ${name}-label`}>
            {name === 'detail-from' ? 'from' : name}:
          </div>
        ) : null}
        <div className={`participant-name ${name}-contact`}>
          {this._renderFullContacts(field)}
          {includeChildren ? this.props.children : null}
        </div>
      </div>
    );
  }

  _renderExpanded() {
    const { detailFrom, from, replyTo, to, cc, bcc, isBlocked, date } = this.props;
    const expanded = [];

    if (date) {
      expanded.push(
        <div className="participant-type">
          <div className="participant-label normal-label">Date:</div>
          <div className="participant-name">
            <div className="participant selectable">
              <div className="participant-primary"></div>
              <div className="participant-secondary">
                <MessageTimestamp isDetailed date={date} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (detailFrom && detailFrom.length > 0) {
      expanded.push(this._renderExpandedField('detail-from', detailFrom));
    }

    if (replyTo.length > 0) {
      expanded.push(this._renderExpandedField('reply-to', replyTo));
    }

    if (to.length > 0) {
      expanded.push(this._renderExpandedField('to', to));
    }

    if (cc.length > 0) {
      expanded.push(this._renderExpandedField('cc', cc));
    }

    if (bcc.length > 0) {
      expanded.push(this._renderExpandedField('bcc', bcc));
    }

    if (isBlocked) {
      expanded.push(
        <div className="participant-type">
          <div className="participant-label normal-label">
            <RetinaImg
              name={'readReceipts.svg'}
              style={{ width: 16, height: 16, fontSize: 16 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
              onClick={this._onClickTrackingIcon}
            />
          </div>
          <div className="participant-name">
            <div className="participant selectable">
              <div className="participant-primary"></div>
              <div className="participant-secondary">Email tracking is blocked</div>
            </div>
          </div>
        </div>
      );
    }

    if (from.length > 0) {
      expanded.push(this._renderExpandedField('from', from, { includeLabel: false }));
    }
    if (!expanded || expanded.length === 0) {
      return null;
    }
    return <div className="expanded-participants">{expanded}</div>;
  }

  _renderCollapsed() {
    const childSpans = [];
    const toParticipants = this._allToParticipants();

    if (this.props.from.length > 0) {
      childSpans.push(
        <span className="participant-name from-contact" key="from">
          {/* {this._shortNames(this.props.from)} */}
          {this._renderExpandedField('from', this.props.from, { includeLabel: false })}
        </span>
      );
    }

    if (toParticipants.length > 0) {
      childSpans.push(
        <span className="participant-label to-label" key="to-label">
          To:
        </span>,
        <span className="participant-name to-contact" key="to-value">
          {this._shortNames(toParticipants)}
        </span>,
        this.props.children
      );
    }

    return <span className="collapsed-participants">{childSpans}</span>;
  }

  render() {
    const { isDetailed, from, onClick } = this.props;
    const classSet = classnames({
      participants: true,
      'message-participants': true,
      collapsed: !isDetailed,
      expanded: isDetailed,
      'from-participants': from.length > 0,
      'to-participants': this._allToParticipants().length > 0,
    });

    return (
      <div className={classSet} onClick={onClick}>
        {isDetailed ? this._renderExpanded() : this._renderCollapsed()}
      </div>
    );
  }
}
