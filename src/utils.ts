export const getRandomFromArray = (arr: any[]) => {
  return arr[Math.floor(Math.random() * arr.length)]
}