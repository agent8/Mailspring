import React, { Component } from "react";
import { Actions, AccountStore, RuntimeInfoStore } from 'mailspring-exports';
import { BindGlobalCommands, ResizableRegion } from 'mailspring-component-kit';
export default class RuntimeInfoPanel extends Component {
    static displayName = "RuntimeInfoPanel";
    constructor(props) {
        super(props);
        this.state = {
            show: false
        };
        this._unsubs = [];
    }
    componentDidMount = () => {
        this.mounted = true;
        this._unsubs = [
            RuntimeInfoStore.listen(this._onDataChange)
        ];
    }
    componentWillUnmount = () => {
        this.mounted = false;
        for (const unsub of this._unsubs) {
            unsub();
        }
        clearInterval(this.timer);
    }
    safeSetState = state => {
        if (this.mounted) {
            this.setState(state)
        }
    }
    _onDataChange = () => {
        this.safeSetState({
            runtimeInfo: RuntimeInfoStore.getRuntimeInfo()
        })
    }
    startFetchRuntimeInfo = () => {
        clearInterval(this.timer);
        this.timer = setInterval(() => {
            AccountStore.accounts().forEach(acc => {
                Actions.fetchNativeRuntimeInfo({ accountId: acc.id })
            });
        }, 1000);
    }
    _renderSection = sectionData => {
        return sectionData && Object.keys(sectionData).map(k => {
            const dataset = sectionData[k];
            return (
                <td key={k} colSpan="4" className="data-cell">
                    {
                        dataset.map((d, index) => (
                            <div key={index}>
                                <span>{d.create}</span>
                                <span>{d.execute}</span>
                                <span>{d.result}</span>
                                <span>{d.retry}</span>
                            </div>
                        ))
                    }
                </td>
            )
        })
    }
    renderAsyncProcess = accountId => {
        const data = this.state.runtimeInfo[accountId];
        const account = AccountStore.accountForId(accountId);
        return <table key={accountId} className="async-table">
            <tbody>
                <tr className="info-title">
                    <td rowSpan="2">Email</td>
                    <td rowSpan="2">Kind</td>
                    {data.async.Executing && Object.keys(data.async.Executing).map(k => <td key={k} colSpan="4">{k}</td>)}
                </tr>
                <tr className="info-title">
                    {data.async.Executing && Object.keys(data.async.Executing).map(k => [
                        <td key="cr">crea</td>,
                        <td key="ex">exec</td>,
                        <td key="res">res</td>,
                        <td key="ret">ret</td>
                    ])}
                </tr>
                <tr>
                    <td rowSpan="2" className="info-title">
                        {account.emailAddress}
                    </td>
                    <td className="info-title">Executing</td>
                    {this._renderSection(data.async.Executing)}
                </tr>
                <tr>
                    <td className="info-title">Waiting</td>
                    {this._renderSection(data.async.Waiting)}
                </tr>
            </tbody>
        </table>
    }
    renderSyncProcess = runtimeInfo => {
        const dataset = Object.keys(runtimeInfo).map(k => runtimeInfo[k]);
        if (!dataset || dataset.length === 0) {
            return null;
        }
        return <table className="sync-table">
            <tbody>
                <tr className="info-title">
                    <td>Email</td>
                    <td></td>
                    {dataset[0].sync && Object.keys(dataset[0].sync).map(k => <td key={k}>{k}</td>)}
                </tr>
                {
                    dataset.map(data => {
                        const account = AccountStore.accountForId(data['accountId']);
                        return (
                            <tr>
                                <td className="info-title">
                                    {account.emailAddress}
                                </td>
                                <td>
                                    <div>execute</div>
                                    <div>existCount</div>
                                    <div>folderName</div>
                                    <div>newCount</div>
                                    <div>syncState</div>
                                    <div>total</div>
                                </td>
                                {data.sync && Object.keys(data.sync).map(k => <td className="sync-data-cell" key={k}>
                                    <div>{data.sync[k].execute}</div>
                                    <div>{data.sync[k].existCount}</div>
                                    <div>{data.sync[k].folderName}</div>
                                    <div>{data.sync[k].newCount}</div>
                                    <div>{data.sync[k].syncState}</div>
                                    <div>{data.sync[k].total}</div>
                                </td>)}
                            </tr>
                        )
                    })
                }
            </tbody>
        </table>
    }
    _toggleShowRuntime = () => {
        if (this.state.show) {
            clearInterval(this.timer);
        } else {
            this.startFetchRuntimeInfo();
        }
        this.safeSetState({
            show: !this.state.show
        })
    }
    render() {
        const { runtimeInfo, show } = this.state;
        return (
            <BindGlobalCommands
                commands={{ 'core:show-runtime-info': event => this._toggleShowRuntime(event) }}
            >
                {
                    show && <ResizableRegion
                        handle={ResizableRegion.Handle.Top}
                        className="runtime-info-panel"
                    >
                        <h2>Async Info</h2>
                        {
                            runtimeInfo && Object.keys(runtimeInfo).map(this.renderAsyncProcess)
                        }
                        <hr />
                        <h2>Sync Info</h2>
                        {
                            runtimeInfo && this.renderSyncProcess(runtimeInfo)
                        }
                    </ResizableRegion>
                }
            </BindGlobalCommands>
        )
    }
}