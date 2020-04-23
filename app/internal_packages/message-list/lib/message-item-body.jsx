import {
  Utils,
  React,
  PropTypes,
  MessageUtils,
  MessageBodyProcessor,
  QuotedHTMLTransformer,
  AttachmentStore,
  MessageStore,
} from 'mailspring-exports';
import { InjectedComponentSet, RetinaImg } from 'mailspring-component-kit';

import EmailFrame from './email-frame';

const TransparentPixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNikAQAACIAHF/uBd8AAAAASUVORK5CYII=';

class ConditionalQuotedTextControl extends React.Component {
  static displayName = 'ConditionalQuotedTextControl';

  static propTypes = {
    body: PropTypes.string.isRequired,
    onClick: PropTypes.func,
  };

  shouldComponentUpdate(nextProps) {
    return this.props.body !== nextProps.body;
  }

  render() {
    if (!QuotedHTMLTransformer.hasQuotedHTML(this.props.body)) {
      return null;
    }
    return (
      <a className="quoted-text-control" title="Show trimmed content" onClick={this.props.onClick}>
        <span className="dots">
          <RetinaImg
            name={'expand-more.svg'}
            style={{ width: 24, height: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </span>
      </a>
    );
  }
}

export default class MessageItemBody extends React.Component {
  static displayName = 'MessageItemBody';
  static propTypes = {
    message: PropTypes.object.isRequired,
    downloads: PropTypes.object.isRequired,
    calendar: PropTypes.object,
    setTrackers: PropTypes.func,
    viewOriginalEmail: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);
    this._mounted = false;
    this.state = {
      showQuotedText: this.props.message.isForwarded(),
      processedBody: MessageBodyProcessor.retrieveCached(this.props.message),
    };
  }

  UNSAFE_componentWillMount() {
    const needInitialCallback = this.state.processedBody === null;
    this._unsub = MessageBodyProcessor.subscribe(
      this.props.message,
      needInitialCallback,
      processedBody => this._setProcessBody(processedBody, this.props.message.id)
    );
    if (!this.state.processedBody && this.props.message) {
      MessageBodyProcessor.updateCacheForMessage(this.props.message);
    }
  }

  componentDidMount() {
    this._mounted = true;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.message.id !== this.props.message.id || !this.state.processedBody) {
      this.renewSubscriptionToMessageBodyProcessor(nextProps);
    } else if (
      nextProps.message.id === this.props.message.id &&
      nextProps.message.version > this.props.message.version &&
      nextProps.message.body === this.props.message.body
    ) {
      this.renewSubscriptionToMessageBodyProcessor(nextProps);
    }
  }

  renewSubscriptionToMessageBodyProcessor(props) {
    if (this._unsub) {
      this._unsub();
    }
    this._unsub = MessageBodyProcessor.subscribe(props.message, true, processedBody =>
      this._setProcessBody(processedBody, props.message.id)
    );
  }

  _setProcessBody = (processedBody, messageId) => {
    if (processedBody === null || processedBody.trim() === '') {
      // const query = DatabaseStore.find(Message, messageId);
      // query.include(Message.attributes.body);
      MessageStore.findByMessageIdWithBody({ messageId: messageId }).then(msg => {
        if (msg.body !== this.state.processedBody) {
          this.setState({ processedBody });
        }
      });
    } else {
      this.setState({ processedBody });
    }
  };

  componentWillUnmount() {
    this._mounted = false;
    if (this._unsub) {
      this._unsub();
    }
  }

  _onToggleQuotedText = () => {
    this.setState({
      showQuotedText: !this.state.showQuotedText,
    });
  };

  _mergeBodyWithFiles(body) {
    let merged = body;
    // Replace cid: references with the paths to downloaded files
    this.props.message.files
      .filter(f => f.contentId)
      .forEach(file => {
        const download = this.props.downloads[file.id];
        const safeContentId = Utils.escapeRegExp(file.contentId);

        // Note: I don't like doing this with RegExp before the body is inserted into
        // the DOM, but we want to avoid "could not load cid://" in the console.

        if (download && download.state !== 'finished') {
          const inlineImgRegexp = new RegExp(
            `<\\s*img.*src=['"]cid:${safeContentId}['"][^>]*>`,
            'gi'
          );
          // Render a spinner
          merged = merged.replace(
            inlineImgRegexp,
            () =>
              '<img alt="spinner.gif" src="edisonmail://message-list/assets/spinner.gif" style="-webkit-user-drag: none;">'
          );
        } else {
          const cidRegexp = new RegExp(`"cid:${safeContentId}(@[^'"]+)?"`, 'gi');
          merged = merged.replace(
            cidRegexp,
            `"file://${Utils.safeBrowserPath(AttachmentStore.pathForFile(file))}" class='inline-image'`
          );
        }
      });

    // Replace remaining cid: references - we will not display them since they'll
    // throw "unknown ERR_UNKNOWN_URL_SCHEME". Show a transparent pixel so that there's
    // no "missing image" region shown, just a space.
    merged = merged.replace(MessageUtils.cidRegex, `src="${TransparentPixel}"`);

    // console.log('****message.body merged:', merged);

    return merged;
  }

  _renderBody() {
    const { message } = this.props;
    const { showQuotedText, processedBody } = this.state;

    if (
      typeof message.body === 'string' &&
      message.body.length > 0 &&
      (typeof processedBody === 'string' && processedBody.length > 0)
    ) {
      return (
        <EmailFrame
          showQuotedText={showQuotedText}
          content={this._mergeBodyWithFiles(processedBody)}
          message={message}
          viewOriginalEmail={this.props.viewOriginalEmail}
          setTrackers={this.props.setTrackers}
        />
      );
    }

    return (
      <div className="message-body-loading">
        <RetinaImg
          name="inline-loading-spinner.gif"
          mode={RetinaImg.Mode.ContentDark}
          style={{ width: 14, height: 14 }}
        />
      </div>
    );
  }

  render() {
    return (
      <span>
        <InjectedComponentSet
          matching={{ role: 'message:BodyHeader' }}
          exposedProps={{ message: this.props.message, calendar: this.props.calendar }}
          direction="column"
          style={{ width: '100%' }}
        />
        {this._renderBody()}
        <ConditionalQuotedTextControl
          body={this.props.message.body || ''}
          onClick={this._onToggleQuotedText}
        />
      </span>
    );
  }
}