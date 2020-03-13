export default function(messages, start = 0, end = Infinity) {
  let groupedMessages = [];
  //   let zeroHourSet = new Set();
  let lastTime = 0;
  let lastSender = '';

  messages = messages.slice(start, end);
  //   for (let row of messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    let row = messages[i];
    let zeroHour = new Date(row.sentTime).setHours(0, 0, 0, 0);

    // if (!zeroHourSet.has(zeroHour)) {
    //   groupedMessages.push({
    //     id: zeroHour,
    //     body: {
    //       content: zeroHour,
    //       type: 'DATE',
    //     },
    //   });
    //   zeroHourSet.add(zeroHour);
    // }

    let time = row.sentTime;
    let sender = row.sender;
    if (
      Math.abs(lastTime - time) <= 5 * 60 * 1000 &&
      lastSender === sender &&
      lastTime > zeroHour &&
      !['error403', 'memberschange', 'change-group-name', 'SecurePrivate'].includes(row.body.type)
    ) {
      let lastRow = groupedMessages.pop();
      if (!lastRow.siblings) {
        lastRow.siblings = [];
      }
      if (lastRow.siblings.length > 8) {
        groupedMessages.push(lastRow);
        groupedMessages.push({ ...row });
      } else {
        lastRow.siblings.push(row);
        groupedMessages.push(lastRow);
      }
    } else {
      groupedMessages.push({ ...row });
    }
    lastTime = time;
    lastSender = sender;
  }
  //   console.log('groupedMessages', messages, groupedMessages);
  return groupedMessages.reverse();
}

export function groupByDate(messages, start = 0, end = Infinity) {
  let groupedMessages = [];
  let zeroHourSet = new Set();

  messages = messages.slice(start, end);
  for (let i = messages.length - 1; i >= 0; i--) {
    let row = messages[i];
    if (row.body.type === 'SecurePrivate') {
      groupedMessages.push(row);
      continue;
    }

    let zeroHour = new Date(row.sentTime).setHours(0, 0, 0, 0);

    if (!zeroHourSet.has(zeroHour)) {
      groupedMessages.push({
        id: zeroHour,
        body: {
          content: zeroHour,
          type: 'DATE',
        },
      });
      zeroHourSet.add(zeroHour);
    }
    groupedMessages.push(row);
  }
  //   console.log('groupedMessages', messages, groupedMessages);
  return groupedMessages.reverse();
}
