import React from 'react'
import { Actions } from 'mailspring-exports'
import { RetinaImg, LottieImg } from 'mailspring-component-kit'
import getTeamEditSideBarItems from './team-edit-sidebar-items'
import SidebarStore from '../../../account-sidebar/lib/sidebar-store'
import { ChatActions } from 'chat-exports'

const buttonTimeout = 700
export default class TeamEditButton extends React.Component {
  static displayName = 'TeamEditButton'

  constructor (props) {
    super(props)
    this.state = { creatingNewDraft: false, showLoading: false }
    this._sendButtonClickedTimer = null
    this._loadingButtonTimer = null
    this._mounted = false
    this._unlisten = Actions.composedNewBlankDraft.listen(this._onNewDraftCreated, this)
  }

  componentDidMount () {
    this._mounted = true
  }

  componentWillUnmount () {
    this._mounted = false
    clearTimeout(this._sendButtonClickedTimer)
    clearTimeout(this._loadingButtonTimer)
    this._unlisten()
  }

  _timoutButton = () => {
    if (!this._sendButtonClickedTimer) {
      this._sendButtonClickedTimer = setTimeout(() => {
        clearTimeout(this._loadingButtonTimer)
        if (this._mounted) {
          this.setState({ creatingNewDraft: false, showLoading: false })
        }
        this._sendButtonClickedTimer = null
      }, buttonTimeout)
    }
  }

  _onNewDraftCreated = () => {
    if (!this._mounted) {
      return
    }
    clearTimeout(this._loadingButtonTimer)
    if (this._sendButtonClickedTimer) {
      return
    }
    this._sendButtonClickedTimer = setTimeout(() => {
      if (this._mounted) {
        this.setState({ creatingNewDraft: false, showLoading: false })
      }
      this._sendButtonClickedTimer = null
    }, buttonTimeout)
  }
  _delayShowLoading = () => {
    this._loadingButtonTimer = setTimeout(() => {
      if (this._mounted) {
        this.setState({ showLoading: true })
      }
    }, buttonTimeout)
  }

  _onPopupTeamEdit = () => {
    console.log(' _sections.Standard.items 1: ', SidebarStore._sections.Standard.items[0])
    let userItem = SidebarStore._sections.Standard.items[2]
    const items = getTeamEditSideBarItems().items
    // SidebarStore._sections.Standard.items.splice(1, 0, items[0])
    SidebarStore._sections.Standard.items.splice(6, 0, userItem)
    console.log(' _sections.Standard.items 2: ', SidebarStore._sections.Standard.items)
    // SidebarStore.trigger()
    // console.log(' _onPopupTeamEdit SidebarStore:', SidebarStore)
    AppEnv.newWindow({
      windowType: 'team-edit',
      windowKey: `team-edit`,
      title: 'Team Edit',
    })
  }

  render () {
    return (
      <div
        className='sheet-toolbar'
        style={{ position: 'unset', height: 'unset', padddingLeft: 15, paddingTop: 40 }}
      >
        <button
          className={`btn btn-toolbar item-team-edit ${
            this.state.creatingNewDraft ? 'btn-disabled' : ''
          }`}
          title='Popup team edit window'
          disabled={this.state.creatingNewDraft}
          onClick={this._onPopupTeamEdit}
        >
          {this.state.showLoading ? (
            <LottieImg
              name='loading-spinner-blue'
              size={{ width: 24, height: 24 }}
              style={{ margin: 'none' }}
            />
          ) : (
            <RetinaImg
              name='pencil.svg'
              style={{ width: 24 }}
              isIcon={true}
              mode={RetinaImg.Mode.ContentIsMask}
            />
          )}
          <span>Team Edit</span>
        </button>
      </div>
    )
  }
}
