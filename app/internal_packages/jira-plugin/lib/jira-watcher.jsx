import React, { Component } from "react";
import { FixedPopover } from 'mailspring-component-kit';
import { CSSTransitionGroup } from 'react-transition-group';
import Select from 'rc-select';
const { RetinaImg, LottieImg } = require('mailspring-component-kit');
export default class Watcher extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    componentDidMount = () => {
        this.mounted = true;
        this.safeSetState({
            loading: true
        })
        this._getWatchers();
    }
    componentWillUnmount = () => {
        this.mounted = false;
    }
    safeSetState = (data) => {
        if (this.mounted) {
            this.setState(data)
        }
    }
    _getWatchers = async () => {
        const { jira, issueKey } = this.props;
        const watchStatus = await jira.getIssueWatchers(issueKey);
        console.log('*****watchers', watchStatus);
        if (watchStatus) {
            this.safeSetState({
                loading: false,
                watchers: watchStatus.watchers,
                watchCount: watchStatus.watchCount,
                isWatching: watchStatus.isWatching,
            })
        }
    }
    toggleWatching = async () => {
        let { isWatching, watchCount } = this.state;
        const { jira, currentUser, issueKey } = this.props;
        this.closePopover();
        watchCount = isWatching ? watchCount - 1 : watchCount + 1;
        this.safeSetState({
            progress: 'loading',
            watchCount,
            isWatching: !isWatching
        })
        if (isWatching) {
            await jira.deleteWatcher(issueKey, currentUser.accountId);
        } else {
            console.log('*****addWatcher - 1', this.select);
            await jira.addWatcher(issueKey, currentUser.accountId);
        }
        this.safeSetState({
            progress: 'success',
        })
        this._getWatchers();
    }
    addWatcher = async (item, option) => {
        console.log('*****addWatcher - 2', this.select);
        const { jira, issueKey, currentUser } = this.props;
        const { watchers } = this.state;
        const newWatchers = [...watchers, {
            accountId: item.key,
            displayName: option.props.displayname
        }]
        this.safeSetState({
            progress: 'loading',
            adding: false,
            watchers: newWatchers,
            watchCount: newWatchers.length,
            isWatching: (item.key === currentUser.accountId)
        })
        try {
            await jira.addWatcher(issueKey, item.key);
        } catch (err) {
            this.safeSetState({
                progress: 'error',
            })
            return;
        }
        this.safeSetState({
            progress: 'success',
        })
    }
    removeWatcher = async accountId => {
        const { jira, issueKey, currentUser } = this.props;
        const { watchers } = this.state;
        const newWatchers = watchers.filter(item => item.accountId !== accountId);
        this.safeSetState({
            progress: 'loading',
            watchers: newWatchers,
            watchCount: newWatchers.length,
            isWatching: !(accountId === currentUser.accountId)
        })
        try {
            await jira.deleteWatcher(issueKey, accountId);
        } catch (err) {
            this.safeSetState({
                progress: 'error',
            })
            return;
        }
        this.safeSetState({
            progress: 'success',
        })
    }
    _renderLoading(width) {
        return <LottieImg
            name="loading-spinner-blue"
            size={{ width, height: width }}
            style={{ margin: 'none', display: 'inline-block' }}
        />
    }
    _renderProgress = () => {
        const { progress } = this.state;
        if (progress === 'loading') {
            return <div className="loading">
                {this._renderLoading(20)}
            </div>
        }
        return null;
    }
    selectFilter = (inputVal, option) => {
        return option.props.displayname.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1;
    }
    _handleClickAddWatcher = () => {
        this.safeSetState({ adding: true });
        setTimeout(() => {
            console.log("*****select", this.select)
            this.select.openIfHasChildren();
            this.select.inputRef.focus();
            window.sss = this.select;
        }, 300);
    }
    _renderWatcherList = () => {
        const { watchers, isWatching, adding } = this.state;
        const { userOptions } = this.props;
        console.log('*****adding', adding);
        return <div className="jira-watchlist">
            {this._renderProgress()}
            <div className="row toggle-watch" onClick={this.toggleWatching}>
                <RetinaImg
                    name={!isWatching ? 'jira-watch.svg' : 'jira-not-watch.svg'}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask}
                />
                <span>{isWatching ? 'Stop' : 'Start'} watching</span>
            </div>
            <div className="watcher-list">
                <CSSTransitionGroup
                    component="div"
                    transitionEnterTimeout={350}
                    transitionLeaveTimeout={350}
                    transitionName={'transition-fade'}
                >
                    {watchers
                        .sort((item, next) => next.displayName.localeCompare(item.displayName))
                        .map(item => <div className="row" key={item.accountId}>
                            {item.displayName}
                            <span onClick={() => this.removeWatcher(item.accountId)}>
                                <RetinaImg
                                    name="close.svg"
                                    isIcon
                                    mode={RetinaImg.Mode.ContentIsMask}
                                />
                            </span>
                        </div>)}
                </CSSTransitionGroup>
            </div>
            <div className="row add-watcher">
                {
                    !adding ? <button onClick={this._handleClickAddWatcher}>Add watchers</button> :
                        <Select
                            ref={el => this.select = el}
                            placeholder="Add watchers"
                            className="watch-users"
                            optionLabelProp="children"
                            filterOption={this.selectFilter}
                            labelInValue={true}
                            notFoundContent=""
                            onBlur={() => this.safeSetState({ adding: false })}
                            showSearch={true}
                            onChange={this.addWatcher}
                            dropdownClassName="jira-dropdown"
                        >{userOptions}</Select>
                }
            </div>
        </div>
    }
    openPopover = () => {
        this.safeSetState({
            open: true
        });
        this._getWatchers();
    }
    closePopover = () => {
        this.safeSetState({
            open: false,
            adding: false
        })
    }
    render() {
        const { isWatching, watchCount, loading, open } = this.state;
        const originRect = this.iconRef ? this.iconRef.getBoundingClientRect() : null;
        return (
            <div ref={el => this.iconRef = el} className="jira-watcher">
                {
                    !loading &&
                    <span onClick={this.openPopover}>
                        <RetinaImg
                            name={isWatching ? 'jira-watch.svg' : 'jira-not-watch.svg'}
                            isIcon
                            mode={RetinaImg.Mode.ContentIsMask}
                        />
                        <span>{watchCount > 0 ? watchCount : ''}</span>
                    </span>
                }
                {true && originRect && (
                    <FixedPopover {...{
                        className: "jira-watchlist",
                        direction: 'down',
                        disablePointer: true,
                        originRect: {
                            top: 18,
                            left: 160,
                        },
                        closeOnAppBlur: false,
                        onClose: this.closePopover,
                    }}>
                        {this._renderWatcherList()}
                    </FixedPopover>
                )}
            </div>
        )
    }
}