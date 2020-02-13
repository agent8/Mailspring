import keyMannager from '../../../src/key-manager'

export const getChatAccountByUserId = userId => {
  const chatAccounts = AppEnv.config.get('chatAccounts') || {}
  for (const email in chatAccounts) {
    const acc = chatAccounts[email]
    if (acc.userId === userId) {
      return acc
    }
  }
}

export const getTokenByUserId = async userId => {
  const chatAccounts = AppEnv.config.get('chatAccounts') || {}
  for (const email in chatAccounts) {
    const acc = chatAccounts[email]
    if (acc.userId === userId) {
      const token = await keyMannager.getAccessTokenByEmail(email)
      return token
    }
  }
}

export const isChatAccountUserId = userId => {
  const chatAccounts = AppEnv.config.get('chatAccounts') || {}
  for (const email in chatAccounts) {
    const acc = chatAccounts[email]
    if (acc.userId === userId) {
      return true
    }
  }
  return false
}

export default {
  getChatAccountByUserId,
  getTokenByUserId,
  isChatAccountUserId,
}
