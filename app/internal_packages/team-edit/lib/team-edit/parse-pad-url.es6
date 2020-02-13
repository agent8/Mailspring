const parsePadInfoFromUrl = url => {
  const result = {}
  let s = url
  let i
  i = s.indexOf('?')
  result.headerMessageId = s.substring('edisonmail://teamedit.edison.tech/'.length, i)
  s = s.substring(i + 1)
  const fields = s.split(/\s*&\s*/)
  for (let field of fields) {
    const pair = field.split(/\s*=\s*/)
    const [k, v] = pair
    result[k] = v
  }
  return result
}

export default parsePadInfoFromUrl
