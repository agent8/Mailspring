import {
    React,
    ReactDOM,
    PropTypes,
    Utils,
    Actions,
    DraftStore,
    AttachmentStore,
    MessageStore,
} from 'mailspring-exports';
export default class View extends React.Component {
    static displayName = 'Calendar';
    constructor(props) {
        super(props);
        this.state = {
            currentEvent: [{}],
            isShowEvent: false,
            currentEventStartDateTime: '',
            currentEventEndDateTime: '',
            email: '',
            pwd: '',
            accountType: 'ICLOUD'
        };

        // dav.debug.enabled = true;
    }

    componentWillMount() {
    }

    componentDidMount() {

    }

    componentWillUnmount() {
    }

    render() {
        return <div>Logging in...</div>;
    }
    // #endregion
}