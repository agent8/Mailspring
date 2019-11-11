export default function(names = []) {
  let title = '';
  const len = names.length;
  if (len > 3) {
    title = `${names.slice(0, 3).join(', ')} & ${len - 3} others`;
  }
  if (len === 3) {
    title = `${names.slice(0, 2).join(', ')} & ${names[len - 1]}`;
  }

  if (len < 3) {
    title = `${names.join(' & ')}`;
  }

  return title;
}
