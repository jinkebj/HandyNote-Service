export const truncate = (str, size) => {
  if (str === undefined || str.length <= size) {
    return str
  } else {
    return str.substr(0, size) + ' ...'
  }
}
