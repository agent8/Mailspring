export const sendDraftChangeToPad = (draft, padInfo, changes) => {
  console.log(' sendDraftChangeToPad: ', changes, draft, padInfo)
  if (!changes) {
    return
  }
  const draftInfo = {}
  for (const key of ['from', 'to', 'cc', 'bcc', 'subject']) {
    draftInfo[key] = draft[key]
    if (changes[key] != undefined) {
      draftInfo[key] = changes[key]
    }
  }
  sendEmailExtra(padInfo, draftInfo)
}

export const sendEmailExtra = (padInfo, draft) => {
  console.log(' sendEmailExtra: padInfo, draft: ', padInfo, draft)
  const files = Object.values(padInfo.files || {})
  const { padId } = padInfo
  console.log(' sendEmailExtra: window.padMap: ', window.padMap)
  const pad = window.padMap[padId]
  if (!pad) {
    return
  }
  const subject = draft.subject
  let from = draft.from || []
  from = from.map(x => x.email)
  let to = draft.to || []
  to = to.map(x => x.email)
  let cc = draft.cc || []
  cc = cc.map(x => x.email)
  let bcc = draft.bcc || []
  bcc = bcc.map(x => x.email)
  pad.socket.json.send({
    type: 'COLLABROOM',
    component: 'pad',
    data: {
      type: 'EMAIL_EXTR',
      email: {
        subject,
        to,
        cc,
        bcc,
        attachments: files,
      },
    },
  })
}
